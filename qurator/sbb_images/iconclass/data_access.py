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
# from copy import deepcopy


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


class IconClassRandomSampler(Sampler):

    def __init__(self, json_file):
        super(Sampler, self).__init__()

        with open(json_file) as f:
            df = json.load(f)

        df = pd.DataFrame.from_dict(df, orient='index')

        self.samples = df
        self.samples = self.samples.replace('', None).dropna(how='all')

        self.samples = IconClassRandomSampler.parse(self.samples)

        self.lookup = self.samples
        self.lookup['pos'] = [i for i in range(0, len(self.lookup))]

        self.files = self.samples.file.unique()

        self.lookup = self.lookup.set_index('file').sort_index()

    def __iter__(self):

        perm = [i for i in range(0, len(self.files))]
        random.shuffle(perm)

        for i in perm:
            file = self.files[i]

            labels = self.lookup.loc[[file]]

            yield random.choice(labels.pos.to_list())

    def __len__(self):

        return len(self.files)

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

    @staticmethod
    def parse(samples):

        iconclass_toplevel = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

        tree_samples = []

        for pos in tqdm(range(0, len(samples)), total=len(samples), desc="Parsing data..."):

            sample = samples.iloc[pos]

            for label in sample.dropna().to_list():

                label = IconClassRandomSampler.fix_classlabel(label)

                target = IconClassDataset.get_text(label)

                if target is None:
                    continue

                sam_parts = iconclass.get_parts(label)

                if len(sam_parts) <= 0:
                    continue

                if sam_parts[0] not in iconclass_toplevel:
                    continue

                tree_samples.append({'file': sample.name, 'target': target, 'label': label})

        tree_samples = pd.DataFrame(tree_samples)

        return tree_samples

    def reset(self):
        pass


class IconClassTreeSampler(Sampler):

    def __init__(self, json_file, auto_reset=None):
        super(Sampler, self).__init__()

        with open(json_file) as f:
            df = json.load(f)

        df = pd.DataFrame.from_dict(df, orient='index')

        self.max_trials = 3000

        self.auto_resets = 0
        if auto_reset is None:
            self.auto_reset = self.max_trials + 1
        else:
            self.auto_reset = auto_reset

        self.samples = df.replace('', None).dropna(how='all')

        self.tree, self.samples = IconClassTreeSampler.make_tree(self.samples)
        self.tree_size = len(self.samples)

        self.blocked_files = dict()
        self.active_batch = None

    def __iter__(self):

        def find_random_path(tree, level=0):

            available = list(set(tree['active'][self.active_batch]).intersection(set(tree['children'].keys())))

            if len(available) == 0:
                tree['active'][self.active_batch] = list(tree['children'].keys())

                available = tree['active'][self.active_batch]

            if len(available) == 0:
                return list(), list()

            rand_child = random.choice(available)

            bol, rpath = find_random_path(tree['children'][rand_child], level=level + 1)

            for le in tree['children'][rand_child]['leaves']:
                bol.append((le, level))

            return bol, [rand_child] + rpath

        def lock_random_path(tree, path):

            if len(path) == 0:
                return

            lock_random_path(tree['children'][path[0]], path[1:])

            assert (path[0] in tree['active'][self.active_batch])
            tree['active'][self.active_batch].remove(path[0])
            assert (path[0] in tree['children'])

        def remove_leaf(parts, file, tree):

            if len(parts) == 1:
                assert (file in tree['children'][parts[0]]['leaves'])

                tree['children'][parts[0]]['leaves'].remove(file)

                if len(tree['children'][parts[0]]['leaves']) == 0 and len(tree['children'][parts[0]]['children']) == 0:
                    del tree['children'][parts[0]]
            else:
                delete_subtree = remove_leaf(parts[1:], file, tree['children'][parts[0]])

                if delete_subtree:
                    del tree['children'][parts[0]]

            return len(tree['children']) == 0 and len(tree['leaves']) == 0

        while self.tree_size > 0:
            for trial in range(0, self.max_trials):
                bag_of_leaves, rand_path = find_random_path(self.tree)

                rand_index, path_level = random.choice(bag_of_leaves)

                rand_file = self.samples.iloc[rand_index].file

                if rand_file not in self.blocked_files[self.active_batch]:
                    break

                if (trial+1) % self.auto_reset == 0:
                    self.reset_tree_active(self.tree, self.active_batch)
                    self.auto_resets += 1
            else:
                break

            self.blocked_files[self.active_batch].add(rand_file)

            lock_random_path(self.tree, rand_path[0:path_level + 1])

            remove_leaf(rand_path[0:path_level + 1], rand_index, self.tree)

            self.tree_size -= 1

            yield rand_index

    def __len__(self):
        return self.tree_size

    @staticmethod
    def reset_tree_active(tree, batch_id, level=0):

        assert(len(tree['leaves']) > 0 or len(tree['children']) > 0)

        if len(tree['leaves']) == 0:
            assert(len(tree['children']) > 0)

        if len(tree['children']) == 0:
            assert(len(tree['leaves']) > 0)

        tree['active'][batch_id] = list()

        for ch in tree['children'].keys():
            IconClassTreeSampler.reset_tree_active(tree['children'][ch], batch_id, level=level + 1)

    def set_active_batch(self, batch_id):
        self.active_batch = batch_id

        if batch_id not in self.blocked_files:
            self.reset_active_batch()

    def reset_active_batch(self):
        if len(self.tree['children']) == 0:
            return

        self.blocked_files[self.active_batch] = set()
        self.reset_tree_active(self.tree, self.active_batch)

    @staticmethod
    def regrow_tree(tree):
        tree['children'] = tree['full_children']
        tree['leaves'] = tree['full_leaves']
        tree['active'] = dict()

        for ch in tree['children'].keys():
            IconClassTreeSampler.regrow_tree(tree['children'][ch])

    def regrow(self):
        self.blocked_files = dict()
        self.tree_size = len(self.samples)
        self.regrow_tree(self.tree)

    @staticmethod
    def make_tree(samples):
        def add_leaf(parts, file, tree):

            if parts[0] not in tree['full_children']:
                tree['full_children'][parts[0]] = {'full_children': dict(), 'full_leaves': list() , 'acitve': dict()}

            if len(parts) == 1:
                tree['full_children'][parts[0]]['full_leaves'].append(file)
                return

            add_leaf(parts[1:], file, tree['full_children'][parts[0]])

            return

        root_of_tree = {'full_children': dict(), 'full_leaves': list(), 'active': dict()}

        tree_samples = IconClassRandomSampler.parse(samples)

        for pos in tqdm(range(0, len(tree_samples)), total=len(tree_samples), desc="Building tree..."):

            sample = tree_samples.iloc[pos]

            sample_parts = iconclass.get_parts(sample.label)

            add_leaf(sample_parts, pos, root_of_tree)

        tree_samples = pd.DataFrame(tree_samples)

        return root_of_tree, tree_samples


