## Setup Annotator:

Create virtual environment:
```
virtualenv --python=python3.6 venv
```
Activate virtual environment:
```
source venv/bin/activate
```
Update pip:
```
pip install -U pip
```
Install sbb_images:
```
pip install -e ./
```
Create image database. 

DIRECTORY is where the image files are located.

Note that your current `pwd` should be from where you want to run the webapp later on:

```
create-database --help
Usage: create-database [OPTIONS] DIRECTORY SQLITE_FILE

Options:
  --help  Show this message and exit.
```

Edit qurator/sbb_images/webapp/config.json such that it points to the sqlite file that has been created by create-database.

Create a passwd file:
```
htpasswd -c .htpasswd username
```

Edit qurator/sbb_images/webapp/config.json such that it points to ".htpasswd".

Proceed to "Run Annotator".

### config.json:
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

