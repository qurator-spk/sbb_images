import json
import sqlite3
import click
import pandas as pd
import copy
import os
import io
from fnmatch import fnmatch
import numpy as np
import itertools
from tqdm import tqdm

from peft import LoraConfig, get_peft_model

from sklearn.model_selection import StratifiedKFold
from pprint import pprint

from .parallel import run as prun

from .database import setup_image_database, setup_thumbnail_database

from .annotations import update_annotation_image_and_labels, update_url_thumbnail, parse_annotation

from datetime import datetime
import PIL
PIL.Image.MAX_IMAGE_PIXELS = None

# noinspection PyBroadException
try:
    import torch
    import torch.nn as nn
    from torch.optim import lr_scheduler
    from torch.optim.adamw import AdamW
    from torch.utils.data import DataLoader
    from torchvision import models, transforms
    from .classifier import ImageClassifier
    from .feature_extraction import load_extraction_model
    # from feature_extraction import FeatureExtractor
    from .data_access import AnnotatedDataset
    # noinspection PyUnresolvedReferences
    from annoy import AnnoyIndex
except:
    pass

from .detections import summarize_detections
from .saliency import load_saliency_model

import PIL
from PIL import Image, ImageDraw, ImageOps, ImageFilter, ImageStat
from torchvision import transforms


@click.command()
@click.argument('directory', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=False))
@click.option('--pattern', type=str, default="*.jpg", help="File pattern to search for. Default: *.jpg")
@click.option('--follow-symlinks', type=bool, is_flag=True, default=False)
@click.option('--subset-json', type=click.Path(exists=True), default=None,
              help="Consider only the subset of image files defined in this json file.")
@click.option('--subset-dirs-json', type=click.Path(exists=True), default=None,
              help="Recursively search only through a subset of sub-directories as defined in this json file.")
def create_database(directory, sqlite_file, pattern, follow_symlinks, subset_json, subset_dirs_json):
    """
    DIRECTORY: Recursively enlist all the image files in this directory.
    Write the file list into the images table of SQLITE_FILE that is a sqlite3 database file.
    """

    subset_dirs = None
    if subset_dirs_json is not None:
        with open(subset_dirs_json, 'r') as sdf:
            subset_dirs = set(json.load(sdf))

    def file_it(to_scan):

        for f in os.scandir(to_scan):

            try:
                if f.is_dir(follow_symlinks=follow_symlinks):

                    if subset_dirs is not None and f.path not in subset_dirs:
                        continue

                    for g in file_it(f):
                        yield g
                else:
                    if not fnmatch(f.path, pattern):
                        continue
                    yield f.path
            except NotADirectoryError:
                continue

    _file_it = tqdm(file_it(directory))

    subset = None
    if subset_json is not None:
        with open(subset_json, 'r') as f:
            subset = json.load(f)

    print("Scanning for {} files ...".format(pattern))
    images = []
    for p in _file_it:

        if subset is not None:
            if os.path.basename(p) not in subset:
                continue

        images.append((p, 0))
        _file_it.set_description("[{}]".format(len(images)))

    images = pd.DataFrame(images, columns=['file', 'num_annotations'])

    images['x'] = -1
    images['y'] = -1
    images['width'] = -1
    images['height'] = -1
    images['anchor'] = "filesystem"

    with sqlite3.connect(sqlite_file) as conn:

        images.to_sql('images', con=conn, if_exists='replace')

        setup_image_database(conn)


class ThumbTask:

    def __init__(self, filename, max_img_size):

        self._filename = filename
        self._max_img_size = max_img_size

    def __call__(self, *args, **kwargs):

        # noinspection PyBroadException
        try:
            img = Image.open(self._filename).convert('RGB')

            max_size = float(max(img.size[0], img.size[1]))

            scale_factor = 1.0 if max_size <= self._max_img_size else self._max_img_size / max_size

            hsize = int((float(img.size[0]) * scale_factor))
            vsize = int((float(img.size[1]) * scale_factor))

            img = img.resize((hsize, vsize), PIL.Image.ANTIALIAS)

            buffer = io.BytesIO()
            img.save(buffer, "JPEG")
            buffer.seek(0)
        except:
            return None, None, None

        return self._filename, buffer, scale_factor


@click.command()
@click.argument('directory', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=False))
@click.option('--pattern', type=str, default="*.jpg", help="File pattern to search for. Default: *.jpg")
@click.option('--follow-symlinks', type=bool, is_flag=True, default=False)
@click.option('--subset-json', type=click.Path(exists=True), default=None,
              help="Consider only the subset of image files defined in this json file.")
@click.option('--subset-dirs-json', type=click.Path(exists=True), default=None,
              help="Recursively search only through a subset of sub-directories as defined in this json file.")
@click.option('--max-img-size', type=int, default=250,
              help="Scale all the images before storing such that the maximum of their width and height"
                   " is equal to this value (default 250).")
