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
from .data_access import IconClassDataset, IconClassTreeSampler, IconClassTreeBatchSampler, IconClassRandomSampler
from tqdm import tqdm
from torch.utils.data import DataLoader

import json

from sklearn.model_selection import train_test_split


class DebugNet(nn.Module):
    def __init__(self):
        super().__init__()

        self.transformer = nn.Linear(2, 5)
        self.visual = nn.Linear(5, 2)

    def forward(self, x):
        return self.visual(torch.tanh(self.transformer(x)))


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
@click.argument('data-json', type=click.Path(exists=True))
@click.argument('train-data-json', type=click.Path(exists=False))
@click.argument('test-data-json', type=click.Path(exists=False))
@click.option('--train-fraction', type=float, default=0.9, help="")
def traintestsplit(data_json, train_data_json, test_data_json, train_fraction):

    with open(data_json) as f:
        df_json = json.load(f)

    df = pd.DataFrame.from_dict(df_json, orient='index')

    df = df.replace('', None).dropna(how='all')

    df_train, df_test = train_test_split(df, train_size=int(len(df)*train_fraction))

    df_json_train = {k: df_json[k] for k in df_train.index.to_list()}

    df_json_test = {k: df_json[k] for k in df_test.index.to_list()}

    with open(train_data_json, 'w') as f:
        f.write(json.dumps(df_json_train, indent=3))

    with open(test_data_json, 'w') as f:
        f.write(json.dumps(df_json_test, indent=3))


def test(device, model, test_dataset, test_batch_sampler, tokenizer, batch_size, num_workers):

    data_loader = DataLoader(test_dataset, batch_sampler=test_batch_sampler, num_workers=num_workers)

    total_steps = len(data_loader)

    cross_entropy_loss = torch.nn.CrossEntropyLoss()

    labels = torch.tensor(np.arange(batch_size)).to(device)

    teloss_te = 0.0
    teloss_im = 0.0

    test_seq = tqdm(enumerate(data_loader), total=total_steps, desc="test")

    for num, (images, texts) in test_seq:

        images = images.to(device)
        tokens = tokenizer.tokenize(texts).to(device)

        with torch.set_grad_enabled(False):

            logits_image_text, _, _ = model(images, tokens)

            lossim = cross_entropy_loss(logits_image_text, labels)
            losste = cross_entropy_loss(logits_image_text.T, labels)

            teloss_im += lossim.item()
            teloss_te += losste.item()

            test_seq.set_description("Test Loss: {:3.8f} REGROWS: {}".format((teloss_te+teloss_im)/2/(num+1),
                                                                            test_batch_sampler.regrows))
    teloss_te /= total_steps
    teloss_im /= total_steps

    return (teloss_te + teloss_im)/2, teloss_te, teloss_im


@click.command()
@click.argument('ms-clip-model', type=click.Path(exists=True))
@click.argument('tokenizer-file', type=click.Path(exists=True))
@click.argument('train-data-json', type=click.Path(exists=True))
@click.argument('test-set-path', type=click.Path(exists=True))
@click.argument('model-file', type=click.Path())
@click.argument('log-file', type=click.Path())
@click.option('--test-data-json', type=click.Path(exists=True), default=None, help="")
@click.option('--test-interval', type=int, default=None, help="")
@click.option('--batch-size', type=int, default=32, help="Batch-size. default: 32.")
@click.option('--epochs', type=int, default=32, help="Batch-size. default: 32.")
@click.option('--accu-steps', type=int, default=1, help="Gradient accumulation steps. Default 1.")
@click.option('--start-lr', type=float, default=10e-4, help="Start learning rate. default: 10e-4.")
@click.option('--lr-scheduler', type=click.Choice(['None', 'StepLR', 'CosineAnnealingWarmRestarts'], case_sensitive=False),
              default='StepLR')
@click.option('--sampler', type=click.Choice(['IconClassTreeSampler', 'IconClassRandomSampler'], case_sensitive=False),
              default='IconClassRandomSampler')
@click.option('--num-workers', type=int, default=8, help="Number of parallel workers during index creation."
                                                         "Default 8.")
