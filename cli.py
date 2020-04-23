import sqlite3
import glob
import click
import pandas as pd
# import time
import copy
# import importlib
import os
import torch
import torch.nn as nn
from torch.optim import lr_scheduler
import numpy as np
import itertools
from tqdm import tqdm

from torchvision import models, transforms
from sklearn.model_selection import StratifiedKFold
from classifier import ImageClassifier
# from feature_extraction import FeatureExtractor
from data_access import AnnotatedDataset
from pprint import pprint
from torch.optim.adamw import AdamW
from torch.utils.data import DataLoader
# noinspection PyUnresolvedReferences
from annoy import AnnoyIndex


@click.command()
@click.argument('directory', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=False))
def create_database(directory, sqlite_file):
    files = [(f, 0) for f in glob.glob('{}/**/*.jpg'.format(directory), recursive=True)]

    files = pd.DataFrame(files, columns=['file', 'num_annotations'])

    with sqlite3.connect(sqlite_file) as conn:
        files.to_sql('images', con=conn, if_exists='replace')

        conn.execute('create index idx_num_annotations on images(num_annotations);')

        conn.execute('create table if not exists "annotations"("index" integer primary key, "user" TEXT, "label" TEXT,'
                     '"IMAGE" integer)')

        conn.execute('create index idx_user on annotations(user);')
        conn.execute('create index idx_label on annotations(label);')


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.argument('model-selection-file', type=click.Path(exists=True))
@click.argument('model-file', type=click.Path(exists=True))
@click.argument('result-file', type=click.Path(exists=False))
@click.option('--train-only', type=bool, is_flag=True, default=False)
def apply(sqlite_file, model_selection_file, model_file, result_file, train_only):

    if os.path.exists(result_file) and not train_only:
        print("Result {} file already exists. Just writing it to the database {}.".format(result_file, sqlite_file))

        predictions = pd.read_pickle(result_file)

        with sqlite3.connect(sqlite_file) as con:
            predictions.to_sql('predictions', con=con, if_exists='replace')

        return

    images, class_to_label, label_to_class = load_ground_truth(sqlite_file)

    y = None
    if train_only:
        X = images['file'].astype(str)
        y = images['class'].astype(int)
    else:
        with sqlite3.connect(sqlite_file) as con:
            images = pd.read_sql('select * from images', con=con)

        X = images['file'].astype(str)

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

    predictions.to_pickle(result_file)


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.argument('model-selection-file', type=click.Path(exists=True))
@click.argument('model-file', type=click.Path(exists=False))
def train(sqlite_file, model_selection_file, model_file):

    images, class_to_label, label_to_class = load_ground_truth(sqlite_file)

    X = images['file'].astype(str)
    y = images['class'].astype(int)

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
@click.option('--n-splits', type=int, default=2)
@click.option('--max-epoch', type=int, default=10)
@click.option('--batch-size', type=int, default=16)
@click.option('--start-lr', type=float, default=0.001)
@click.option('--momentum', type=float, default=0.9)
@click.option('--decrease-epochs', type=int, default=10)
@click.option('--decrease-factor', type=float, default=0.1)
@click.option('--model-name', type=str, multiple=True, default=['resnet18'])
@click.option('--num-trained-layers', type=int, multiple=True, default=[1])
def model_selection(sqlite_file, result_file, n_splits, max_epoch, batch_size,
                    start_lr, momentum, decrease_epochs, decrease_factor, model_name,
                    num_trained_layers):

    images, class_to_label, label_to_class = load_ground_truth(sqlite_file)

    X = images['file'].astype(str)
    y = images['class'].astype(int)

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
@click.option('--model-name', type=str, default='resnet18')
@click.option('--batch-size', type=int, default=32)
@click.option('--dist-measure', type=str, default='angular')
@click.option('--n-trees', type=int, default=10)
def create_search_index(sqlite_file, index_file, model_name, batch_size, dist_measure, n_trees):

    with sqlite3.connect(sqlite_file) as con:
        images = pd.read_sql('select * from images', con=con)

    X = images['file'].astype(str)

    input_size = {'inception_v3': 299}
    classifcation_layer_names = {}

    img_size = input_size.get(model_name, 224)
    classification_layer_name = classifcation_layer_names.get(model_name, 'fc')

    extract_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(img_size),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    model_extr = getattr(models, model_name)(pretrained=True)

    for p in model_extr.parameters():
        p.requires_grad = False

    model_extr = model_extr.to(device)

    setattr(model_extr, classification_layer_name, nn.Identity())

    dataset = AnnotatedDataset(samples=X.values, targets=None, transform=extract_transform)

    data_loader = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=8)

    model_extr.eval()

    index = None
    pos = 0

    for inputs, _ in tqdm(data_loader, total=len(data_loader), desc="Extract features"):
        inputs = inputs.to(device)

        with torch.set_grad_enabled(False):
            fe = model_extr(inputs).to('cpu').numpy()

        if index is None:
            index = AnnoyIndex(fe.shape[1], dist_measure)

        for idx, f in enumerate(fe):
            index.add_item(X.index[pos + idx], f)

        pos += len(fe)

    index.build(n_trees)
    index.save(index_file)