class IconClassTreeBatchSampler(Sampler):

    def __init__(self, sampler, batch_size, accu_steps=1, coverage_ratio=1):
        super(Sampler, self).__init__()

        self.sampler = sampler
        self.batch_size = batch_size
        self.accu_steps = accu_steps
        self.coverage_ratio = coverage_ratio
        self.regrows = 0
        self.length = int(self.coverage_ratio * len(self.sampler) / self.batch_size)
        self.batches = None

    def breadth_first_batches(self):
        batches = {batch_num: list() for batch_num in range(0, len(self))}

        self.regrows = 0

        def make_seq():
            self.sampler.regrow()
            self.regrows += 1
            new_seq = iter(self.sampler)

            return new_seq

        completed_batches = 0
        added = 0

        def print_status(the_batch_seq):
            the_batch_seq.set_description("#Added: {} ; #Complete batches: {} ; #Regrows: {} ; "
                                          "#auto_resets: {}".
                                          format(added, completed_batches, self.regrows,
                                                 self.sampler.auto_resets))
        seq = make_seq()
        while completed_batches < len(self):
            progress = 0

            keys = list(batches.keys())
            perm = [i for i in range(0, len(keys))]
            random.shuffle(perm)

            batch_seq = tqdm(perm)

            for p in batch_seq:
                batch_num = keys[p]

                if len(batches[batch_num]) >= self.batch_size * self.accu_steps:
                    continue

                self.sampler.set_active_batch(batch_num)

                sample = next(seq, None)
                if sample is not None:
                    batches[batch_num].append(sample)
                    progress += 1
                    added += 1
                    print_status(batch_seq)

                    if len(batches[batch_num]) >= self.batch_size*self.accu_steps:
                        completed_batches += 1
                        print_status(batch_seq)
                else:
                    seq = make_seq()
                    print_status(batch_seq)

            if progress <= 0:
                seq = make_seq()
                print_status(batch_seq)

        return batches

    def __iter__(self):

        self.batches = self.breadth_first_batches()

        for k in self.batches.keys():

            batch = self.batches[k]

            for accu_step in range(0, self.accu_steps):

                yield batch[accu_step*self.batch_size:(accu_step+1)*self.batch_size]

    def __len__(self):

        return self.length