@click.option('--debug', type=bool, is_flag=True, default=False, help="")
@click.option('--save-gradient', type=bool, is_flag=True, default=False, help="")
def train(ms_clip_model, tokenizer_file, train_data_json, test_set_path, model_file, log_file, test_data_json,
          test_interval, batch_size, epochs, accu_steps, start_lr, lr_scheduler, sampler, num_workers, debug,
          save_gradient=False):

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    # start_lr *= np.sqrt(accu_steps)

    tokenizer = SimpleTokenizer(bpe_path=tokenizer_file)

    if not debug:

        model, transform, normalization = load_pretrained_model(ms_clip_model, device, save_gradient=save_gradient)

        if sampler == "IconClassTreeSampler":

            test_sampler = IconClassTreeSampler(json_file=test_data_json)

            test_batch_sampler = IconClassTreeBatchSampler(sampler=test_sampler, batch_size=batch_size)

            train_sampler = IconClassTreeSampler(json_file=train_data_json)

            train_batch_sampler = IconClassTreeBatchSampler(sampler=train_sampler, batch_size=batch_size * accu_steps,
                                                            accu_steps=1)
        else:
            train_sampler = IconClassRandomSampler(json_file=train_data_json)

            test_sampler = IconClassRandomSampler(json_file=test_data_json)

            test_batch_sampler = None

            train_batch_sampler = None

        train_dataset = IconClassDataset(samples=train_sampler.samples, lang="en", transform=transform,
                                         test_set_path=test_set_path)

        test_dataset = IconClassDataset(samples=test_sampler.samples, lang="en", transform=transform,
                                        test_set_path=test_set_path)

        data_loader = DataLoader(train_dataset, batch_sampler=train_batch_sampler, num_workers=num_workers)

        total_steps = len(data_loader)

        def get_train_seq():
            return tqdm(enumerate(data_loader), total=total_steps, desc="train")
    else:
        model = DebugNet()
        test_dataset = None
        train_batch_sampler = None
        test_batch_sampler = None

        total_steps = 100

        def get_train_seq():
            return tqdm(enumerate(zip(range(total_steps), range(total_steps))), total=total_steps, desc="train")

    num_update_steps = int(total_steps/accu_steps)

    # total_iterations = total_steps*epochs

    if save_gradient:
        optimizer = None
        optimizer_text = AdamW(model.transformer.parameters(), lr=start_lr)
        optimizer_image = AdamW(model.visual.parameters(), lr=start_lr)

        sched = None
        sched_epoch = None

        resets_per_epoch = 1.0
        T_0 = int(resets_per_epoch * num_update_steps)
        if lr_scheduler == 'CosineAnnealingWarmRestarts':
            sched_text = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(optimizer=optimizer_text, T_0=T_0)
            sched_image = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(optimizer=optimizer_image, T_0=T_0)
        else:
            sched_text = None
            sched_image = None

        decrease_epochs = 1
        decrease_factor = 34 / 55

        if lr_scheduler == 'StepLR':
            sched_epoch_text = torch.optim.lr_scheduler.StepLR(optimizer_text, step_size=decrease_epochs,
                                                               gamma=decrease_factor)
            sched_epoch_image = torch.optim.lr_scheduler.StepLR(optimizer_image, step_size=decrease_epochs,
                                                                gamma=decrease_factor)
        else:
            sched_epoch_text = None
            sched_epoch_image = None
    else:
        optimizer = AdamW(model.parameters(), lr=start_lr)
        optimizer_text = None
        optimizer_image = None

        resets_per_epoch = 1.0
        T_0 = int(resets_per_epoch * num_update_steps)
        if lr_scheduler == 'CosineAnnealingWarmRestarts':
            sched = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(optimizer=optimizer, T_0=T_0)
        else:
            sched = None

        decrease_epochs = 1
        decrease_factor = 34 / 55

        if lr_scheduler == 'StepLR':
            sched_epoch = torch.optim.lr_scheduler.StepLR(optimizer, step_size=decrease_epochs, gamma=decrease_factor)
        else:
            sched_epoch = None

        sched_text = None
        sched_image = None
        sched_epoch_text = None
        sched_epoch_image = None

    cross_entropy_loss = torch.nn.CrossEntropyLoss()

    labels = torch.tensor(np.arange(batch_size)).to(device)

    train_log = []

    update_counter = 0

    start = time.time()

    test_interval /= accu_steps
    save_interval = 100/accu_steps

    teloss_prev = np.inf

    test(device, model, test_dataset, test_batch_sampler, tokenizer, batch_size, num_workers)
    test(device, model, test_dataset, test_batch_sampler, tokenizer, batch_size, num_workers)

    for epoch in range(epochs):

        train_seq = get_train_seq()

        for step, (step_images, step_texts) in train_seq:

            for astep in range(0, accu_steps):

                images = step_images[astep*batch_size:(astep+1)*batch_size]
                texts = step_texts[astep * batch_size:(astep + 1) * batch_size]

                if debug:
                    tokens = None
                else:
                    images = images.to(device)
                    tokens = tokenizer.tokenize(texts).to(device)

                with torch.set_grad_enabled(True):

                    if debug:
                        trloss = 0.0
                        trloss_te = 0.0
                        trloss_im = 0.0

                        if save_gradient:

                            te_lr_str = ""
                            for param_group in optimizer_text.param_groups:
                                te_lr_str += "{:3.8f}".format(param_group['lr'])

                            im_lr_str = ""
                            for param_group in optimizer_image.param_groups:
                                im_lr_str += "{:3.8f}".format(param_group['lr'])

                            lr_str = "[te: {}|im: {}]".format(te_lr_str, im_lr_str)
                        else:
                            lr_str = ""
                            for param_group in optimizer.param_groups:
                                lr_str += "{:3.8f}".format(param_group['lr'])
                    else:
                        if save_gradient:
                            logits_image_text, logits_image_text_fiximage, logits_image_text_fixtext = \
                                model(images, tokens)

                            loss_text = cross_entropy_loss(logits_image_text_fiximage.T, labels)/accu_steps
                            loss_image = cross_entropy_loss(logits_image_text_fixtext, labels)/accu_steps

                            loss_text.backward()
                            loss_image.backward()

                            trloss_te = loss_text.item()*accu_steps
                            trloss_im = loss_image.item()*accu_steps

                            trloss = (trloss_te + trloss_im) / 2

                            te_lr_str = ""
                            for param_group in optimizer_text.param_groups:
                                te_lr_str += "{:3.8f}".format(param_group['lr'])

                            im_lr_str = ""
                            for param_group in optimizer_image.param_groups:
                                im_lr_str += "{:3.8f}".format(param_group['lr'])

                            lr_str = "[te: {}|im: {}]".format(te_lr_str, im_lr_str)
                        else:
                            logits_image_text = model(images, tokens)

                            loss = ((cross_entropy_loss(logits_image_text, labels) +
                                    cross_entropy_loss(logits_image_text.T, labels)) / 2) / accu_steps

                            loss.backward()

                            trloss = loss.item()*accu_steps
                            trloss_te = None
                            trloss_im = None

                            lr_str = ""
                            for param_group in optimizer.param_groups:
                                lr_str += "{:3.8f}".format(param_group['lr'])

                    train_seq.set_description("{:3.3} TLoss: {:.4f} LR: {}, REGROWS: {}".
                                              format(epoch + step / total_steps, trloss, lr_str,
                                                     train_batch_sampler.regrows))

                    if save_gradient:
                        log_entry = {'telr{}'.format(i): pg['lr'] for i, pg in enumerate(optimizer_text.param_groups)}
                        log_entry.update({'imlr{}'.format(i):
                                              pg['lr'] for i, pg in enumerate(optimizer_image.param_groups)})
                    else:
                        log_entry = {'lr{}'.format(i): pg['lr'] for i, pg in enumerate(optimizer.param_groups)}

                    log_entry['trloss'] = trloss

                    if save_gradient:
                        log_entry['trloss_te'] = trloss_te
                        log_entry['trloss_im'] = trloss_im

                    log_entry['update_counter'] = update_counter

                    log_entry['elapsed'] = time.time() - start

                    train_log.append(log_entry)

            if save_gradient:
                optimizer_text.step()
                optimizer_image.step()

                optimizer_text.zero_grad()
                optimizer_image.zero_grad()
            else:
                optimizer.step()
                optimizer.zero_grad()

            if sched is not None:
                sched.step(update_counter)

            if sched_text is not None:
                sched_text.step(update_counter)

            if sched_image is not None:
                sched_image.step(update_counter)

            update_counter += 1

            if not debug and test_interval is not None and test_data_json is not None \
                    and (step+1) % test_interval == 0:

                teloss, teloss_te, teloss_im = test(device, model, test_dataset, test_batch_sampler, tokenizer,
                                                    batch_size, num_workers)

                log_entry['teloss'] = teloss
                log_entry['teloss_te'] = teloss_te
                log_entry['teloss_im'] = teloss_im

                if teloss < teloss_prev:

                    torch.save(model.state_dict(), model_file)
                    teloss_prev = teloss

            if (len(train_log) + 1) % save_interval == 0:
                pd.DataFrame.from_records(train_log).to_pickle(log_file)

        if sched_epoch is not None:
            sched_epoch.step()

        if sched_epoch_text is not None:
            sched_epoch_text.step()

        if sched_epoch_image is not None:
            sched_epoch_image.step()

    pd.DataFrame.from_records(train_log).to_pickle(log_file)



