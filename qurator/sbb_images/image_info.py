import click
import pandas as pd
import os
from tqdm import tqdm

import PIL
from .parallel import run as prun


class ExtractImageInfo:

    def __init__(self, filename):

        self._filename = filename

    def __call__(self, *args, **kwargs):

        try:
            with PIL.Image.open(self._filename) as img:

                img_info = {'filename': self._filename, 'format': img.format, 'mode': img.mode,
                            'width': img.width, 'height': img.height}

                if 'dpi' in img.info:
                    img_info['dpi'] = min(img.info['dpi'])

                if 'compression' in img.info:
                    img_info['compression'] = img.info['compression']

                return img_info

        except Exception as e:

            print('Something went wrong with file {}: {}'.format(self._filename, e))

            return None


@click.command()
@click.argument('path', type=click.Path(exists=True))
@click.argument('outfile', type=click.Path(exists=False))
@click.option('--max-count', type=int, default=0, help="Maximum number of files to process. Default: no limit.")
@click.option('--processes', type=int, default=8, help="Number of concurrent processes. Default: 8")
def cli(path, outfile, max_count, processes, file_types=('.tif', '.jpeg', '.jpg', '.png', '.gif')):

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

        if 0 < max_count < len(img_infos):
            break

    df = pd.DataFrame(img_infos)

    df.to_pickle(outfile)