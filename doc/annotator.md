# Single Label Annotator

The single label annotator is a very simple tool the supports to label sets of images according to a small 
number of pre-defined classes. It supports multiple users and stores the labels on a per-user basis.
It writes into the 'annotations' table of the connected sqlite database. This table can be used with the 
[classification tools](classifier.md) to train a classifier.

![sbb-ner-demo example](screenshots/annotator_demo.png?raw=true)

## Setup Annotator:

Edit qurator/sbb_images/webapp/annotator-config.json such that it points to the 
sqlite file that has been created by create-database.

Create a passwd file:
```
htpasswd -c .htpasswd username
```

Edit qurator/sbb_images/webapp/config/annotator-config.json such that it points to ".htpasswd".

Adapt the other options in that file such that they fit your desired image classification task:

## User-Interface

* A : The image to be labeled.
* B : The label that has been proposed by a classifier.
* C : Re-label the image according to one of these classes.
* D : Confirm the current label below the image and go to the next randomly chosen image.
* E : Preselect subset of images to be labeled based on predictions provided by a classifier.

### annotator-config.json:
* LABELS: The image classes that you want to assign to your images. 
* PASSWD_FILE: The passwd file that contains the authentication data.
* SQLITE_FILE: The image database that has been created by create-database.
* NUM_ANNOTATIONS: Number of required annotations per image.
* WORKING_SET_SIZE: Number of "active" images within the annotations pool. 
Annotator randomly selects some image that is to be annotated from that pool.
If some image from that pool has been NUM_ANNOTATIONS times annotated, it would be removed and a new randomly chosen image will be added to the pool.
* MAX_IMG_SIZE: If some image is on disk larger than MAX_IMG_SIZE, it would be scaled down to MAX_IMG_SIZE in order to save bandwidth.   

## Run Annotator:

Development:
```
env FLASK_APP=qurator/sbb_images/webapp/annotator.py env FLASK_ENV=development flask run
```

Production:
```
gunicorn --bind 0.0.0.0:5000 qurator.sbb_images.webapp.wsgi_annotator:app
```
***

You find the annotation interface at [http://localhost:5000]().