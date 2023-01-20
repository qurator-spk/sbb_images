from torchvision.datasets.folder import default_loader
from torch.utils.data import Dataset

from PIL import Image

import json
import pandas as pd
import iconclass
import random
import os.path


class IconClassDataset(Dataset):

    def __init__(self, json_file, test_set_path, loader=default_loader, lang='de', transform=None):

        super(Dataset, self).__init__()

        self.transform = transform

        self.loader = loader
        self._lang = lang

        with open(json_file) as f:
            df = json.load(f)

        df = pd.DataFrame.from_dict(df, orient='index')
        self._test_set_path = test_set_path

        self.samples = df
        self.samples = self.samples.replace('', None).dropna(how='all')

    def __getitem__(self, index):

        sample = self.samples.iloc[index]

        file = sample.name

        targets = []
        for sam in sample.dropna().to_list():

            tmp = iconclass.get(sam)
            if tmp is not None:
                targets.append(tmp)
                continue

            for colon_section in sam.split(':'):
                tmp = iconclass.get(colon_section)

                if tmp is not None:
                    targets.append(tmp)
                    continue

                parts = iconclass.get_parts(colon_section)
                for i in range(1, len(parts)):
                    tmp = iconclass.get(parts[-i])

                    if tmp is not None:
                        break
                else:
                    continue
                    # import ipdb;ipdb.set_trace()

                targets.append(tmp)

        if len(targets) == 0:
            print("ICONCLASS ERROR: >{}<".format(sam))
            targets = ['Unkown']
            # import ipdb;ipdb.set_trace()
        else:
            targets = [t['txt'][self._lang] for t in targets]

        try:
            img = self.loader(os.path.join(self._test_set_path, file))
        except Exception as e:
            print('Something went wrong on image {} : {}'.format(file, e))
            print('Providing dummy result ...')
            img = Image.new('RGB', (256, 256))

        if self.transform is not None:
            img = self.transform(img)

        return img, random.choice(targets)

    def __len__(self):
        return len(self.samples)
