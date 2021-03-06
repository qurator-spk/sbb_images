![sbb-ner-demo example](screenshots/annotator_demo.png?raw=true)

## Setup Annotator:

Edit qurator/sbb_images/webapp/annotator-config.json such that it points to the 
sqlite file that has been created by create-database.

Create a passwd file:
```
htpasswd -c .htpasswd username
```

Edit qurator/sbb_images/webapp/annotator-config.json such that it points to ".htpasswd".

Adapt the other options in that file such that they fit your desired image classification task:

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