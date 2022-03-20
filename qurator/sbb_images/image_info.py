import click
import pandas as pd
import os
from tqdm import tqdm

import PIL
import PIL.Image
import PIL.ExifTags

from .parallel import run as prun


class ExtractImageInfo:

    def __init__(self, filename):

        self._filename = filename

    def __call__(self, *args, **kwargs):

        try:
            with PIL.Image.open(self._filename) as img:

                img_info = {'filename': self._filename, 'size': os.path.getsize(self._filename), 'format': img.format,
                            'format_description': img.format_description, 'mimetype': img.get_format_mimetype(),
                            'mode': img.mode,
                            'width': img.width, 'height': img.height,
                            'entropy': img.entropy(), 'bits': img.bits}

                if 'dpi' in img.info:
                    img_info['dpi'] = min(img.info['dpi'])

                if 'compression' in img.info:
                    img_info['compression'] = img.info['compression']

                try:
                    for band, e in zip(img.getbands(), img.getextrema()):
                        img_info['{}_min'.format(band)] = e[0]
                        img_info['{}_max'.format(band)] = e[1]

                except Exception as e:
                    print('Problem during extrema extraction in file {} : {}'.format(self._filename, e))

                try:
                    ex = img.getexif()

                    for k, v in PIL.ExifTags.TAGS.items():
                        if k in ex:
                            img_info[v] = ex[k]

                except Exception as e:
                    print('Problem during exif extraction in file {} : {}'.format(self._filename, e))

                return img_info

        except Exception as e:

            print('Something went wrong with file {} : {}'.format(self._filename, e))

            return None


@click.command()
@click.argument('path', type=click.Path(exists=True))
@click.argument('outfile', type=click.Path(exists=False))
@click.option('--max-count', type=int, default=0, help="Maximum number of files to process. Default: no limit.")
@click.option('--processes', type=int, default=8, help="Number of concurrent processes. Default: 8")
@click.option('--storage-interval', type=int, default=1000000,
              help="Store intermediate results in intervals. Default: 10^6.")
def cli(path, outfile, max_count, processes, storage_interval, file_types=('.tif', '.jpeg', '.jpg', '.png', '.gif')):

    def file_it():
        dirs = [d for d in os.scandir(path)]

        for d in tqdm(dirs):

            if not os.path.isdir(d):
                continue

            for f in os.scandir(d):

                if not f.path.endswith(file_types):
                    continue

                yield ExtractImageInfo(f.path)

    img_infos = []

    for img_info in prun(file_it(), processes=processes):

        if img_info is None:
            continue

        img_infos.append(img_info)

        if len(img_info) > 0 and len(img_info) % storage_interval == 0:
            pd.DataFrame(img_infos).to_pickle(outfile)

        if 0 < max_count < len(img_infos):
            break

    pd.DataFrame(img_infos).to_pickle(outfile)
