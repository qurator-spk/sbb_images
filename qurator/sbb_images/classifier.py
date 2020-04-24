import pandas as pd
import copy
import torch
import numpy as np
from torch.utils.data import DataLoader
from sklearn.base import BaseEstimator, ClassifierMixin
from .data_access import AnnotatedDataset
from tqdm import tqdm
import torch.nn.functional as F


class ImageClassifier(BaseEstimator, ClassifierMixin):

    def __init__(self, model, model_weights, device, criterion, optimizer, scheduler,
                 fit_transform, predict_transform, batch_size, logits_func=None):

        self.model = model
        self.model_weights = model_weights
        self.device = device
        self.criterion = criterion
        self.optimizer = optimizer
        self.scheduler = scheduler
        self.fit_transform = fit_transform
        self.predict_transform = predict_transform
        self.batch_size = batch_size
        self.epoch_loss = None
        self.epoch_acc = None
        self.logits_func = logits_func

    def fit(self, X, y):

        dataset = AnnotatedDataset(samples=X.values, targets=y.values, transform=self.fit_transform)

        data_loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True, num_workers=8, drop_last=True)

        running_loss = 0.0
        running_corrects = 0

        self.model.load_state_dict(self.model_weights)

        self.model.train()

        for inputs, labels in tqdm(data_loader, total=len(data_loader), desc="train"):
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
            running_corrects += torch.sum(preds == labels.data)

        self.scheduler.step()

        self.epoch_loss = running_loss / len(X)
        self.epoch_acc = running_corrects.double() / len(X)

        print('Train Loss: {:.4f} Acc: {:.4f}'.format(self.epoch_loss, self.epoch_acc))

        self.model_weights = copy.deepcopy(self.model.state_dict())

        return self

    def predict(self, X):

        dataset = AnnotatedDataset(samples=X.values, targets=None, transform=self.predict_transform)

        data_loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=False, num_workers=8)

        self.model.load_state_dict(self.model_weights)

        self.model.eval()

        prediction = list()

        for inputs, _ in tqdm(data_loader, total=len(data_loader), desc="predict"):
            inputs = inputs.to(self.device)

            with torch.set_grad_enabled(False):
                logits = self.model(inputs)
                _, preds = torch.max(logits, 1)

                prediction.append(preds.cpu().numpy())

        return pd.DataFrame(np.concatenate(prediction), index=X.index)

    def predict_proba(self, X):

        dataset = AnnotatedDataset(samples=X.values, targets=None, transform=self.predict_transform)

        data_loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=False, num_workers=8)

        self.model.load_state_dict(self.model_weights)

        self.model.eval()

        proba = list()

        for inputs, _ in tqdm(data_loader, total=len(data_loader), desc='predict_proba'):
            inputs = inputs.to(self.device)

            with torch.set_grad_enabled(False):

                logits = self.model(inputs)
                proba.append(F.softmax(logits, dim=1).cpu().numpy())

        return pd.DataFrame(np.concatenate(proba), index=X.index)

