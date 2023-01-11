from torchvision.datasets.folder import default_loader
from torch.utils.data import Dataset

from PIL import Image

import json
import pandas as pd
import iconclass


class IconClassDataset(Dataset):

    def __init__(self, json_file, loader=default_loader, lang='de', transform=None):

        super(Dataset, self).__init__()

        self.transform = transform

        self.loader = loader
        self._lang = lang

        with open(json_file) as f:
            df = json.load(f)

        df = pd.DataFrame.from_dict(df, orient='index')

        self.samples = df

    def __getitem__(self, index):

        sample = self.samples.iloc[index]

        file = sample.name
        targets = [iconclass.get(t)['txt'][self._lang] for t in sample.dropna().to_list()]

        try:
            img = self.loader(file)
        except Exception as e:
            print('Something went wrong on image {} : {}'.format(file, e))
            print('Providing dummy result ...')
            img = Image.new('RGB', (256, 256))

        if self.transform is not None:
            img = self.transform(img)

        return img, targets

    def __len__(self):
        return len(self.samples)
