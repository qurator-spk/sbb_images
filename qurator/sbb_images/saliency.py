from tqdm import tqdm
import argparse
import torch
import torch.nn.functional as F
# import torch.nn as nn
import io
from torchvision import transforms
# noinspection PyUnresolvedReferences
from annoy import AnnoyIndex

import PIL
from PIL import Image, ImageDraw, ImageOps, ImageFilter

import cv2
import numpy as np
import pandas as pd

import click
import sqlite3

from torch.utils.data import DataLoader
from .data_access import AnnotatedDataset, SqliteDataset
from .parallel import run_unordered as prun_unordered


def load_saliency_model(vit_model, vst_model):
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    from RGB_VST.Models.ImageDepthNet import ImageDepthNet

    model_args = argparse.Namespace()
    model_args.pretrained_model = vit_model
    model_args.img_size = 224

    saliency_model = ImageDepthNet(model_args)
    saliency_model.to(device)
    saliency_model.eval()

    state_dict = torch.load(vst_model)
    from collections import OrderedDict

    new_state_dict = OrderedDict()
    for k, v in state_dict.items():
        name = k[7:]  # remove `module.`
        new_state_dict[name] = v

    # load params
    saliency_model.load_state_dict(new_state_dict)
    print('VST Model loaded from {}'.format(vst_model))

    predict_transform = transforms.Compose([
        transforms.Scale((model_args.img_size, model_args.img_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),  # 处理的是Tensor
    ])

    def predict(inputs):

        # print(image.width, image.height)

        # img = predict_transform(image)

        # print(len(inputs.shape))
        # img = img.unsqueeze(0).to(device)

        if len(inputs.shape) < 4:
            inputs = inputs.unsqueeze(0)

        inputs = inputs.to(device)

        with torch.set_grad_enabled(False):
            outputs_saliency, outputs_contour = saliency_model(inputs)

            mask_1_16, mask_1_8, mask_1_4, mask_1_1 = outputs_saliency

            outputs_saliency = F.sigmoid(mask_1_1)

            outputs_saliency = outputs_saliency.data.cpu().squeeze(0).detach()

        # saliency_map = []
        #
        # for pos, (width, height) in enumerate(zip(widths, heights)):
        #     back_transform = transforms.Compose([
        #         transforms.ToPILImage(),
        #         transforms.Resize((width, height))
        #     ])
        #
        #     saliency_map.append(back_transform(outputs_saliency[pos]))

        return outputs_saliency

    return predict, predict_transform


def process_region(predict_saliency, predict_transform, full_img, rx, ry, rwidth, rheight, quant=10.0):

    img = full_img

    if rx >= 0 and ry >= 0 and rwidth > 0 and rheight > 0:
        img = full_img.crop((full_img.size[0] * rx, full_img.size[1] * ry,
                             full_img.size[0] * rx + rwidth * full_img.size[0],
                             full_img.size[1] * ry + rheight * full_img.size[1]))

    back_transform = transforms.Compose([
                 transforms.ToPILImage(),
                 transforms.Resize((img.height, img.width))
             ])

    saliency_img = back_transform(predict_saliency(predict_transform(img))).convert("L")

    local_mask = Image.fromarray(np.zeros((full_img.height, full_img.width))).convert("L")

    local_mask.paste(saliency_img, (int(full_img.size[0] * rx), int(full_img.size[1] * ry)))

    boolean_mask = local_mask.point(lambda p: 0 if p < 64 else 255)

    num_components, component_labels, c_stats, centroids = \
        cv2.connectedComponentsWithStats(np.asarray(boolean_mask))

    c_stats = pd.DataFrame(c_stats, columns=['x', 'y', 'width', 'height', 'area'])

    c_stats.x = (quant*c_stats.x / full_img.width).round(1)/int(quant)
    c_stats.width = (quant*c_stats.width / full_img.width).round(1)/int(quant)

    c_stats.y = (quant*c_stats.y / full_img.height).round(1)/int(quant)
    c_stats.height = (quant*c_stats.height / full_img.height).round(1)/int(quant)

    return c_stats[1:], local_mask


def find_all_regions(predict_saliency, predict_transform, full_img, search_regions, regions=None):
    cc_stats = []

    if regions is not None:
        max_area = max([search_regions.area.max(), regions.area.max()])
    else:
        max_area = search_regions.area.max()

    for _, (rx, ry, rwidth, rheight, rarea) in search_regions.iterrows():

        if regions is not None and (rx, ry, rwidth, rheight) in regions:
            # print("skip")
            continue

        if max_area > 0 and rarea / max_area < 1e-2:
            # print("skip")
            continue

        # print(rx, ry, rwidth, rheight)

        _cc_stats, _ = process_region(predict_saliency, predict_transform, full_img, rx, ry, rwidth, rheight)

        cc_stats.append(_cc_stats)

    if len(cc_stats) == 0:
        regions = regions.reset_index()

        regions.x *= full_img.width
        regions.width *= full_img.width

        regions.y *= full_img.height
        regions.height *= full_img.height

        regions = regions.drop_duplicates(subset=['x', 'y', 'width'])
        regions = regions.drop_duplicates(subset=['x', 'y', 'height'])

        return regions

    if regions is not None:
        regions = pd.concat([regions, search_regions.set_index(['x', 'y', 'width', 'height'])])
    else:
        regions = search_regions.set_index(['x', 'y', 'width', 'height'])

    regions = regions[~regions.index.duplicated(keep='first')]

    search_regions = pd.concat(cc_stats).drop_duplicates(subset=['x', 'y', 'width', 'height'])

    search_regions = search_regions.loc[
        ~search_regions.set_index(['x', 'y', 'width', 'height']).index.isin(regions.index)]

    return find_all_regions(predict_saliency, predict_transform, full_img, search_regions, regions)


class SaliencyROITask:

    predict_saliency = None
    predict_saliency_transform = None

    def __init__(self, filename, scale_factor, img):

        self.img = img
        self.filename = filename
        self.scale_factor = scale_factor

    def __call__(self, *args, **kwargs):

        # noinspection PyBroadException
        try:
            search_regions = [(0, 0, 1.0, 1.0, 0.0)]

            for offset in [0.01, 0.05, 0.1]:
                search_regions.append(
                    (min([1.0, offset]), min([1.0, offset]),
                     max([0.0, 1.0 - 2 * offset]), max([0.0, 1.0 - 2 * offset]), 0.0))

            search_regions = pd.DataFrame(search_regions, columns=['x', 'y', 'width', 'height', 'area'])

            all_stats = find_all_regions(SaliencyROITask.predict_saliency, SaliencyROITask.predict_saliency_transform,
                                         self.img, search_regions)

            return self.filename, self.scale_factor, all_stats
        except:
            print("Error processing file: {}".format(self.filename))
            return None, None, None

    @staticmethod
    def initialize(vit_model, vst_model):

        SaliencyROITask.predict_saliency, SaliencyROITask.predict_saliency_transform = \
            load_saliency_model(vit_model, vst_model)


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.argument('detections-file', type=click.Path(exists=False))
@click.option('--batch-size', type=int, default=32, help="Process batch-size. default: 32.")
@click.option('--num-workers', type=int, default=0, help="Number of parallel workers during index creation."
                                                         "Default 8.")
@click.option('--vit-model', type=click.Path(exists=True), default=None,
              help='Vision transformer pytorch model file (required by Visual Saliency Transformer).')
@click.option('--vst-model', type=click.Path(exists=True), default=None,
              help='Visual saliency transformer pytorch model file.')
@click.option('--pad-to-square', is_flag=False, help="Pad-to-square before application of model image transform"
                                                     " (typically resize + center-crop).")
@click.option('--thumbnail-table-name', type=str, default='None', help="Do not read the image from the file system"
                                                                       " but rather try to read them from this table"
                                                                       " in the thumbnail sqlite file.")
def saliency_roi_detect(sqlite_file, detections_file, batch_size, num_workers, vit_model, vst_model, pad_to_square,
                        thumbnail_table_name, save_interval=100):
    """

    """

    if thumbnail_table_name is None:
        thumbnail_table_name = "images"

    roi = []

    def get_roi_tasks():

        with sqlite3.connect(sqlite_file) as conn:

            conn.execute('pragma journal_mode=wal')

            num_files = conn.execute("SELECT count(*) FROM {}".format(thumbnail_table_name)).fetchone()[0]

            print("Number of files {}.".format(num_files))

            seq = tqdm(range(0, num_files), desc="Extract saliency ROIs ...")

            for pos in seq:

                seq.set_description("Extract saliency ROIs (found {})".format(len(roi)))

                result = conn.execute("SELECT filename, data, scale_factor FROM {}"
                                      " WHERE rowid=?".format(thumbnail_table_name), (pos,)).fetchone()
                if result is None:
                    continue

                f_name, data, s_factor = result

                buffer = io.BytesIO(data)

                img = Image.open(buffer).convert('RGB')

                yield SaliencyROITask(str(f_name), float(s_factor), img)

    for filename, scale_factor, all_stats in prun_unordered(get_roi_tasks(), initializer=SaliencyROITask.initialize,
                                                            initargs=(vit_model, vst_model), processes=num_workers,
                                                            method='forkserver'):
        if filename is None:
            continue

        full_area = all_stats.area.max()

        for i, (rx, ry, rwidth, rheight, rarea) in all_stats.iterrows():

            if rarea / full_area < 1e-2:
                continue

            # print(rarea / full_area)

            roi.append([filename, int(rx/scale_factor), int(ry/scale_factor),
                        int((rx + rwidth)/scale_factor), int((ry + rheight)/scale_factor)])

            if len(roi) % save_interval == 0:
                pd.DataFrame(roi, columns=['path', 'x1', 'y1', 'box_w', 'box_h']).to_pickle(detections_file)

    roi = pd.DataFrame(roi, columns=['path', 'x1', 'y1', 'box_w', 'box_h'])

    roi.to_pickle(detections_file)
