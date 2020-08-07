import pandas as pd
import numpy as np
from multiprocessing import Pool
from functools import partial
from tqdm import tqdm


def _summarize_detections(iou_thres, task):
    path, part = task

    part = part.sort_values('area', ascending=False)

    if len(part) < 2:
        return part

    cleared = []
    while len(part) > 0:

        box = part.iloc[0].copy()
        other = part.iloc[1:].copy()

        inter_rect_x1 = other.x1.clip(lower=box.x1)
        inter_rect_y1 = other.y1.clip(lower=box.y1)

        inter_rect_x2 = other.x2.clip(upper=box.x2)
        inter_rect_y2 = other.y2.clip(upper=box.y2)

        inter_area = (inter_rect_x2 - inter_rect_x1 + 1.0).clip(lower=0) * \
                     (inter_rect_y2 - inter_rect_y1 + 1.0).clip(lower=0)

        box_area = (box.x2 - box.x1 + 1.0) * (box.y2 - box.y1 + 1.0)
        other_area = (other.x2 - other.x1 + 1.0) * (other.y2 - other.y1 + 1.0)

        iou = inter_area / (box_area + other_area - inter_area + 1e-16)

        iou = iou.loc[iou > iou_thres]

        if len(iou) == 0:
            cleared.append(part.iloc[[0]])
            part = other
            continue

        summed = iou.index.to_list() + [box.name]

        summarize_part = part.loc[summed]
        keep_part = part.loc[~part.index.isin(summed)]

        sum_x1 = summarize_part.x1.min()
        sum_y1 = summarize_part.y1.min()

        sum_x2 = summarize_part.x2.max()
        sum_y2 = summarize_part.y2.max()

        sum_w = sum_x2 - sum_x1
        sum_h = sum_y2 - sum_y1
        sum_area = sum_w * sum_h

        sum_conf = summarize_part.conf.max()

        summarize_part = pd.DataFrame([(path, sum_x1, sum_y1, sum_w, sum_h, sum_conf,
                                        sum_x2, sum_y2, sum_area)], columns=part.columns)

        part = pd.concat([summarize_part, keep_part]).reset_index(drop=True).sort_values('area', ascending=False)

    return pd.concat(cleared)


def summarize_detections(detections, iou_thres, area_thres, processes, max_iter=np.inf):

    tmp = detections.copy().reset_index(drop=True).sort_index()
    tmp['x2'] = tmp.x1 + tmp.box_w
    tmp['y2'] = tmp.y1 + tmp.box_h
    tmp['area'] = tmp.box_w * tmp.box_h

    tmp = tmp.loc[tmp.area >= area_thres]

    summarized = []

    with Pool(processes=processes) as pool:

        for part in pool.imap(partial(_summarize_detections, iou_thres), tqdm(tmp.groupby('path'))):

            summarized.append(part)

            if len(summarized) > max_iter:
                break

    return pd.concat(summarized)