@click.option('--processes', type=int, default=8, help="Number of parallel processes to be used.")
def create_thumbnails(directory, sqlite_file, pattern, follow_symlinks, subset_json, subset_dirs_json, max_img_size,
                      processes):
    """
    DIRECTORY: Recursively enlist all the image files in this directory and add them to the thumbnail database.
    Write the thumbnail information to the thumbnails table of SQLITE_FILE that is a sqlite3 database file.
    """

    subset_dirs = None
    if subset_dirs_json is not None:
        with open(subset_dirs_json, 'r') as sdf:
            subset_dirs = set(json.load(sdf))

    def file_it(to_scan):

        for f in os.scandir(to_scan):
            try:
                if f.is_dir(follow_symlinks=follow_symlinks):

                    if subset_dirs is not None and f.path not in subset_dirs:
                        continue

                    for g in file_it(f):
                        yield g
                else:
                    if not fnmatch(f.path, pattern):
                        continue
                    yield f.path
            except NotADirectoryError:
                continue

    _file_it = tqdm(file_it(directory))

    subset = None
    if subset_json is not None:
        with open(subset_json, 'r') as sjf:
            subset = json.load(sjf)

    print("Scanning for {} files ...".format(pattern))
    images = []
    for p in _file_it:

        if subset is not None:
            if os.path.basename(p) not in subset:
                continue

        images.append(p)
        _file_it.set_description("Scanning ... [{}]".format(len(images)))

    def get_thumbs(imgs):

        for fname in tqdm(imgs, desc="Creating thumbnails..."):

            yield ThumbTask(fname, max_img_size)

    with sqlite3.connect(sqlite_file) as conn:

        setup_thumbnail_database(conn)

        for idx, (filename, buffer, scale_factor) in enumerate(prun(get_thumbs(images), processes=processes)):

            if filename is None or buffer is None or scale_factor is None:
                continue

            conn.execute('INSERT INTO thumbnails(id, filename, data, size, scale_factor) VALUES(?,?,?,?,?)',
                         (idx, filename, sqlite3.Binary(buffer.read()), max_img_size, scale_factor))


@click.command()
@click.argument('detection-file', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=False))
@click.option('--replace', type=bool, is_flag=True, default=False, help="Replace the entire image table if specified.")
@click.option('--anchor', type=str, default="detections", help="String to identity the added entries later on.")
def add_detections(detection_file, sqlite_file, replace, anchor):
    """
    DETECTION_FILE: Read object detection regions as a pickled pandas DataFrame from this file.
    Required columns: 'path', 'x1', 'y1', 'box_w', 'box_h'.
    SQLITE_FILE: Either append the image regions to the image table in this sqlite3 database file or replace the
    image table in this sqlite3 database file (see --replace).
    """

    detections = pd.read_pickle(detection_file).reset_index(drop=True)

    detections =\
        detections[['path', 'x1', 'y1', 'box_w', 'box_h']].\
        rename(columns={'path': 'file', 'x1': 'x', 'y1': 'y', 'box_w': 'width', 'box_h': 'height'})

    detections['num_annotations'] = 0
    detections['anchor'] = anchor

    with sqlite3.connect(sqlite_file) as conn:

        img = pd.read_sql('select * from images', con=conn, index_col="index")

        img = img.loc[(img.x == -1) & (img.y == -1) & (img.width == -1) & (img.height == -1)]

        detections = detections.loc[detections.file.isin(img.file)]

        detections = detections[img.columns].reset_index(drop=True)

        max_rowid = pd.read_sql('select max(rowid) from images', con=conn).iloc[0, 0]

        detections.index = detections.index + max_rowid

        detections.to_sql('images', con=conn, if_exists='replace' if replace else 'append')


