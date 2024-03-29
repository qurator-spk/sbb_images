import sqlite3
import click
import re
import pandas as pd
# import time
import copy
# import importlib
import os
from fnmatch import fnmatch
import numpy as np
import itertools
from tqdm import tqdm

from sklearn.model_selection import StratifiedKFold
from pprint import pprint

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


@click.command()
@click.argument('directory', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=False))
@click.option('--pattern', type=str, default="*.jpg", help="File pattern to search for. Default: *.jpg")
@click.option('--follow-symlinks', type=bool, is_flag=True, default=False)
def create_database(directory, sqlite_file, pattern, follow_symlinks):
    """
    DIRECTORY: Recursively enlist all the image files in this directory.
    Write the file list into the images table of SQLITE_FILE that is a sqlite3 database file.
    """

    def file_it(to_scan):

        for f in os.scandir(to_scan):

            try:
                if f.is_dir(follow_symlinks=follow_symlinks):
                    for g in file_it(f):
                        yield g
                else:
                    if not fnmatch(f.path, pattern):
                        continue
                    yield f.path
            except NotADirectoryError:
                continue

    _file_it = tqdm(file_it(directory))

    print("Scanning for {} files ...".format(pattern))
    images = []
    for p in _file_it:
        images.append((p, 0))
        _file_it.set_description("[{}]".format(len(images)))

    images = pd.DataFrame(images, columns=['file', 'num_annotations'])

    images['x'] = -1
    images['y'] = -1
    images['width'] = -1
    images['height'] = -1

    with sqlite3.connect(sqlite_file) as conn:
        images.to_sql('images', con=conn, if_exists='replace')

        conn.execute('create index idx_num_annotations on images(num_annotations);')

        conn.execute('create table if not exists "annotations"("index" integer primary key, "user" TEXT, "label" TEXT,'
                     '"IMAGE" integer)')

        conn.execute('create index idx_user on annotations(user);')
        conn.execute('create index idx_label on annotations(label);')


@click.command()
@click.argument('detection-file', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=False))
@click.option('--replace', type=bool, is_flag=True, default=False, help="Replace the entire image table if specified.")
def add_detections(detection_file, sqlite_file, replace):
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

    with sqlite3.connect(sqlite_file) as conn:

        max_rowid = pd.read_sql('select max(rowid) from images', con=conn).iloc[0, 0]

        detections.index = detections.index + max_rowid

        detections.to_sql('images', con=conn, if_exists='replace' if replace else 'append')


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
def create_sbb_link_table(sqlite_file):
    """
    Special functionality of the SBB (Staatsbibliothek zu Berlin):
    Creates an link table that links each image in the database to the corresponding webpage within the
    "digitalisierte Sammlungen".

    SQLITE_FILE: sqlite3 database file that contains the images table.
    """

    with sqlite3.connect(sqlite_file) as con:
        images = pd.read_sql('select * from images', con=con)

    links = []
    for rowid, img in tqdm(images.iterrows(), total=len(images)):

        m = re.match(r'.*/(PPN.+)/([0-9]+)_.*', img.file)

        if m is None:
            print(img.file)
            continue

        ppn = m.group(1)
        phys_id = m.group(2)

        links.append(("https://digital.staatsbibliothek-berlin.de/werkansicht?" +
                      "PPN={}&PHYSID=PHYS_{}".format(ppn, phys_id), ppn, phys_id, rowid))

    links = pd.DataFrame(links, columns=['url', 'ppn', 'phys_id', 'index']).set_index('index')

    with sqlite3.connect(sqlite_file) as con:
        links.to_sql('links', con=con, if_exists='replace')

        con.execute("create index ix_links_ppn on links(ppn)")


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.argument('model-selection-file', type=click.Path(exists=True))
@click.argument('model-file', type=click.Path(exists=True))
@click.argument('result-file', type=click.Path(exists=False))
@click.option('--train-only', type=bool, is_flag=True, default=False,
              help="If true, write only pickled predictions but not prediction table of database. Default false.")
