import argparse
import torch
# import torch.nn as nn

from torchvision import models, transforms
# noinspection PyUnresolvedReferences
from annoy import AnnoyIndex

from PIL import Image


def load_extraction_model(model_name, layer_name='fc', layer_output=False, vit_model=None, vst_model=None,
                          clip_model=None, ms_clip_model=None):

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    # import ipdb;ipdb.set_trace()

    model_extr = None
    if vit_model is not None and vst_model is not None:

        from RGB_VST.Models.ImageDepthNet import ImageDepthNet

        model_args = argparse.Namespace()
        model_args.pretrained_model = vit_model
        model_args.img_size = 224

        model_extr = ImageDepthNet(model_args)
        model_extr.to(device)
        model_extr.eval()

        # load model (multi-gpu)
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

        normalization = transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])

    elif clip_model is not None:
        import clip

        model, extract_transform = clip.load(clip_model, device=device)

        def model_extr(inputs):

            inputs = inputs.to(device)

            with torch.set_grad_enabled(False):
                return model.encode_image(inputs).detach().to('cpu').numpy()

        normalization = transforms.Normalize((0.48145466, 0.4578275, 0.40821073), (0.26862954, 0.26130258, 0.27577711))

        return model_extr, extract_transform, normalization

    elif ms_clip_model is not None:
        from msclip.config import config, update_config
        import msclip.models.clip_openai_pe_res_v1 as clip_openai_pe_res_v1

        args = argparse.Namespace()

        args.opts = []
        args.cfg = ms_clip_model
        update_config(config, args)
        config.defrost()
        config.NAME = ""
        config.freeze()

        model,_,_ = clip_openai_pe_res_v1.get_clip_model(config)

        model_file = config.MODEL.PRETRAINED_MODEL
        # logging.info('=> load model file: {}'.format(model_file))
        state_dict = torch.load(model_file, map_location="cpu")
        model.load_state_dict(state_dict)
        model.to(device)

        # logging.info('=> switch to eval mode')
        model_without_ddp = model.module if hasattr(model, 'module') else model
        model_without_ddp.eval()

        extract_transform = transforms.Compose([
            transforms.Resize(224, interpolation=Image.BICUBIC),
            transforms.CenterCrop(size=(224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=config.INPUT.MEAN, std=config.INPUT.STD),
        ])

        normalization = transforms.Normalize(mean=config.INPUT.MEAN, std=config.INPUT.STD)

        def model_extr(inputs):

            inputs = inputs.to(device)

            with torch.set_grad_enabled(False):
                return model_without_ddp.encode_image(inputs).detach().to('cpu').numpy()

        return model_extr, extract_transform, normalization
    else:
        input_size = {'inception_v3': 299}

        img_size = input_size.get(model_name, 224)

        extract_transform = transforms.Compose([
            transforms.Resize(img_size),
            transforms.CenterCrop(img_size),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

        normalization = transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])

        model_extr = getattr(models, model_name)(pretrained=True)

        for p in model_extr.parameters():
            p.requires_grad = False

        model_extr = model_extr.to(device)
        model_extr.eval()

    layer = model_extr
    for key in layer_name.split("."):
        layer = getattr(layer, key, None)

    if layer is None:
        raise RuntimeError('Layer not available.')

    fe = None

    def fw_hook(_layer, _input, _output):

        nonlocal fe
        nonlocal model_extr

        if layer_output:
            fe = _output.detach().to('cpu').numpy()
        else:
            fe = _input[0].detach().to('cpu').numpy()

        fe = fe.reshape(fe.shape[0], -1)

    layer.register_forward_hook(fw_hook)

    def extract_features(inputs):

        inputs = inputs.to(device)

        with torch.set_grad_enabled(False):
            model_extr(inputs)

        assert (len(inputs) == len(fe))

        return fe

    return extract_features, extract_transform, normalization
