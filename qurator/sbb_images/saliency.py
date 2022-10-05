
import argparse
import torch
import torch.nn.functional as F
# import torch.nn as nn

from torchvision import transforms
# noinspection PyUnresolvedReferences
from annoy import AnnoyIndex


def load_saliency_model(vit_model, vst_model):
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    from RGB_VST.Models.ImageDepthNet import ImageDepthNet

    model_args = argparse.Namespace()
    model_args.pretrained_model = vit_model
    model_args.img_size = 224

    saliency_model = ImageDepthNet(model_args)
    saliency_model.to(device)
    saliency_model.eval()

    state_dict = torch.load(vst_model)
    from collections import OrderedDict

    new_state_dict = OrderedDict()
    for k, v in state_dict.items():
        name = k[7:]  # remove `module.`
        new_state_dict[name] = v

    # load params
    saliency_model.load_state_dict(new_state_dict)
    print('VST Model loaded from {}'.format(vst_model))

    img_transform = transforms.Compose([
        transforms.Scale((model_args.img_size, model_args.img_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),  # 处理的是Tensor
    ])

    def predict(image):

        print(image.width, image.height)

        back_transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((image.height, image.width))
        ])

        img = img_transform(image)

        img = img.unsqueeze(0).to(device)

        with torch.set_grad_enabled(False):
            outputs_saliency, outputs_contour = saliency_model(img)

            mask_1_16, mask_1_8, mask_1_4, mask_1_1 = outputs_saliency

            outputs_saliency = F.sigmoid(mask_1_1)

        outputs_saliency = outputs_saliency.data.cpu().squeeze(0).detach()

        saliency_map = back_transform(outputs_saliency)

        return saliency_map

    return predict
