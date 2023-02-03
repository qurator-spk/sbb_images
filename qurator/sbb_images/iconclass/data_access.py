from torchvision.datasets.folder import default_loader
from torch.utils.data import Dataset, Sampler

from PIL import Image

import re
import json
import pandas as pd
import iconclass
import random
import os.path
import random
from tqdm import tqdm


class IconClassDataset(Dataset):

    def __init__(self, samples, test_set_path, loader=default_loader, lang='de', transform=None):

        super(Dataset, self).__init__()

        self.transform = transform

        self.loader = loader
        self._lang = lang
        self._test_set_path = test_set_path

        self.samples = samples

    def __getitem__(self, index):

        sample = self.samples.iloc[index]

        file = sample.file
        target = sample.target

        try:
            img = self.loader(os.path.join(self._test_set_path, file))
        except Exception as e:
            print('Something went wrong on image {} : {}'.format(file, e))
            print('Providing dummy result ...')
            img = Image.new('RGB', (256, 256))

        if self.transform is not None:
            img = self.transform(img)

        return img, target

    def __len__(self):
        return len(self.samples)


class IconClassSampler(Sampler):

    def __init__(self, json_file):
        super(Sampler, self).__init__()

        with open(json_file) as f:
            df = json.load(f)

        df = pd.DataFrame.from_dict(df, orient='index')

        self.samples = df
        self.samples = self.samples.replace('', None).dropna(how='all')

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
        return len(self.samples)

    def reset(self):
        self.blocked = set()

    @staticmethod
    def fix_classlabel(label):

        if label.endswith('()') or label.endswith('[]'):
            label = label[:-2]

        if label.endswith('(') or label.endswith('['):
            label = label[:-1]

        if re.match('.+\([^)]*$', label):
            label = label + ")"

        m = re.match('>(.*)<', label)

        if m:
            label = m.group(1)

        label = label.strip()

        label = label.replace(' (', '(')
        label = label.replace(') ', ')')

        return label

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

        tree_samples = []

        for pos in tqdm(range(0, len(self.samples)), total=len(self.samples), desc="Building tree..."):

            sample = self.samples.iloc[pos]

            for sam in sample.dropna().to_list():

                sam = IconClassSampler.fix_classlabel(sam)

                sam_parts = iconclass.get_parts(sam)

                if len(sam_parts) > 0:

                    add_leaf(sam_parts, len(tree_samples), root_of_tree)

                    tree_samples.append({'file': sample.name, 'target': sam})
                    continue

                for colon_section in sam.split(':'):
                    colon_section = IconClassSampler.fix_classlabel(colon_section)

                    col_parts = iconclass.get(colon_section)

                    if len(sam_parts) > 0:
                        add_leaf(col_parts, len(tree_samples), root_of_tree)
                        tree_samples.append({'file': sample.name, 'target': sam})

        root_of_tree['children'] = \
            {k: root_of_tree['children'][k] for k in ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']}

        tree_samples = pd.DataFrame(tree_samples)

        self.samples = tree_samples

        return root_of_tree
