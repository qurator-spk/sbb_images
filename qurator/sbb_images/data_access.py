from torchvision.datasets.folder import default_loader
from torch.utils.data import Dataset

from PIL import Image

import sqlite3
import io

import pandas as pd


class AnnotatedDataset(Dataset):

    def __init__(self, samples, targets, loader=default_loader, transform=None, thumbnail_sqlite_file=None,
                 table_name=None, pad_to_square=False, min_size=None, report_skip=False):

        super(Dataset, self).__init__()

        self.transform = transform

        self.loader = loader
        self.samples = samples
        self.targets = targets

        self.sqlite_file = thumbnail_sqlite_file
        self.conn = None
        self.min_size = min_size

        if table_name is None:
            self.table_name = "images"
        else:
            self.table_name = table_name

        self.pad_to_square = pad_to_square
        self.report_skip = report_skip

    def __getitem__(self, index):

        sample = self.samples.iloc[index]

        target = self.targets.iloc[index] if self.targets is not None else -1

        scale_factor = 1.0
        img = None
        skip = False

        if self.sqlite_file is not None:

            if self.conn is None:
                self.conn = sqlite3.connect(self.sqlite_file)

                self.conn.execute('pragma journal_mode=wal')

            thumbs = pd.read_sql('select * from {} where filename=?'.format(self.table_name),
                                 con=self.conn, params=(sample.file,))

            if len(thumbs) > 0:
                max_thumb = thumbs.iloc[thumbs['size'].idxmax()]

                scale_factor = max_thumb.scale_factor

                buffer = io.BytesIO(max_thumb.data)

                img = Image.open(buffer).convert('RGB')

                if self.min_size is not None and \
                        (sample.width*scale_factor < self.min_size or sample.height*scale_factor < self.min_size):
                    img = Image.new('RGB', (256, 256))  # we do not upscale images or image patches that are smaller
                                                        # than min_size
                    skip = True

        if img is None:
            try:
                img = self.loader(sample.file)
            except Exception as e:
                print('Something went wrong on image {} : {}'.format(sample.file, e))
                print('Providing dummy result ...')
                img = Image.new('RGB', (256, 256))
                skip = True

        if 'x' in sample.index and sample.x >= 0 and sample.y >= 0 and sample.width > 0 and sample.height > 0:

            cx = int(sample.x * scale_factor)
            cy = int(sample.y * scale_factor)
            cw = int(sample.width * scale_factor)
            ch = int(sample.height * scale_factor)

            img = img.crop((cx, cy, cx + cw + 1, cy + ch + 1))

        if self.pad_to_square:

            sq_size = max(img.size)

            img_sq = Image.new("RGB", (sq_size, sq_size))

            img_sq.paste(img, ((sq_size - img.size[0]) // 2, (sq_size - img.size[1]) // 2))

            img = img_sq

        if self.min_size is not None and \
                (img.width < self.min_size or img.height < self.min_size):

            # skip mark images or image patches that are smaller than min_size
            skip = True

        if self.transform is not None:
            img = self.transform(img)

        if self.report_skip:
            return img, target, sample.name, skip
        else:
            return img, target, sample.name

    def __len__(self):
        return len(self.samples)


class SqliteDataset(Dataset):

    def __init__(self, sqlite_file, table_name=None):

        super(Dataset, self).__init__()

        if table_name is None:
            self.table_name = "images"
        else:
            self.table_name = table_name

        self.conn = None
        self.sqlite_file = sqlite_file

        with sqlite3.connect(sqlite_file) as conn:

            self.length = conn.execute("SELECT count(*) FROM {}".format(self.table_name)).fetchone()[0]

        print("SQLITE Dataset of size {}.".format(self.length))

    def __getitem__(self, index):

        if self.conn is None:
            self.conn = sqlite3.connect(self.sqlite_file)

            self.conn.execute('pragma journal_mode=wal')

        result = self.conn.execute("SELECT filename, data, scale_factor FROM {} WHERE rowid=?".format(self.table_name),
                                   (index,)).fetchone()
        if result is not None:
            filename, data, scale_factor = result

            buffer = io.BytesIO(data)

            img = Image.open(buffer).convert('RGB')
        else:
            filename = "ERROR-dummy.jpg"

            scale_factor = 1.0

            print('Something went wrong on image {}.'.format(index))
            print('Providing dummy result ...')

            img = Image.new('RGB', (256, 256))

        return filename, img, scale_factor

    def __len__(self):
        return self.length
