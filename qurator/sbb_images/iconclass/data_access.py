from torchvision.datasets.folder import default_loader
from torch.utils.data import Dataset, Sampler

from PIL import Image

import json
import pandas as pd
import iconclass
import random
import os.path
import random
from tqdm import tqdm


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
        sam = None
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


class IconClassSampler(Sampler):

    def __init__(self, samples, total_batch_size):
        super(Sampler, self).__init__()

        self.samples = samples
        self.total_batch_size = total_batch_size
        self.blocked = set()

        self.tree = self.make_tree()

    def __iter__(self):

        def find_random_path(tree):

            if len(tree['children']) == 0:
                return dict()

            rand_child = random.choice(tuple(tree['children'].keys()))

            rand_path = find_random_path(tree['children'][rand_child])

            if len(tree['children'][rand_child]['leaves']) > 0:
                rand_path[rand_child] = tree['children'][rand_child]['leaves']

            return rand_path

        while True:

            candidates = set()
            next_rand_path = dict()

            while len(candidates) == 0:
                next_rand_path = find_random_path(self.tree)

                candidates = set(next_rand_path.keys()).difference(self.blocked)

                if len(candidates) == 0:
                    continue

            selection = random.choice(tuple(candidates))

            selected_leaves = next_rand_path[selection]

            rand_leaf = random.choice(selected_leaves)

            self.blocked.add(rand_leaf)

            yield rand_leaf

    def __len__(self):
        return 0

    def reset(self):
        self.blocked = set()

    def make_tree(self):

        def add_leaf(parts, file, tree):

            if parts[0] not in tree['children']:
                tree['children'][parts[0]] = {'children': dict(), 'leaves': list()}

            if len(parts) == 1:
                tree['children'][parts[0]]['leaves'].append(file)
                return

            add_leaf(parts[1:], file, tree['children'][parts[0]])

            return

        root_of_tree = {'children': dict()}

        for index in tqdm(self.samples.index, total=len(self.samples), desc="Building tree..."):

            sample = self.samples.iloc[index]

            for sam in sample.dropna().to_list():

                sam_parts = iconclass.get_parts(sam)

                if len(sam_parts) > 0:
                    add_leaf(sam_parts, sample.name, root_of_tree)
                    continue

                for colon_section in sam.split(':'):
                    col_parts = iconclass.get(colon_section)

                    if len(sam_parts) > 0:
                        add_leaf(col_parts, sample.name, root_of_tree)

        return root_of_tree