@click.command()
@click.argument('image-db', type=click.Path(exists=True))
@click.argument('anno-db', type=click.Path(exists=True))
@click.argument('thumb-db', type=click.Path(exists=True))
@click.option('--thumb-size', type=int, default=250, help="Size of thumbnails to be created (default 250)")
@click.option('--reset', is_flag=True, default=False, help="")
def add_region_annotations(image_db, anno_db, thumb_db, thumb_size, reset):

    with sqlite3.connect(anno_db) as con:

        df_anno = pd.read_sql("select * from annotations", con)

    df_anno = df_anno.loc[df_anno.anno_json.str.len() > 0]

    thumbmail_updates = []

    with sqlite3.connect(image_db) as image_con:

        setup_image_database(image_con)

        if reset:
            print("Reset ..................")

            image_con.execute('BEGIN TRANSACTION')

            image_con.execute("DELETE FROM links WHERE rowid in ("
                              "SELECT rowid from images WHERE anchor GLOB \"region-annotator*\")")

            image_con.execute("DELETE FROM iiif_links WHERE image_id in ("
                              "SELECT rowid from images WHERE anchor GLOB \"region-annotator*\")")

            image_con.execute('DELETE FROM images where anchor GLOB "region-annotator*"')
            image_con.execute('DELETE FROM tags where user GLOB "region-annotator*"')

            image_con.execute('END TRANSACTION')

        for i, row in df_anno.iterrows():
            img_url, left, top, width, height, labels, anno_id = parse_annotation(json.loads(row.anno_json))

            thumbnail_must_be_updated = update_annotation_image_and_labels(anno_id, img_url, left, top, width, height,
                                                                           labels, image_con)

            if thumbnail_must_be_updated:
                thumbmail_updates.append((img_url, left, top, width, height, anno_id))

    with sqlite3.connect(thumb_db) as thumb_con:

        if reset:
            thumb_con.execute('BEGIN TRANSACTION')

            thumb_con.execute("DELETE from thumbnails WHERE filename GLOB ?", ("*|region-annotator:*",))

            thumb_con.execute('END TRANSACTION')

        for img_url, left, top, width, height, anno_id in thumbmail_updates:
            update_url_thumbnail(anno_id, img_url, left, top, width, height, thumb_size, thumb_con)


@click.command()
@click.argument('detection-in-file', type=click.Path(exists=True))
@click.argument('detection-out-file', type=click.Path(exists=False))
@click.option('--processes', type=int, default=8, help="number of parallel processes. default: 8")
@click.option('--conf-thres', type=float, default=0.2,
              help="Remove all detections that have confidence below this value. default: 0.2.")
@click.option('--iou-thres', type=float, default=0.3,
              help="Summarize all detections that have pairwise iou above this value. default: 0.3.")
@click.option('--area-thres', type=float, default=100.0,
              help="Remove all detections whose area in pixels is below this value. default: 100.0.")
@click.option('--max-iter', type=float, default=np.inf, help="Perform only a limited number of iterations."
              "default: process everything.")
def filter_detections(detection_in_file, detection_out_file, processes, conf_thres, iou_thres, area_thres, max_iter):
    """
    DETECTION_IN_FILE: Read detections as pickled pandas DataFrame from this file.
    Required columns: 'path', 'x1', 'y1', 'box_w', 'box_h', 'conf'
    DETECTION_OUT_FILE: Write filtered detections as pickled pandas DataFrame to this file.
    """

    detections = pd.read_pickle(detection_in_file)

    detections = detections.loc[detections.conf >= conf_thres]

    summarized = summarize_detections(detections=detections, processes=processes,
                                      iou_thres=iou_thres, area_thres=area_thres,
                                      max_iter=max_iter)

    summarized.to_pickle(detection_out_file)


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.argument('model-selection-file', type=click.Path(exists=True))
@click.argument('model-file', type=click.Path(exists=True))
@click.argument('result-file', type=click.Path(exists=False))
@click.option('--thumbnail-sqlite-file', type=str, default=None, help="Do not read the image from the file system"
                                                                      " but rather try to read them from this sqlite"
                                                                      " thumbnail file.")
