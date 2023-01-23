import time

import numpy as np
import pandas as pd
import click
import argparse
import torch
import torch.nn as nn
from torch.optim.adamw import AdamW

from torchvision import transforms

from msclip.dataset.languages import SimpleTokenizer
from .data_access import IconClassDataset
from tqdm import tqdm
from torch.utils.data import DataLoader

import timeit


class DebugNet(nn.Module):
    def __init__(self):
        super().__init__()

        self.hidden = nn.Linear(2, 5)
        self.output = nn.Linear(5, 2)

    def forward(self, x):
        return self.output(torch.tanh(self.hidden(x)))


def find_layer(path, model):

    found = []

    try:
        for n, c in model.named_children():

            found.append((n, c))

            found = found + find_layer(path, c)
    except TypeError:
        pass

    return found


def load_pretrained_model(ms_clip_model, device, save_gradient=False):
    from msclip.config import config, update_config
    import msclip.models.clip_openai_pe_res_v1 as clip_openai_pe_res_v1

    args = argparse.Namespace()

    args.opts = []
    args.cfg = ms_clip_model
    update_config(config, args)
    config.defrost()
    config.NAME = ""
    setattr(config.MODEL.SPEC, 'GATHER_TENSORS', False)
    setattr(config.CUSTOM, 'SAVE_GRADIENT', save_gradient)
    config.freeze()

    model, _, _ = clip_openai_pe_res_v1.get_clip_model(config)

    model_file = config.MODEL.PRETRAINED_MODEL
    # logging.info('=> load model file: {}'.format(model_file))
    state_dict = torch.load(model_file, map_location="cpu")
    model.load_state_dict(state_dict)
    model.to(device)

    # logging.info('=> switch to eval mode')
    model_without_ddp = model.module if hasattr(model, 'module') else model
    model_without_ddp.eval()

    extract_transform = transforms.Compose([
        transforms.Resize(224, interpolation=transforms.InterpolationMode.BICUBIC),
        transforms.CenterCrop(size=(224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=config.INPUT.MEAN, std=config.INPUT.STD),
    ])

    normalization = transforms.Normalize(mean=config.INPUT.MEAN, std=config.INPUT.STD)

    return model_without_ddp, extract_transform, normalization


@click.command()
@click.argument('ms-clip-model', type=click.Path(exists=True))
@click.argument('tokenizer-file', type=click.Path(exists=True))
@click.argument('data-json', type=click.Path(exists=True))
@click.argument('test-set-path', type=click.Path(exists=True))
@click.argument('model-file', type=click.Path())
@click.argument('log-file', type=click.Path())
@click.option('--batch-size', type=int, default=32, help="Batch-size. default: 32.")
@click.option('--epochs', type=int, default=32, help="Batch-size. default: 32.")
@click.option('--accu-steps', type=int, default=1, help="Gradient accumulation steps. Default 1.")
@click.option('--start-lr', type=float, default=10e-4, help="Start learning rate. default: 10e-4.")
@click.option('--lr-scheduler', type=click.Choice(['StepLR', 'CosineAnnealingWarmRestarts'], case_sensitive=False),
              default='StepLR')
@click.option('--num-workers', type=int, default=8, help="Number of parallel workers during index creation."
                                                         "Default 8.")
@click.option('--debug', type=bool, is_flag=True, default=False, help="Replace the entire image table if specified.")
def train(ms_clip_model, tokenizer_file, data_json, test_set_path, model_file, log_file,
          batch_size, epochs, accu_steps, start_lr, lr_scheduler, num_workers, debug):

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    tokenizer = SimpleTokenizer(bpe_path=tokenizer_file)

    save_gradient = False

    if not debug:
        model, transform, normalization = load_pretrained_model(ms_clip_model, device, save_gradient=save_gradient)

        dataset = IconClassDataset(json_file=data_json, lang="en", transform=transform, test_set_path=test_set_path)

        data_loader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=num_workers, drop_last=True)
        total_steps = len(data_loader)

        def get_train_seq():
            return tqdm(enumerate(data_loader), total=total_steps, desc="train")
    else:
        model = DebugNet()

        total_steps = 100

        def get_train_seq():
            return tqdm(enumerate(zip(range(total_steps), range(total_steps))), total=total_steps, desc="train")

    num_update_steps = int(total_steps/accu_steps)

    optimizer = AdamW(model.parameters(), lr=start_lr)

    # total_iterations = total_steps*epochs

    resets_per_epoch = 1.0
    T_0 = int(resets_per_epoch*num_update_steps)
    if lr_scheduler == 'CosineAnnealingWarmRestarts':
        sched = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(optimizer=optimizer, T_0=T_0)
    else:
        sched = None

    decrease_epochs = 1
    decrease_factor = 34/55

    if lr_scheduler == 'StepLR':
        sched_epoch = torch.optim.lr_scheduler.StepLR(optimizer, step_size=decrease_epochs, gamma=decrease_factor)
    else:
        sched_epoch = None

    cross_entropy_loss = torch.nn.CrossEntropyLoss()

    labels = torch.tensor(np.arange(batch_size)).to(device)

    train_log = []

    update_counter = 0

    start = time.time()

    save_interval = 100

    for epoch in range(epochs):

        train_seq = get_train_seq()

        for step, (images, texts) in train_seq:

            optimizer.zero_grad()

            if debug:
                tokens = None
            else:

                images = images.to(device)
                tokens = tokenizer.tokenize(texts).to(device)

            with torch.set_grad_enabled(True):

                if debug:
                    trloss = 0.0
                else:
                    if save_gradient:
                        logits_image_text, logits_image_text_fiximage, logits_image_text_fixtext = \
                            model(images, tokens)
                    else:
                        logits_image_text = model(images, tokens)

                    loss = (cross_entropy_loss(logits_image_text, labels) +
                            cross_entropy_loss(logits_image_text.T, labels)) / 2

                    loss.backward()

                    trloss = loss.item()

                lr_str = ""
                for param_group in optimizer.param_groups:
                    lr_str += "{:3.8f}".format(param_group['lr'])

                train_seq.set_description("{:3.3} TLoss: {:.4f} LR: {}".
                                          format(epoch + step / total_steps, trloss, lr_str))

                log_entry = {'lr{}'.format(i): pg['lr'] for i, pg in enumerate(optimizer.param_groups)}

                log_entry['trloss'] = trloss

                log_entry['update_counter'] = update_counter

                log_entry['elapsed'] = time.time() - start

                train_log.append(log_entry)

                if (step+1) % accu_steps == 0 or step == total_steps - 1:

                    optimizer.step()

                    if sched is not None:
                        sched.step(update_counter)

                    update_counter += 1

                if (len(train_log) + 1) % save_interval == 0:
                    pd.DataFrame.from_records(train_log).to_pickle(log_file)

        if sched_epoch is not None:
            sched_epoch.step()

    pd.DataFrame.from_records(train_log).to_pickle(log_file)

    if not debug:
        torch.save(model.state_dict(), model_file)


