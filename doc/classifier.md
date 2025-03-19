# Image Database Classification

## Prerequisites:

In order to train a classifier for some image classification task,
you first need to annotate a sufficiently large part of your image database according to that task.
You can do that either using the single label [Annotator](annotator.md) or 
using the tagging interface of the [image-search](image-search.md).

## Model selection:

Once you have sufficiently annotated your image dataset,
you can find an optimal classifier configuration by means of the model selection tool:

```
model-selection --help
Usage: model-selection [OPTIONS] [SQLITE_FILE]... RESULT_FILE

  Performs a cross-validation in order to select an optimal model and training
  parameters for a given image classification task that is defined by
  annotated image database(s).

  It can use either the annotations provided by the annotator or tags that
  have been added in the image search interface.

  SQLITE_FILE ...: One or more image database(s) containing the labels in
  either the annotations or tags table (see also create-database).

  RESULT_FILE: A pickled pandas DataFrame that contains the results of the
  cross-validation.

Options:
  --thumbnail-sqlite-file TEXT  Do not read the images from the file system
                                but rather try to read them from one of these
                                sqlite thumbnail file(s).
  --n-splits INTEGER            Number of splits used in cross-validation.
                                Default 10.
  --max-epoch INTEGER           Number of training-epochs.
  --batch-size INTEGER          Training batch-size.
  --start-lr FLOAT              Start learning rate in lr-schedule.
  --decrease-epochs INTEGER     Step size of lr-schedule.
  --decrease-factor FLOAT       Decrease factor of lr-schedule.
  --model-name TEXT             One or multiple pre-trained pytorch image
                                classification models to try, see https://pyto
                                rch.org/docs/stable/torchvision/models.html
                                for possible choices. Default resnet18.
  --num-trained-layers INTEGER  Number of fully connected layers to be added-.
                                Default [1]. Can be provided multiple times to
                                try different settings in a grid-search.
  --freeze-percentage FLOAT     Percentage of the pre-trained network to
                                freeze. Default [1.0] (Freeze entire
                                pretrained network).Can be provided multiple
                                times to try different settings in a grid-
                                search.
  --label-table-name TEXT       Either 'annotations' or 'tags'. Use
                                'annotations' if labels have been made with
                                the annotator, use 'tags' if labels stem from
                                tags in the image search interface, default is
                                'annotations'.
  --label TEXT                  This option has to be provided multiple times,
                                listing all the labels from the tags table
                                that should be used as classifier classes.
  --label-groups TEXT           Dictionary definition how to summarize labels
                                in groups and train a new classifier for those
                                label groups. Example for a classifier with
                                two classes "exclude" and "include":
                                '{"exclude": ["Übriges", "Gesetzter_Text",
                                "Einband", "Stempel", "Farbtafel", "Ornament",
                                "Signatur", "Handschrift", "Noten"],
                                "include": ["Abbildung", "Photo", "Karte",
                                "Initiale", "Druckermarke", "Noten",
                                "Vignette", "Exlibris"]}'
  --epoch-steps INTEGER         Step size of epoch increase.
  --help                        Show this message and exit.
```

## Model training:

Once you have successfully performed model selection, you can create a 
final classifier that has been trained on the entire annotated part of 
the image database by using the training-tool:

