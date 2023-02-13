from torchvision.datasets.folder import default_loader
from torch.utils.data import Dataset, Sampler

from PIL import Image

import re
import json
import pandas as pd
import iconclass
import os.path
import random
from tqdm import tqdm
from copy import deepcopy


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

    @staticmethod
    def get_text(target):
        target_text = ""

        for part in target.split(":"):
            res = iconclass.get(part)

            if res is None:
                return None

            text = res["txt"]["en"]

            if len(target_text) > 0:
                target_text += " : "

            target_text += " " + text

        return target_text


class IconClassSampler(Sampler):

    def __init__(self, json_file, auto_reset=None):
        super(Sampler, self).__init__()

        with open(json_file) as f:
            df = json.load(f)

        df = pd.DataFrame.from_dict(df, orient='index')

        self.max_trials = 3000

        if auto_reset is None:
            self.auto_reset = self.max_trials + 1
        else:
            self.auto_reset = auto_reset

        self.samples = df
        self._length = 0
        self.samples = self.samples.replace('', None).dropna(how='all')

        self.full_tree = self.make_tree()
        self.tree = deepcopy(self.full_tree)

        self.blocked_files = set()
        self.reset()

    def __iter__(self):

        def find_random_path(tree, level=0):

            if len(tree['active']) == 0:
                tree['active'] = list(tree['children'].keys())

            if len(tree['active']) == 0:
                return list(), list()

            rand_child = random.choice(tree['active'])

            bol, rand_path = find_random_path(tree['children'][rand_child], level=level + 1)

            for le in tree['children'][rand_child]['leaves']:
                bol.append((le, level))

            return bol, [rand_child] + rand_path

        def lock_random_path(tree, path):

            if len(path) == 0:
                return

            lock_random_path(tree['children'][path[0]], path[1:])

            assert (path[0] in tree['active'])
            tree['active'].remove(path[0])
            assert (path[0] in tree['children'])

            if len(tree['active']) == 0:
                tree['active'] = list(tree['children'].keys())

        def remove_leaf(parts, file, tree):

            if len(parts) == 1:
                assert (file in tree['children'][parts[0]]['leaves'])

                tree['children'][parts[0]]['leaves'].remove(file)

                if len(tree['children'][parts[0]]['leaves']) == 0 and len(tree['children'][parts[0]]['children']) == 0:
                    del tree['children'][parts[0]]

                    if parts[0] in tree['active']:
                        tree['active'].remove(parts[0])

                        if len(tree['active']) == 0:
                            tree['active'] = list(tree['children'].keys())
            else:
                delete_subtree = remove_leaf(parts[1:], file, tree['children'][parts[0]])

                if delete_subtree:
                    del tree['children'][parts[0]]

                    if parts[0] in tree['active']:
                        tree['active'].remove(parts[0])

                        if len(tree['active']) == 0:
                            tree['active'] = list(tree['children'].keys())

            return len(tree['children']) == 0 and len(tree['leaves']) == 0

        def next_leaf():

            for trial in range(0, self.max_trials):
                bag_of_leaves, rand_path = find_random_path(self.tree)

                rindex, plevel = random.choice(bag_of_leaves)

                rand_file = self.samples.iloc[rindex].file

                if rand_file not in self.blocked_files:
                    self.blocked_files.add(rand_file)

                    return rindex, plevel, rand_path

                if (trial+1) % self.auto_reset == 0:
                    self.reset_active(self.tree)

            raise IndexError()

        self.tree = deepcopy(self.full_tree)
        self.reset()

        for _ in range(0, len(self.samples)):
            try:
                rand_index, path_level, next_rand_path = next_leaf()
            except IndexError:
                break

            lock_random_path(self.tree, next_rand_path[0:path_level + 1])

            remove_leaf(next_rand_path[0:path_level + 1], rand_index, self.tree)

            yield rand_index

    def __len__(self):
        return self._length

    @staticmethod
    def reset_active(tree, level=0):

        assert (len(tree['leaves']) > 0 or len(tree['children']) > 0)

        if len(tree['leaves']) == 0:
            assert (len(tree['children']) > 0)

        if len(tree['children']) == 0:
            assert (len(tree['leaves']) > 0)

        tree['active'] = list(tree['children'].keys())

        for ch in tree['children'].keys():
            IconClassSampler.reset_active(tree['children'][ch], level=level + 1)

    def reset(self):
        if len(self.tree['children']) == 0:
            return

        self.blocked_files = set()
        self.reset_active(self.tree)

    @staticmethod
    def fix_classlabel(label):
        if label.endswith('()') or label.endswith('[]'):
            label = label[:-2]

        if label.endswith('(') or label.endswith('['):
            label = label[:-1]

        if re.match('.+\([^)]*$', label):
            label = label + ")"

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

        root_of_tree = {'children': dict(), 'leaves': list()}

        tree_samples = []

        for pos in tqdm(range(0, len(self.samples)), total=len(self.samples), desc="Building tree..."):

            sample = self.samples.iloc[pos]

            for sam in sample.dropna().to_list():

                sam = IconClassSampler.fix_classlabel(sam)

                target = IconClassDataset.get_text(sam)

                if target is None:
                    continue

                sam_parts = iconclass.get_parts(sam)

                if len(sam_parts) > 0:
                    add_leaf(sam_parts, len(tree_samples), root_of_tree)

                    tree_samples.append({'file': sample.name, 'target': target})
                    continue

        iconclass_toplevel = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

        root_of_tree['children'] = {k: root_of_tree['children'][k] for k in iconclass_toplevel}

        def check_for_reachability(tree):

            reach = list()
            for ch in tree['children'].keys():
                reach += check_for_reachability(tree['children'][ch])

            return tree['leaves'] + reach

        tree_samples = pd.DataFrame(tree_samples)

        self._length = len(check_for_reachability(root_of_tree))

        self.samples = tree_samples

        return root_of_tree


class IconClassBatchSampler(Sampler):

    def __init__(self, sampler, batch_size, accu_steps=1, coverage_ratio=0.5):
        super(Sampler, self).__init__()

        self.sampler = sampler
        self.batch_size = batch_size
        self.accu_steps = accu_steps
        self.coverage_ratio = coverage_ratio
        self.resets = 0

    def __iter__(self):
        iterations = 0
        self.resets = 0
        while iterations < len(self):

            self.sampler.reset()
            seq = iter(self.sampler)

            for b in range(iterations, len(self)):
                batch = list()
                for i in seq:
                    batch.append(i)

                    if len(batch) >= self.batch_size:
                        break

                if len(batch) < self.batch_size:
                    break

                if (b+1) % self.accu_steps == 0:
                    self.sampler.reset()

                iterations += 1
                yield batch

            self.resets += 1

    def __len__(self):

        return int(self.coverage_ratio*len(self.sampler) / self.batch_size)
