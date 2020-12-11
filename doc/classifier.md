## Prerequisites:

In order to train a classifier for some image classification task,
you first need to [annotate](annotator.md) 
a sufficiently large part of your image database according to that task.

## Model selection:

Once you have sufficiently [annotated](annotator.md) your image dataset,
you can find an optimal classifier configuration by means of the model selection tool:

```
model-selection --help
Usage: model-selection [OPTIONS] SQLITE_FILE RESULT_FILE

  Performs a cross-validation in order to select an optimal model and
  training parameters for a given image classification task that is defined
  by an annotated image database (see also annotator).

  SQLITE_FILE: image database (see also create-database).

  RESULT_FILE: A pickled pandas DataFrame that contains the results of the
  cross-validation.

Options:
  --n-splits INTEGER            Number of splits used in cross-validation.
                                Default 10.

  --max-epoch INTEGER           Number of training-epochs.
  --batch-size INTEGER          Training batch-size.
  --start-lr FLOAT              Start learning rate in lr-schedule.
  --momentum FLOAT
  --decrease-epochs INTEGER     Step size of lr-schedule.
  --decrease-factor FLOAT       Decrease factor of lr-schedule.
  --model-name TEXT             One or multiple pre-trained pytorch image
                                classification models to try, see https://pyto
                                rch.org/docs/stable/torchvision/models.html
                                for possible choices. Default resnet18.

  --num-trained-layers INTEGER  One or multiple number of layers to unfreeze.
                                Default [1] (Unfreeze last layer).

  --help                        Show this message and exit.

```

# Model training:

Once you have successfully performed model selection, you can create a 
final classifier that has been trained on the entire annotated part of 
the image database by using the training-tool:

```
train-classifier --help
Usage: train-classifier [OPTIONS] SQLITE_FILE MODEL_SELECTION_FILE MODEL_FILE

  Selects the best model/training parameter combination from a model
  selection and trains a final image classifier on the entire annotated
  image database.

  SQLITE_FILE: An annotated image database (see create-database).
  MODEL_SELECTION_FILE: Results of a model selection created by the "model-
  selection" tool. MODEL_FILE: Store the finally trained image
  classification model in this file.

Options:
  --help  Show this message and exit.

```

Finally, you can classify all the images in the database:
```
apply-classifier --help
Usage: apply-classifier [OPTIONS] SQLITE_FILE MODEL_SELECTION_FILE MODEL_FILE
                        RESULT_FILE

  Classifies all images of an image database and writes the predictions into
  a predictions table of the database. The annotator tool can than display
  those predictions.

  SQLITE_FILE: An annotated image database (see create-database).

  MODEL_SELECTION_FILE: Result file of the model-selection (see model-
  selection).

  MODEL_FILE: A finally trained pytorch model (see train-classifier).

  RESULT_FILE: Additionally write predictions to this pickled pandas
  Dataframe.

Options:
  --train-only  If true, write only pickled predictions but not prediction
                table of database. Default false.

  --help        Show this message and exit.

```
By default, apply-classifier will store the classification results 
within the image database.
Once that has been done, the [annotator](annotator.md) will present 
you the classification results below each image 
such that you only have to correct them. 
Additionally, it provides a filter functionality for the pre-classified image classes 
in order to selectively add training data for some particular image class.