```
train-classifier --help
Usage: train-classifier [OPTIONS] SQLITE_FILE MODEL_SELECTION_FILE MODEL_FILE

  Selects the best model/training parameter combination from a model selection
  and trains a final image classifier on the entire annotated part of the
  image database.

  SQLITE_FILE: An annotated image database (see create-database).
  MODEL_SELECTION_FILE: Results of a model selection created by the "model-
  selection" tool. MODEL_FILE: Store the finally trained image classification
  model in this file.

Options:
  --thumbnail-sqlite-file TEXT  Do not read the image from the file system but
                                rather try to read them from this sqlite
                                thumbnail file.
  --label-table-name TEXT       Either 'annotations' or 'tags'. Use
                                'annotations' if labels have been made with
                                the annotator, use 'tags' if labels stem from
                                tags in the image search interface, default is
                                'annotations'.
  --label TEXT                  This option has to be provided multiple times,
                                listing all the labels from the tags table
                                that should be used as classifier classes.
  --label-groups TEXT           Dictionary definition how to summarize labels
                                in groups and train a new classifier for those
                                label groups. Example for a classifier with
                                two classes "exclude" and "include":
                                '{"exclude": ["Übriges", "Gesetzter_Text",
                                "Einband", "Stempel", "Farbtafel", "Ornament",
                                "Signatur", "Handschrift", "Noten"],
                                "include": ["Abbildung", "Photo", "Karte",
                                "Initiale", "Druckermarke", "Noten",
                                "Vignette", "Exlibris"]}'
  --help                        Show this message and exit.
```

## Model application

Finally, you can classify all the images in the database:
```
apply-classifier --help
Usage: apply-classifier [OPTIONS] SQLITE_FILE MODEL_SELECTION_FILE MODEL_FILE
                        RESULT_FILE

  Classifies all images of an image database and writes the predictions into
  either a predictions table or the tags table of the database. Both the image
  search interface and the annotator tool can then display the predictions.

  SQLITE_FILE: An annotated image database (see create-database).

  MODEL_SELECTION_FILE: Result file of the model-selection (see model-
  selection).

  MODEL_FILE: A finally trained pytorch model (see train-classifier).

  RESULT_FILE: Additionally write predictions to this pickled pandas
  Dataframe.

Options:
  --thumbnail-sqlite-file TEXT  Do not read the images from the file system
                                but rather try to read them from this sqlite
                                thumbnail file.
  --train-only                  Apply classifier only to training subset.
  --write-to-table TEXT         Either "tags" or "predictions". Use "tags" if
                                you want to add new classifier tags to an
                                image search interface and use "predictions"
                                if you want to use the classifier output in
                                the annotator interface.
  --label-table-name TEXT       Either 'predictions' or 'tags'. Use
                                'predictions' if labels have been made with
                                the annotator, use 'tags' if labels stem from
                                tags in the image search interface, default is
                                'annotations'.
  --label TEXT                  This option has to be provided multiple times
                                in case of "label-table-name=tags". List all
                                the labels from the tags table that should be
                                used for the classifier.
  --label-groups TEXT           Optional: dictionary definition how to
                                summarize labels in groups and train a new
                                classifier for those label groups. Example for
                                a classifier with two classes "exclude" and
                                "include":  '{"exclude": ["Übriges",
                                "Gesetzter_Text", "Einband", "Stempel",
                                "Farbtafel", "Ornament", "Signatur",
                                "Handschrift", "Noten"], "include":
                                ["Abbildung", "Photo", "Karte", "Initiale",
                                "Druckermarke", "Noten", "Vignette",
                                "Exlibris"]}'.
  --tag-prefix TEXT             Prefix for the classification tags that will
                                be added to the tags table. default is
                                "Classifier:".
  --username TEXT               Tag prefix. default is  "classifier".
  --remove-user-tags            Specify this option in order to remove all
                                tags from the user "username" from the tags
                                table before additing the new tags. BEWARE:
                                All tags for that user will be deleted and
                                cannot be restored without a backup of the
                                sqlite file.
  --training-database PATH      The database where the training images come
                                form is different from the database that the
                                classifieris applied to. In that case use this
                                parameter (multiple times) in order to
                                specifiy all the training databases.
  --help                        Show this message and exit.

```
By default, apply-classifier will store the classification results 
within the image database.

In case of --write-to-table=predictions the [annotator](annotator.md) will present 
you the classification results below each image  such that you only have to correct them.
Additionally, it provides a filter functionality for the pre-classified image classes 
in order to selectively add training data for some particular image class.

In case of --write-to-table=tags the [image-search interface](image-search.md) will show the predictions 
produced by the classifier as tags with prefix --tag-prefix=... . These classifier tags can be used to filter the image
database by means of the tag search in the image search interface.

