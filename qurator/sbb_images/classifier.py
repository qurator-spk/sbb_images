import pandas as pd
import copy
import torch
import numpy as np
from torch.utils.data import DataLoader, BatchSampler, RandomSampler
from sklearn.base import BaseEstimator, ClassifierMixin
from .data_access import AnnotatedDataset
from tqdm import tqdm
import torch.nn.functional as F


class ImageClassifier(BaseEstimator, ClassifierMixin):

    def __init__(self, model, model_weights, device, criterion, optimizer, scheduler,
                 fit_transform, predict_transform, batch_size, logits_func=None, thumbnail_sqlite_file=None):

        self.model = model
        self.model_weights = model_weights
        self.device = device
        self.criterion = criterion
        self.optimizer = optimizer
        self.scheduler = scheduler
        self.fit_transform = fit_transform
        self.predict_transform = predict_transform
        self.batch_size = batch_size
        self.epoch_loss = np.inf
        self.epoch_acc = 0.0
        self.logits_func = logits_func
        self.thumbnail_sqlite_file = thumbnail_sqlite_file

    def fit(self, X, y, epochs=1):

        dataset = AnnotatedDataset(samples=X, targets=y, transform=self.fit_transform,
                                   thumbnail_sqlite_file=self.thumbnail_sqlite_file, table_name="thumbnails")
        running_loss = 0.0
        running_corrects = 0
        num_samples = len(X)
        batches_per_epoch = int(np.ceil(num_samples*epochs/self.batch_size))/epochs

        self.model.load_state_dict(self.model_weights)
        self.model.train()

        data_loader = DataLoader(dataset=dataset, sampler=RandomSampler(dataset, num_samples=num_samples*epochs),
                                 batch_size=self.batch_size, num_workers=16, drop_last=False, pin_memory=True)

        tqdm_seq = None

        def train_seq():
            nonlocal data_loader
            nonlocal running_loss
            nonlocal running_corrects

            data_seq = iter(data_loader)

            for e in range(1, epochs+1):
                tqdm_seq.set_description("train (Epoch {} Train Loss: {:.4f} Acc: {:.4f})".format(e,
                                         self.epoch_loss, self.epoch_acc))

                running_loss = 0.0
                running_corrects = 0

                batch_pos = 0
                for _inputs, _labels, _ in data_seq:
                    yield _inputs, _labels

                    batch_pos += 1
                    if batch_pos > batches_per_epoch:
                        break

                self.epoch_loss = running_loss / len(X)
                self.epoch_acc = running_corrects / len(X)
                self.scheduler.step()

        tqdm_seq = tqdm(train_seq(), total=int(epochs*batches_per_epoch), desc="train")

        for inputs, labels in tqdm_seq:
            inputs = inputs.to(self.device)
            labels = labels.to(self.device)

            # zero the parameter gradients
            self.optimizer.zero_grad()

            # forward
            with torch.set_grad_enabled(True):
                logits = self.logits_func(self.model(inputs))
                _, preds = torch.max(logits, 1)

                loss = self.criterion(logits, labels)

                loss.backward()
                self.optimizer.step()

            # statistics
            running_loss += loss.item() * inputs.size(0)
            running_corrects += torch.sum(preds == labels.data).double()

        self.model_weights = copy.deepcopy(self.model.state_dict())

        return self

    def predict(self, X):

        dataset = AnnotatedDataset(samples=X, targets=None, transform=self.predict_transform,
                                   thumbnail_sqlite_file=self.thumbnail_sqlite_file, table_name="thumbnails")

        data_loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=False, num_workers=8)

        self.model.load_state_dict(self.model_weights)

        self.model.eval()

        prediction = list()

        for inputs, _, _ in tqdm(data_loader, total=len(data_loader), desc="predict"):
            inputs = inputs.to(self.device)

            with torch.set_grad_enabled(False):
                logits = self.model(inputs)
                _, preds = torch.max(logits, 1)

                prediction.append(preds.cpu().numpy())

        return pd.DataFrame(np.concatenate(prediction), index=X.index)

    def predict_proba(self, X):

        dataset = AnnotatedDataset(samples=X, targets=None, transform=self.predict_transform,
                                   thumbnail_sqlite_file=self.thumbnail_sqlite_file, table_name="thumbnails")

        data_loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=False, num_workers=8)

        self.model.load_state_dict(self.model_weights)

        self.model.eval()

        proba = list()

        for inputs, _, _ in tqdm(data_loader, total=len(data_loader), desc='predict_proba'):
            inputs = inputs.to(self.device)

            with torch.set_grad_enabled(False):

                logits = self.model(inputs)
                proba.append(F.softmax(logits, dim=1).cpu().numpy())

        return pd.DataFrame(np.concatenate(proba), index=X.index)