def apply(sqlite_file, model_selection_file, model_file, result_file, train_only):
    """

    Classifies all images of an image database and writes the predictions into a predictions table of the database.
    The annotator tool can than display those predictions.

    SQLITE_FILE: An annotated image database (see create-database).

    MODEL_SELECTION_FILE: Result file of the model-selection (see model-selection).

    MODEL_FILE: A finally trained pytorch model (see train-classifier).

    RESULT_FILE: Additionally write predictions to this pickled pandas Dataframe.

    """

    if os.path.exists(result_file) and not train_only:
        print("Result {} file already exists. Just writing it to the database {}.".format(result_file, sqlite_file))

        predictions = pd.read_pickle(result_file)

        with sqlite3.connect(sqlite_file) as con:
            predictions.to_sql('predictions', con=con, if_exists='replace')

            con.execute('create index ix_predictions_labels on predictions(label)')
            con.execute('create index ix_predictions_ppn on predictions(PPN)')

        return

    X, class_to_label, label_to_class = load_ground_truth(sqlite_file)

    y = None
    if train_only:
        X['file'] = X['file'].astype(str)
        y = X['class'].astype(int)
    else:
        with sqlite3.connect(sqlite_file) as con:
            X = pd.read_sql('select * from images', con=con)

        X['file'] = X['file'].astype(str)

    batch_size, decrease_epochs, decrease_factor, epochs, model_name, num_trained, start_lr = load_model_selection(
        model_selection_file)

    model, device, fit_transform, predict_transform, logits_func = \
        load_pretrained_model(model_name, len(label_to_class), num_trained)

    model.load_state_dict(torch.load(model_file))

    # optimizer = optim.SGD(model_ft.parameters(), lr=start_lr, momentum=momentum)
    optimizer = AdamW(model.parameters(), lr=start_lr)

    sched = lr_scheduler.StepLR(optimizer, step_size=decrease_epochs, gamma=decrease_factor)

    estimator = ImageClassifier(model=model, model_weights=copy.deepcopy(model.state_dict()),
                                device=device, criterion=nn.CrossEntropyLoss(), optimizer=optimizer,
                                scheduler=sched, fit_transform=fit_transform,
                                predict_transform=predict_transform, batch_size=batch_size,
                                logits_func=logits_func)

    predictions = estimator.predict_proba(X)

    if train_only:

        predictions['class'] = y
        predictions['label'] = [class_to_label[cl] for cl in y]

    else:
        predictions['class'] = predictions.idxmax(axis=1)
        predictions['label'] = [class_to_label[cl] for cl in predictions['class']]

        with sqlite3.connect(sqlite_file) as con:
            predictions.to_sql('predictions', con=con, if_exists='replace')

            con.execute('create index ix_predictions_labels on predictions(label)')
            con.execute('create index ix_predictions_ppn on predictions(PPN)')

    predictions.to_pickle(result_file)


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.argument('model-selection-file', type=click.Path(exists=True))
@click.argument('model-file', type=click.Path(exists=False))
def train(sqlite_file, model_selection_file, model_file):
    """

    Selects the best model/training parameter combination from a model selection and
    trains a final image classifier on the entire annotated part of the image database.

    SQLITE_FILE: An annotated image database (see create-database).
    MODEL_SELECTION_FILE: Results of a model selection created by the "model-selection" tool.
    MODEL_FILE: Store the finally trained image classification model in this file.

    """

    X, class_to_label, label_to_class = load_ground_truth(sqlite_file)

    X['file'] = X['file'].astype(str)
    y = X['class'].astype(int)

    batch_size, decrease_epochs, decrease_factor, epochs, model_name, num_trained, start_lr = load_model_selection(
        model_selection_file)

    model, device, fit_transform, predict_transform, logits_func = \
        load_pretrained_model(model_name, len(label_to_class), num_trained)

    # optimizer = optim.SGD(model_ft.parameters(), lr=start_lr, momentum=momentum)
    optimizer = AdamW(model.parameters(), lr=start_lr)

    sched = lr_scheduler.StepLR(optimizer, step_size=decrease_epochs, gamma=decrease_factor)

    estimator = ImageClassifier(model=model, model_weights=copy.deepcopy(model.state_dict()),
                                device=device, criterion=nn.CrossEntropyLoss(), optimizer=optimizer,
                                scheduler=sched, fit_transform=fit_transform,
                                predict_transform=predict_transform, batch_size=batch_size,
                                logits_func=logits_func)

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

    return batch_size, decrease_epochs, decrease_factor, epochs, model_name, num_trained, start_lr


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.argument('result-file', type=click.Path(exists=False))
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
              help="One or multiple number of layers to unfreeze. Default [1] (Unfreeze last layer).")
def model_selection(sqlite_file, result_file, n_splits, max_epoch, batch_size,
                    start_lr, momentum, decrease_epochs, decrease_factor, model_name,
                    num_trained_layers):
    """

    Performs a cross-validation in order to select an optimal model and training parameters for a given
    image classification task that is defined by an annotated image database (see also annotator).

    SQLITE_FILE: image database (see also create-database).

    RESULT_FILE: A pickled pandas DataFrame that contains the results of the cross-validation.

    """

    X, class_to_label, label_to_class = load_ground_truth(sqlite_file)

    X['file'] = X['file'].astype(str)
    y = X['class'].astype(int)

    sk_fold = StratifiedKFold(n_splits=n_splits)

    folds = [{'train': tr, 'test': te} for tr, te in sk_fold.split(X, y)]

    results = list() if not os.path.exists(result_file) else [pd.read_pickle(result_file)]

    for mn, num_trained in itertools.product(model_name, num_trained_layers):

        model_ft, device, fit_transform, predict_transform, logits_func = \
            load_pretrained_model(mn, len(label_to_class), num_trained)

        result = cross_validate_model(X, y, folds, batch_size, class_to_label, decrease_epochs, decrease_factor, device,
                                      fit_transform, predict_transform, max_epoch, model_ft, momentum, n_splits,
                                      start_lr, logits_func)

        pprint(result.head(50))

        result['model'] = mn
        result['num_trained_layers'] = num_trained

        results.append(result)

        pd.concat(results).to_pickle(result_file)

    results = pd.concat(results)

    results.to_pickle(result_file)


