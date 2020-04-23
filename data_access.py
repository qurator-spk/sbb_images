from torchvision.datasets.folder import default_loader
from torch.utils.data import Dataset


class AnnotatedDataset(Dataset):

    def __init__(self, samples, targets, loader=default_loader, transform=None):

        super(Dataset, self).__init__()

        self.transform = transform

        self.loader = loader
        self.samples = samples
        self.targets = targets

    def __getitem__(self, index):

        path, target = self.samples[index], self.targets[index] if self.targets is not None else -1
        sample = self.loader(path)
        if self.transform is not None:
            sample = self.transform(sample)

        return sample, target

    def __len__(self):
        return len(self.samples)