@click.option('--train-only', type=bool, is_flag=True, default=False, help="Apply classifier only to training subset.")
@click.option('--write-to-table', type=str, default=None, help="")
@click.option('--label-table-name', type=str, default="annotations", help="")
@click.option('--label', type=str, multiple=True, default=None, help="")
@click.option('--tag-prefix', type=str, default=None, help="Tag prefix.")
@click.option('--username', type=str, default=None, help="Tag prefix.")
@click.option('--remove-user-tags', type=bool, is_flag=True, default=False, help="")
@click.option('--training-database', type=click.Path(exists=True), default=None, help="")
def apply(sqlite_file, model_selection_file, model_file, thumbnail_sqlite_file, result_file,
          train_only, write_to_table, label_table_name, label, tag_prefix, username, remove_user_tags,
          training_database):
    """

    Classifies all images of an image database and writes the predictions into a predictions table of the database.
    The annotator tool can than display those predictions.

    SQLITE_FILE: An annotated image database (see create-database).

    MODEL_SELECTION_FILE: Result file of the model-selection (see model-selection).

    MODEL_FILE: A finally trained pytorch model (see train-classifier).

    RESULT_FILE: Additionally write predictions to this pickled pandas Dataframe.

    """

    if tag_prefix is None:
        tag_prefix = "Classifier:"

    if username is None:
        username = "classifier"

    def table_write(pred):

        if write_to_table == 'predictions':

            pred = pred.reset_index(drop=True)

            with sqlite3.connect(sqlite_file) as _con:
                pred.to_sql('predictions', con=_con, if_exists='replace')

                con.execute('create index ix_predictions_labels on predictions(label)')
                # con.execute('create index ix_predictions_ppn on predictions(PPN)')

        elif write_to_table == 'tags':

            timestamp = str(datetime.now())

            pred = pred.reset_index().rename(columns={'rowid': 'image_id', 'label': 'tag'})

            pred['tag'] = tag_prefix + pred['tag']
            pred['user'] = username
            pred['timestamp'] = timestamp
            pred['read_only'] = 1

            pred = pred[['image_id', 'tag', 'user', 'timestamp', 'read_only']]

            with sqlite3.connect(sqlite_file) as _con:
                if remove_user_tags:
                    _con.execute('DELETE FROM tags WHERE user=?', parameters=(username,))

                pred.to_sql('tags', con=_con, if_exists='append', index=False)
        else:
            raise RuntimeError("Unknown table format")

    if os.path.exists(result_file) and write_to_table is not None:
        print("Result {} file already exists. Just writing it to the database {}.".format(result_file, sqlite_file))

        predictions = pd.read_pickle(result_file)

        table_write(predictions)

        return

    X, class_to_label, label_to_class = load_ground_truth(sqlite_file, label_table_name=label_table_name, labels=label)
    y = None

    if training_database is not None:
        _, class_to_label, label_to_class = load_ground_truth(training_database, label_table_name=label_table_name,
                                                              labels=label)

    if train_only is None:
        X['file'] = X['file'].astype(str)
        y = X['class'].astype(int)
    else:
        with sqlite3.connect(sqlite_file) as con:
            X = pd.read_sql('select rowid,file from images', con=con).set_index('rowid')

        X['file'] = X['file'].astype(str)

    batch_size, decrease_epochs, decrease_factor, epochs, model_name, num_trained, freeze_p, start_lr = \
        load_model_selection(model_selection_file)

    model, device, fit_transform, predict_transform, logits_func = \
        load_pretrained_model(model_name, len(label_to_class), num_train_layers=num_trained, freeze_percentage=freeze_p)

    # import ipdb;ipdb.set_trace()
    model.load_state_dict(torch.load(model_file, weights_only=True))

    estimator = ImageClassifier(model=model, model_weights=copy.deepcopy(model.state_dict()),
                                device=device, criterion=nn.CrossEntropyLoss(), optimizer=None,
                                scheduler=None, fit_transform=fit_transform,
                                predict_transform=predict_transform, batch_size=batch_size,
                                logits_func=logits_func, thumbnail_sqlite_file=thumbnail_sqlite_file)

    predictions = estimator.predict_proba(X)

    if y is not None:
        predictions['class_ground_truth'] = y
        predictions['label_ground_truth'] = [class_to_label[cl] for cl in y]

    predictions['class'] = predictions.idxmax(axis=1)
    predictions['label'] = [class_to_label[cl] for cl in predictions['class']]

    predictions.to_pickle(result_file)

    table_write(predictions)


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.argument('model-selection-file', type=click.Path(exists=True))
@click.argument('model-file', type=click.Path(exists=False))
@click.option('--thumbnail-sqlite-file', type=str, default=None, help="Do not read the image from the file system"
                                                                      " but rather try to read them from this sqlite"
                                                                      " thumbnail file.")
@click.option('--label-table-name', type=str, default="annotations", help="")
@click.option('--label', type=str, multiple=True, default=None, help="")
def train(sqlite_file, model_selection_file, model_file, thumbnail_sqlite_file, label_table_name, label):
    """

    Selects the best model/training parameter combination from a model selection and
    trains a final image classifier on the entire annotated part of the image database.

    SQLITE_FILE: An annotated image database (see create-database).
    MODEL_SELECTION_FILE: Results of a model selection created by the "model-selection" tool.
    MODEL_FILE: Store the finally trained image classification model in this file.

    """

    X, class_to_label, label_to_class = load_ground_truth(sqlite_file, label_table_name=label_table_name, labels=label)

    X['file'] = X['file'].astype(str)
    y = X['class'].astype(int)

    batch_size, decrease_epochs, decrease_factor, epochs, model_name, num_trained, freeze_p, start_lr = \
        load_model_selection(model_selection_file)

    model, device, fit_transform, predict_transform, logits_func = \
        load_pretrained_model(model_name, len(label_to_class),
                              num_train_layers=num_trained, freeze_percentage=freeze_p)

    # optimizer = optim.SGD(model_ft.parameters(), lr=start_lr, momentum=momentum)
    optimizer = AdamW(model.parameters(), lr=start_lr)

    sched = lr_scheduler.StepLR(optimizer, step_size=decrease_epochs, gamma=decrease_factor)

    estimator = ImageClassifier(model=model, model_weights=copy.deepcopy(model.state_dict()),
                                device=device, criterion=nn.CrossEntropyLoss(), optimizer=optimizer,
                                scheduler=sched, fit_transform=fit_transform,
                                predict_transform=predict_transform, batch_size=batch_size,
                                logits_func=logits_func, thumbnail_sqlite_file=thumbnail_sqlite_file)

    for _ in range(0, epochs):
        estimator.fit(X, y)

    torch.save(model.state_dict(), model_file)