def load_ground_truth(sqlite_file):

    with sqlite3.connect(sqlite_file) as con:
        images = pd.read_sql('select * from images', con=con)

        annotations = pd.read_sql('select * from annotations', con=con)
    # perform vote count for each label image
    annotations = \
        pd.DataFrame([(image_id - 1,  # -1 since sqlite indices start at 1
                       im.label.value_counts().reset_index().max()['index'],
                       im.label.value_counts().reset_index().max()['label'])
                      for image_id, im in annotations.groupby('IMAGE')], columns=['IMAGE', 'label', 'consensus'])

    images = annotations.merge(images, left_on='IMAGE', right_on='index')

    assert (images.num_annotations == 0).sum() == 0
    # noinspection PyUnresolvedReferences
    assert (images.consensus <= images.num_annotations).sum() == len(images)

    images = images.loc[images.consensus > 1].copy()

    images['class'] = images.label.astype('category').cat.codes

    class_to_label = images[['label', 'class']].drop_duplicates().set_index('class').sort_index().to_dict()['label']
    label_to_class = images[['label', 'class']].drop_duplicates().set_index('label').sort_index().to_dict()['class']

    return images, class_to_label, label_to_class


def load_pretrained_model(mn, num_classes, num_train_layers):

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

    model_ft = getattr(models, mn)(pretrained=True)

    for p in model_ft.parameters():
        p.requires_grad = False

    in_features = getattr(model_ft, classification_layer_name).in_features

    trained_layers =\
        [nn.ReLU() for _ in range(0, num_train_layers-1)] + [nn.Linear(in_features, num_classes)]

    setattr(model_ft, classification_layer_name, nn.Sequential(*trained_layers))

    model_ft = model_ft.to(device)

    return model_ft, device, fit_transform, predict_transform, logits_func


def cross_validate_model(X, y, folds, batch_size, class_to_label, decrease_epochs, decrease_factor, device,
                         fit_transform, predict_transform, max_epoch, model_ft, momentum, n_splits, start_lr,
                         logits_func):

    for fold in folds:
        # optimizer = optim.SGD(model_ft.parameters(), lr=start_lr, momentum=momentum)
        optimizer = AdamW(model_ft.parameters(), lr=start_lr)

        sched = lr_scheduler.StepLR(optimizer, step_size=decrease_epochs, gamma=decrease_factor)

        fold['estimator'] = ImageClassifier(model=model_ft, model_weights=copy.deepcopy(model_ft.state_dict()),
                                            device=device, criterion=nn.CrossEntropyLoss(), optimizer=optimizer,
                                            scheduler=sched, fit_transform=fit_transform,
                                            predict_transform=predict_transform, batch_size=batch_size,
                                            logits_func=logits_func)
    results = list()
    for epoch in range(0, max_epoch):

        predictions = list()
        for fold in folds:
            estimator = fold['estimator']

            estimator.fit(X.iloc[fold['train']], y.iloc[fold['train']])

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
@click.option('--model-name', type=str, default='resnet18', help='PyTorch name of NN-model. default: resnet18')
@click.option('--batch-size', type=int, default=32, help="Process batch-size. default: 32.")
@click.option('--dist-measure', type=str, default='angular', help="Distance measure of the approximative nearest"
              "neighbour index. default: angular.")
@click.option('--n-trees', type=int, default=10, help="Number of search trees. Default 10.")
@click.option('--num-workers', type=int, default=8, help="Number of parallel workers during index creation."
                                                         "Default 8.")
def create_search_index(sqlite_file, index_file, model_name, batch_size, dist_measure, n_trees, num_workers):
    """

    Creates a CNN-features based similarity search index.

    SQLITE_FILE: Image database (see create-database).
    INDEX_FILE: Storage file for search index.
    """

    with sqlite3.connect(sqlite_file) as con:
        X = pd.read_sql('select * from images', con=con)

    X['file'] = X['file'].astype(str)

    model_extr, extract_transform, device = load_extraction_model(model_name)

    dataset = AnnotatedDataset(samples=X, targets=None, transform=extract_transform)

    data_loader = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers)

    index = None

    for inputs, _, pos in tqdm(data_loader, total=len(data_loader), desc="Extract features"):
        pos = pos.cpu().numpy()
        inputs = inputs.to(device)

        with torch.set_grad_enabled(False):
            fe = model_extr(inputs).to('cpu').numpy()

        if index is None:
            index = AnnoyIndex(fe.shape[1], dist_measure)

        for idx, f in enumerate(fe):
            index.add_item(pos[idx], f)

    index.build(n_trees)
    index.save(index_file)
