# Image search

![sbb-ner-demo example](screenshots/search_demo.png?raw=true)

## Setup 

Create a search index:
```
create-search-index --help
Usage: create-search-index [OPTIONS] SQLITE_FILE INDEX_FILE

  Creates a CNN-features based similarity search index.

  SQLITE_FILE: Image database (see create-database). INDEX_FILE: Storage file
  for search index.

Options:
  --model-name TEXT             PyTorch name of NN-model. default: "resnet18".
                                Set to "VST" if you want Visual Saliency
                                Transformer features for the search index.
                                Note in that case you also have to provide
                                vit-model and vst-model.
  --batch-size INTEGER          Process batch-size. default: 32.
  --dist-measure TEXT           Distance measure of the approximate nearest
                                neighbour index. default: angular.
  --n-trees INTEGER             Number of search trees. Default 10.
  --num-workers INTEGER         Number of parallel workers during index
                                creation.Default 8.
  --vit-model PATH              Vision transformer pytorch model file
                                (required by Visual Saliency Transformer).
  --vst-model PATH              Visual saliency transformer pytorch model
                                file.
  --clip-model TEXT             CLIP model.
  --ms-clip-model TEXT          MSCLIP model configuration file.
  --layer-name TEXT             Name of feature layer. default: fc
  --layer-output                User output of layer rather than its input.
  --use-saliency-mask           Mask images by saliency before feature
                                computation. Note: you need to provide vit-
                                model and vst-model in that case.
  --pad-to-square TEXT          Pad-to-square before application of model
                                image transform (typically resize + center-
                                crop).
  --thumbnail-sqlite-file TEXT  Do not read the image from the file system but
                                rather try to read them from this sqlite
                                thumbnail file.
  --thumbnail-table-name TEXT   Do not read the image from the file system but
                                rather try to read them from this table in the
                                thumbnail sqlite file.
  --help                        Show this message and exit.

```

Edit qurator/sbb_images/webapp/search-config.json such that it points to your image database and to 
your search index.
Adapt the other options in that file to your needs:

### search-config.json:
* PASSWD_FILE: Password file. Use if password protection of the image search is desired.
* SQLITE_FILE: The image database.
* MAX_IMG_SIZE: Scale images down if they exceed this size.
* MODEL_NAME: PyTorch name of CNN-model that is used to generate the search features, for instance resnet18.
* INDEX_FILE: Search index file.
* DIST_MEASURE: Distance measure that has been used to create the search index, for instance "angular".

## Run image search:

```
env FLASK_APP=qurator/sbb_images/webapp/search.py env FLASK_ENV=development flask run --port=8080 --host=0.0.0.0
```

Image search is available at [http://localhost:8080]().