def load_model_selection(model_selection_file):

    model_selection_result = pd.read_pickle(model_selection_file)

    best_config = model_selection_result.sort_values('test_acc', ascending=False).iloc[0]

    model_name = str(best_config.model)
    print('Using pre-trained model: {}'.format(model_name))

    num_trained = int(best_config.num_trained_layers)
    print('Number of trained layers: {}'.format(num_trained))

    freeze_percentage = float(best_config.freeze_percentage)
    print('Freeze percentage: {}'.format(freeze_percentage))

    epochs = int(best_config.epoch)
    print('Number of training epochs: {}'.format(epochs))

    decrease_factor = int(best_config.decrease_factor)
    print('LR schedule decrease factor: {}'.format(decrease_factor))

    decrease_epochs = int(best_config.decrease_epochs)
    print('LR schedule decrease epochs: {}'.format(decrease_epochs))

    batch_size = int(best_config.batch_size)
    print('Batch size: {}'.format(batch_size))

    start_lr = float(best_config.start_lr)
    print('Start learning rate: {}'.format(start_lr))

    momentum = float(best_config.momentum)
    print('Momentum (if SGD is used): {}'.format(momentum))

    return batch_size, decrease_epochs, decrease_factor, epochs, model_name, num_trained, freeze_percentage, start_lr


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True), nargs=-1)
@click.argument('result-file', type=click.Path(exists=False), nargs=1)
@click.option('--thumbnail-sqlite-file', type=str, default=None, help="Do not read the images from the file system"
                                                                      " but rather try to read them from this sqlite"
                                                                      " thumbnail file.")
@click.option('--n-splits', type=int, default=10, help="Number of splits used in cross-validation. Default 10.")
@click.option('--max-epoch', type=int, default=10, help="Number of training-epochs.")
@click.option('--batch-size', type=int, default=16, help="Training batch-size.")
@click.option('--start-lr', type=float, default=0.001, help="Start learning rate in lr-schedule.")
@click.option('--momentum', type=float, default=0.9)
@click.option('--decrease-epochs', type=int, default=10, help="Step size of lr-schedule.")
@click.option('--decrease-factor', type=float, default=0.1, help="Decrease factor of lr-schedule.")
@click.option('--model-name', type=str, multiple=True, default=['resnet18'],
              help="One or multiple pre-trained pytorch image classification models to try, "
                   "see https://pytorch.org/docs/stable/torchvision/models.html for possible choices. "
                   "Default resnet18.")
@click.option('--num-trained-layers', type=int, multiple=True, default=[1],
              help="Number of fully connected layers to be added-. Default [1].")
@click.option('--freeze-percentage', type=float, multiple=True, default=[1.0],
              help="Percentage of the pre-trained network to freeze. Default [1.0] (Freeze entire pretrained network).")
@click.option('--label-table-name', type=str, default="annotations", help="Either 'annotations' or 'tags'."
                                                                          "Use 'annotations' if labels have been made"
                                                                          "with the annotator, use 'tags' if labels "
                                                                          "stem from tags in the image search "
                                                                          "interface, default is 'annotations'.")
@click.option('--label', type=str, multiple=True, default=None, help="This option has to provided multiple times,"
                                                                     "listing all the labels from the tags table that"
                                                                     "should be used as classifier classes.")
@click.option('--epoch-steps', type=int, default=1, help="Step size of epoch increase.")
def model_selection(sqlite_file, result_file, thumbnail_sqlite_file, n_splits, max_epoch, batch_size,
                    start_lr, momentum, decrease_epochs, decrease_factor, model_name,
                    num_trained_layers, freeze_percentage, label_table_name, label, epoch_steps):
    """

    Performs a cross-validation in order to select an optimal model and training parameters for a given
    image classification task that is defined by annotated image database(s).

    It can use either the annotations provided by the annotator or tags that have been added in the image search
    interface.

    SQLITE_FILE ...: One or more image database(s) containing the labels in either the annoations or tags table
    (see also create-database).

    RESULT_FILE: A pickled pandas DataFrame that contains the results of the cross-validation.

    """

    data = []

    for sq_file in sqlite_file:

        images, _, _ = load_ground_truth(sq_file, label_table_name=label_table_name, labels=label)

        data.append(images)

    images = pd.concat(data)

    images['file'] = images['file'].astype(str)

    images, class_to_label, label_to_class = make_class_from_labels(images)

    y = images['class'].astype(int)

    sk_fold = StratifiedKFold(n_splits=n_splits)

    folds = [{'train': tr, 'test': te} for tr, te in sk_fold.split(images, y)]

    results = list() if not os.path.exists(result_file) else [pd.read_pickle(result_file)]

    for mn, num_trained, freeze_p in itertools.product(model_name, num_trained_layers, freeze_percentage):

        model_ft, device, fit_transform, predict_transform, logits_func = \
            load_pretrained_model(mn, len(label_to_class), num_train_layers=num_trained, freeze_percentage=freeze_p)

        result = cross_validate_model(images, y, folds, batch_size, class_to_label, decrease_epochs, decrease_factor,
                                      device, fit_transform, predict_transform, max_epoch, model_ft, momentum, n_splits,
                                      start_lr, logits_func, epoch_steps, thumbnail_sqlite_file=thumbnail_sqlite_file)

        pprint(result.head(50))

        result['model'] = mn
        result['num_trained_layers'] = num_trained
        result['freeze_percentage'] = freeze_p

        results.append(result)

        pd.concat(results).to_pickle(result_file)

    results = pd.concat(results)

    results.to_pickle(result_file)


