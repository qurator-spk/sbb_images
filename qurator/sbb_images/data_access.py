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

        sample = self.samples.iloc[index]

        target = self.targets.iloc[index] if self.targets is not None else -1

        img = self.loader(sample.file)

        if 'x' in sample.index and sample.x >= 0 and sample.y >= 0 and sample.width > 0 and sample.height > 0:
            img = img.crop((sample.x, sample.y, sample.x + sample.width + 1, sample.y + sample.height + 1))

        if self.transform is not None:
            img = self.transform(img)

        return img, target, sample.name

    def __len__(self):
        return len(self.samples)
