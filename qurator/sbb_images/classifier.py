import pandas as pd
import copy
import torch
import numpy as np
from torch.utils.data import DataLoader, BatchSampler, RandomSampler
from sklearn.base import BaseEstimator, ClassifierMixin
from .data_access import AnnotatedDataset
from tqdm import tqdm
import torch.nn.functional as F

from torch.utils.checkpoint import checkpoint


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

    def fit(self, X, y, epochs=1, gradient_accumulation_steps=1, use_gradient_checkpointing=False):
        """
        Args:
            gradient_accumulation_steps: Micro-batches to accumulate before
                optimizer.step(). 1 = no accumulation.
                Effective batch = self.batch_size * gradient_accumulation_steps.
            use_gradient_checkpointing: If True, wrap the forward pass with
                activation checkpointing (trades ~30 % extra compute for
                lower peak memory). If False, standard forward pass.
        """

        dataset = AnnotatedDataset(samples=X, targets=y, transform=self.fit_transform,
                                   thumbnail_sqlite_file=self.thumbnail_sqlite_file, table_name="thumbnails")
        num_samples = len(X)
        batches_per_epoch = int(np.ceil(num_samples / self.batch_size))
        accum_steps = gradient_accumulation_steps

        self.model.load_state_dict(self.model_weights)
        self.model.train()

        data_loader = DataLoader(dataset=dataset,
                                 sampler=RandomSampler(dataset, num_samples=batches_per_epoch * self.batch_size * epochs),
                                 batch_size=self.batch_size, num_workers=16, drop_last=False, pin_memory=True)

        # --- forward pass (checkpointed or not) ---
        def _forward(x):
            return self.logits_func(self.model(x))

        def _checkpointed_forward(x):
            return checkpoint(_forward, x, use_reentrant=False)

        forward_fn = _checkpointed_forward if use_gradient_checkpointing else _forward

        # ------------------------------------------

        def train_seq():
            nonlocal data_loader

            for e in range(1, epochs + 1):
                batch_pos = 0
                for _inputs, _labels, _ in data_loader:
                    yield _inputs, _labels
                    batch_pos += 1
                    if batch_pos > batches_per_epoch:
                        break
                self.scheduler.step()

        tqdm_seq = tqdm(train_seq(), total=int(epochs * batches_per_epoch), desc="train", leave=False)

        running_loss = 0.0
        running_corrects = 0.0
        count = 0
        micro_batch_idx = 0
        accum_count = 0
        updates = 0

        for inputs, labels in tqdm_seq:

            inputs = inputs.to(self.device)
            labels = labels.to(self.device)

            micro_batch_idx += 1
            accum_count += 1

            # forward (uses checkpoint or not depending on the flag)
            logits = forward_fn(inputs)
            _, preds = torch.max(logits, 1)

            loss = self.criterion(logits, labels)
            (loss / accum_steps).backward()

            # statistics
            running_loss += loss.item() * inputs.size(0)
            running_corrects += torch.sum(preds == labels.data).double()
            count += inputs.size(0)

            # optimizer step at end of each accumulation cycle (or last batch)
            is_last_of_cycle = (accum_count % accum_steps == 0)
            is_last_batch = (micro_batch_idx >= epochs * batches_per_epoch)
            if is_last_of_cycle or is_last_batch:
                self.optimizer.step()
                self.optimizer.zero_grad(set_to_none=True)
                accum_count = 0
                updates += 1

            tqdm_seq.set_description(
                "train (#Updates: {} Epoch Loss: {:.4f} Acc: {:.4f})".format(updates,
                    running_loss / max(count, 1),
                    running_corrects / max(count, 1),
                )
            )

        self.model_weights = copy.deepcopy(self.model.state_dict())
        self.epoch_loss = running_loss / max(count, 1)
        self.epoch_acc = running_corrects / max(count, 1)

        return self

    def predict(self, X):

        dataset = AnnotatedDataset(samples=X, targets=None, transform=self.predict_transform,
                                   thumbnail_sqlite_file=self.thumbnail_sqlite_file, table_name="thumbnails")

        data_loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=False, num_workers=8)

        self.model.load_state_dict(self.model_weights)

        self.model.eval()

        prediction = list()

        for inputs, _, _ in tqdm(data_loader, total=len(data_loader), desc="predict", leave=False):
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

        for inputs, _, _ in tqdm(data_loader, total=len(data_loader), desc='predict_proba', leave=False):
            inputs = inputs.to(self.device)

            with torch.set_grad_enabled(False):

                logits = self.model(inputs)
                proba.append(F.softmax(logits, dim=1).cpu().numpy())

        return pd.DataFrame(np.concatenate(proba), index=X.index)

