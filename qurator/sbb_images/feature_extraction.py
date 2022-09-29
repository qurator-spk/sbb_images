import argparse
import torch
import torch.nn as nn

from torchvision import models, transforms
# noinspection PyUnresolvedReferences
from annoy import AnnoyIndex


def load_extraction_model(model_name, layer_name='fc', layer_output=False, vit_model=None, vst_model=None):

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    if vit_model is not None and vst_model is not None:

        from RGB_VST.Models.ImageDepthNet import ImageDepthNet

        model_args = argparse.Namespace()
        model_args.pretrained_model = vit_model
        model_args.img_size = 224

        model_extr = ImageDepthNet(model_args)
        model_extr.to(device)
        model_extr.eval()

        # load model (multi-gpu)
        # model_path = args.save_model_dir + 'RGB_VST.pth'
        state_dict = torch.load(vst_model)
        from collections import OrderedDict

        new_state_dict = OrderedDict()
        for k, v in state_dict.items():
            name = k[7:]  # remove `module.`
            new_state_dict[name] = v

        # load params
        model_extr.load_state_dict(new_state_dict)
        print('VST Model loaded from {}'.format(vst_model))

        extract_transform = transforms.Compose([
            transforms.Scale((model_args.img_size, model_args.img_size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),  # 处理的是Tensor
        ])
    else:
        input_size = {'inception_v3': 299}

        img_size = input_size.get(model_name, 224)

        extract_transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(img_size),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

        model_extr = getattr(models, model_name)(pretrained=True)

        for p in model_extr.parameters():
            p.requires_grad = False

        model_extr = model_extr.to(device)
        model_extr.eval()

    layer = getattr(model_extr, layer_name, None)

    if layer is None:
        raise RuntimeError('Layer not available.')

    fe = None

    def fw_hook(_layer, _input, _output):
        nonlocal fe

        if layer_output:
            fe = _output.detach().to('cpu').numpy()
        else:
            fe = _input[0].detach().to('cpu').numpy()

    layer.register_forward_hook(fw_hook)

    def extract_features(inputs):

        inputs = inputs.to(device)

        with torch.set_grad_enabled(False):
            model_extr(inputs)

        assert (len(inputs) == len(fe))

        return fe

    return extract_features, extract_transform
