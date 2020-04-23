from torch import nn


class FeatureExtractor(nn.Module):
    def __init__(self, features):
        super(FeatureExtractor, self).__init__()
        self.features = features  # nn.Sequential(*features)

    def forward(self, x):
        x = self.features(x)
        return x
