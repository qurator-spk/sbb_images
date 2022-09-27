import torch
import torch.nn as nn

from torchvision import models, transforms
# noinspection PyUnresolvedReferences
from annoy import AnnoyIndex


def load_extraction_model(model_name):

    if model_name == "VST":
        pass
    else:

        input_size = {'inception_v3': 299}
        classifcation_layer_names = {}

        img_size = input_size.get(model_name, 224)
        classification_layer_name = classifcation_layer_names.get(model_name, 'fc')

        extract_transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(img_size),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

        device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

        model_extr = getattr(models, model_name)(pretrained=True)

        for p in model_extr.parameters():
            p.requires_grad = False

        model_extr = model_extr.to(device)

        # noinspection PyUnresolvedReferences
        setattr(model_extr, classification_layer_name, nn.Identity())

        model_extr.eval()

    return model_extr, extract_transform, device