def make_class_from_labels(images):
    images['class'] = images.label.astype('category').cat.codes

    class_to_label = images[['label', 'class']].drop_duplicates().set_index('class').sort_index().to_dict()['label']
    label_to_class = images[['label', 'class']].drop_duplicates().set_index('label').sort_index().to_dict()['class']

    return images, class_to_label, label_to_class


def load_ground_truth(sqlite_file, label_table_name='annotations', labels=None):

    if label_table_name == "annotations":

        with sqlite3.connect(sqlite_file) as con:
            images = pd.read_sql('select * from images', con=con)

            annotations = pd.read_sql('select * from annotations', con=con)
        # perform vote count for each label image
        annotations = \
            pd.DataFrame([(image_id - 1,  # -1 since sqlite indices start at 1
                           im.label.value_counts().reset_index().max()['label'],
                           im.label.value_counts().reset_index().max()['count'])
                          for image_id, im in annotations.groupby('IMAGE')], columns=['IMAGE', 'label', 'consensus'])

        images = annotations.merge(images, left_on='IMAGE', right_on='index')

        assert (images.num_annotations == 0).sum() == 0
        # noinspection PyUnresolvedReferences
        assert (images.consensus <= images.num_annotations).sum() == len(images)

        images = images.loc[images.consensus > 1].copy()

    elif label_table_name == "tags":

        if labels is None:
            raise RuntimeError("Need label specification if tags table is to be used.")

        images = []

        with sqlite3.connect(sqlite_file) as con:
            for label in labels:
                images.append(pd.read_sql('select file, tag from images join tags on images.rowid=tags.image_id '
                                          'where tags.tag=?', con=con, params=(label,)))

        images = pd.concat(images).\
            drop_duplicates(subset='file', keep=False).\
            rename(columns={'tag': 'label'}).\
            reset_index(drop=True)
    else:
        raise RuntimeError("Do not know how to interpret table '{}'".format(label_table_name))

    return make_class_from_labels(images)


def load_pretrained_model(mn, num_classes, num_train_layers, freeze_percentage=1.0):

    input_size = {'inception_v3': 299}
    logits_funcs = {'inception_v3': lambda output: output.logits}
    classifcation_layer_names = {}

    img_size = input_size.get(mn, 224)
    logits_func = logits_funcs.get(mn, lambda outputs: outputs)
    classification_layer_name = classifcation_layer_names.get(mn, 'fc')

    # Data augmentation and normalization for training
    # Just normalization for validation
    fit_transform = transforms.Compose([
        transforms.RandomResizedCrop(img_size),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    predict_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(img_size),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    model_ft = getattr(models, mn)(weights=True)

    model_size = 0
    for i, p in enumerate(model_ft.parameters()):
        p.requires_grad = False
        model_size = i

    for i, p in enumerate(model_ft.parameters()):

        if freeze_percentage*model_size < i:
            p.requires_grad = True

    in_features = getattr(model_ft, classification_layer_name).in_features

    # trained_layers =\
    #    [nn.ReLU() for _ in range(0, num_train_layers-1)] + [nn.Linear(in_features, num_classes)]

    trained_layers = \
        [nn.Linear(in_features, in_features) for _ in range(0, num_train_layers - 1)] + \
            [nn.Linear(in_features, num_classes)]

    setattr(model_ft, classification_layer_name, nn.Sequential(*trained_layers))

    # import ipdb;ipdb.set_trace()

    model_ft = model_ft.to(device)

    return model_ft, device, fit_transform, predict_transform, logits_func


def cross_validate_model(X, y, folds, batch_size, class_to_label, decrease_epochs, decrease_factor, device,
                         fit_transform, predict_transform, max_epoch, model_ft, momentum, n_splits, start_lr,
                         logits_func, epoch_steps, thumbnail_sqlite_file=None):

    for fold in folds:
        # optimizer = optim.SGD(model_ft.parameters(), lr=start_lr, momentum=momentum)
        optimizer = AdamW(model_ft.parameters(), lr=start_lr)

        sched = lr_scheduler.StepLR(optimizer, step_size=decrease_epochs, gamma=decrease_factor)

        fold['estimator'] = ImageClassifier(model=model_ft, model_weights=copy.deepcopy(model_ft.state_dict()),
                                            device=device, criterion=nn.CrossEntropyLoss(), optimizer=optimizer,
                                            scheduler=sched, fit_transform=fit_transform,
                                            predict_transform=predict_transform, batch_size=batch_size,
                                            logits_func=logits_func, thumbnail_sqlite_file=thumbnail_sqlite_file)
    results = list()
    for epoch in range(epoch_steps, max_epoch + 1, epoch_steps):

        predictions = list()
        for fold in folds:
            estimator = fold['estimator']

            estimator.fit(X.iloc[fold['train']], y.iloc[fold['train']], epochs=epoch_steps)

            predictions.append(estimator.predict_proba(X.iloc[fold['test']]))

        predictions = pd.concat(predictions)

        predictions['pred'] = predictions.idxmax(axis=1)

        epoch_result = pd.concat([predictions, y], axis=1)

        result = dict()
        result['epoch'] = epoch
        result['test_acc'] = (epoch_result['pred'] == epoch_result['class']).sum() / len(epoch_result)

        result['train_loss'] = np.mean([fold['estimator'].epoch_loss for fold in folds])
        result['train_acc'] = np.mean([float(fold['estimator'].epoch_acc) for fold in folds])

        for cl, cl_res in epoch_result.groupby('class'):
            result[class_to_label[cl]] = (cl_res['pred'] == cl_res['class']).sum() / len(cl_res)

        results.append(result)

        pprint(result)

    results = pd.DataFrame.from_records(results)
    results['batch_size'] = batch_size
    results['n_splits'] = n_splits
    results['start_lr'] = start_lr
    results['momentum'] = momentum
    results['decrease_epochs'] = decrease_epochs
    results['decrease_factor'] = decrease_factor

    return results


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.argument('index-file', type=click.Path(exists=False))
@click.option('--model-name', type=str, default='resnet18', help='PyTorch name of NN-model. default: "resnet18".\n'
              'Set to "VST" if you want Visual Saliency Transformer features for the search index.'
              ' Note in that case you also have to provide vit-model and vst-model.')
@click.option('--batch-size', type=int, default=32, help="Process batch-size. default: 32.")
@click.option('--dist-measure', type=str, default='angular', help="Distance measure of the approximate nearest"
              " neighbour index. default: angular.")
@click.option('--n-trees', type=int, default=10, help="Number of search trees. Default 10.")
@click.option('--num-workers', type=int, default=8, help="Number of parallel workers during index creation."
                                                         "Default 8.")
@click.option('--vit-model', type=click.Path(exists=True), default=None,
              help='Vision transformer pytorch model file (required by Visual Saliency Transformer).')
@click.option('--vst-model', type=click.Path(exists=True), default=None,
              help='Visual saliency transformer pytorch model file.')
@click.option('--clip-model', type=str, default=None, help='CLIP model.')
@click.option('--open-clip-model', type=str, default=None, help='OpenCLIP model.')
@click.option('--open-clip-pretrained', type=str, default=None, help='OpenCLIP pretrained checkpoint.')
@click.option('--ms-clip-model', type=str, default=None, help='Modality Shared CLIP model configuration file.')
@click.option('--multi-lang-clip-model', type=str, default=None, help='Multi Language CLIP model.')
@click.option('--layer-name', type=str, default='fc', help="Name of feature layer. default: fc")
@click.option('--layer-output', is_flag=True, help="Use output of layer rather than its input.")
@click.option('--use-saliency-mask', is_flag=True, help="Mask images by saliency before feature computation. Note: you"
                                                        " need to provide vit-model and vst-model in that case.")
@click.option('--pad-to-square', is_flag=True, help="Pad-to-square before application of model image transform"
                                                    " (typically resize + center-crop).")
@click.option('--thumbnail-sqlite-file', type=str, default=None, help="Do not read the image from the file system"
                                                                      " but rather try to read them from this sqlite"
                                                                      " thumbnail file.")
@click.option('--thumbnail-table-name', type=str, default=None, help="Do not read the image from the file system"
                                                                     " but rather try to read them from this table"
                                                                     " in the thumbnail sqlite file.")
@click.option('--min-size', type=int, default=None, help="Do not include images smaller than min-size.")
@click.option('--auto-contrast', is_flag=True, help="Perform automatic contrast correction.")
@click.option('--unsharp-mask-radius', type=int, default=0, help="Perform unsharp mask with this radius if > 0 "
                                                                 "(default:0 => disabled) .")
@click.option('--exclude-label', type=str, multiple=True, default=None, help="Do not add entries that are tagged with "
                                                                             "this label in the 'tags' table "
                                                                             "(can be provided multiple times).")
def create_search_index(sqlite_file, index_file, model_name, batch_size, dist_measure, n_trees, num_workers, vit_model,
                        vst_model, clip_model, open_clip_model, open_clip_pretrained, ms_clip_model,
                        multi_lang_clip_model, layer_name, layer_output, use_saliency_mask, pad_to_square,
                        thumbnail_sqlite_file, thumbnail_table_name, min_size, auto_contrast, unsharp_mask_radius,
                        exclude_label):
    """

    Creates an ANN-features based similarity search index.

    SQLITE_FILE: Image database (see create-database).
    INDEX_FILE: Storage file for search index.
    """

    with sqlite3.connect(sqlite_file) as con:
        X = pd.read_sql('SELECT rowid, file, x, y, width, height FROM images', con=con)
        X['rowid'] -= 1
        X = X.set_index('rowid').sort_index()

        excl_expr = ''
        for label in exclude_label:

            if len(excl_expr) > 0:
                excl_expr += " OR "

            excl_expr += 'tags.tag == "{}"'.format(label)

        if len(excl_expr) > 0:

            E = pd.read_sql('SELECT images.rowid, images.file FROM images '
                            'INNER JOIN tags ON images.rowid=tags.image_id '
                            'WHERE {}'.format(excl_expr),
                            con=con)
            E['rowid'] -= 1
            E = E.set_index('rowid').sort_index()

            E['skip'] = True

            X = X.merge(E[['skip']], left_index=True, right_index=True, how='left')
            X.loc[X.skip.isnull(), 'skip'] = False
            X = X.loc[X.skip == False]

    X['file'] = X['file'].astype(str)

    if min_size is not None:
        X = X.loc[((X.width >= min_size) & (X.height >= min_size)) | (X.width == -1)]

    extract_features_orig, extract_transform, normalization = \
        load_extraction_model(model_name, layer_name, layer_output,
                              vit_model=None if model_name != "VST" else vit_model,
                              vst_model=None if model_name != "VST" else vst_model,
                              clip_model=clip_model, open_clip_model=open_clip_model,
                              open_clip_pretrained=open_clip_pretrained,
                              ms_clip_model=ms_clip_model, multi_lang_clip_model=multi_lang_clip_model)

    if use_saliency_mask:

        predict_saliency, predict_saliency_transform = load_saliency_model(vit_model, vst_model)

        resize_transform = None
        target_size = None

        def image_transform(img_orig):

            nonlocal resize_transform, target_size

            if resize_transform is None:
                test_input = extract_transform(img_orig)
                target_size = test_input.shape[-1]

                resize_transform = transforms.Compose([
                    transforms.Resize(target_size),
                    transforms.CenterCrop(target_size),
                    transforms.ToTensor()])

            if auto_contrast:
                img_orig = ImageOps.autocontrast(img_orig)

            if unsharp_mask_radius > 0:
                img_orig = img_orig.filter(ImageFilter.UnsharpMask(radius=unsharp_mask_radius))

            img = img_orig

            img_mean = ImageStat.Stat(img).mean
            img_empty = Image.new('RGB', size=(target_size, target_size), color=tuple([int(c) for c in img_mean]))

            return resize_transform(img_orig), predict_saliency_transform(img), resize_transform(img_empty)

        transform = image_transform

        def extract_features_with_saliency(inputs, saliency_inputs, empty_inputs):

            saliency_mask = predict_saliency(saliency_inputs)

            masked_inputs = (1.0 - saliency_mask)*empty_inputs + saliency_mask*inputs

            return extract_features_orig(normalization(masked_inputs))

        extract_features = extract_features_with_saliency
    else:
        def default_image_transform(img_orig):

            if auto_contrast:
                img_orig = ImageOps.autocontrast(img_orig)

            if unsharp_mask_radius > 0:
                img_orig = img_orig.filter(ImageFilter.UnsharpMask(radius=unsharp_mask_radius))

            return extract_transform(img_orig),

        transform = default_image_transform

        def default_extract_features(inputs):

            return extract_features_orig(inputs)

        extract_features = default_extract_features

    dataset = AnnotatedDataset(samples=X, targets=None, transform=transform, pad_to_square=pad_to_square,
                               thumbnail_sqlite_file=thumbnail_sqlite_file, table_name=thumbnail_table_name,
                               min_size=min_size, report_skip=True)

    data_loader = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers)

    index = None

    for batch, _, positions, skip_info in tqdm(data_loader, total=len(data_loader), desc="Extract features"):

        positions = positions.cpu().numpy()
        skip_info = skip_info.cpu().numpy()

        fe = extract_features(*batch)

        if index is None:
            index = AnnoyIndex(fe.shape[1], dist_measure)

        for idx, (f, pos, skip) in enumerate(zip(fe, positions, skip_info)):
            if skip:
                continue

            index.add_item(pos, f)

    index.build(n_trees)
    index.save(index_file)
