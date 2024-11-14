# An Image Annotation Tool based on [Annotorious Openseadragon](https://github.com/annotorious/annotorious-openseadragon)

![region-annotator-example](screenshots/region-annotator-example.png?raw=true)

## Features

* Based on [annotorious openseadragon](https://github.com/annotorious/annotorious-openseadragon) - annotations according to [W3C web annotation data model](https://www.w3.org/TR/annotation-model/). 
* An instance of the tool can be setup within a few minutes given basic knowledge about python and nginx. 
* Collaborative editing with multiple users working together is possible.
* No separate database server required => backups of the entire annotation data via webinterface possible.
* Export of annotation data as JSON and generic XML.
* The tool only requires access to the images via HTTP/HTTPS URLs. These can be IIIF-URLs but other URL schemas are possible. What type of URLs can be loaded into the tool can be pre-configured/restricted.
* Simple user rights system, i.e. normal users and administrators.
* Can be used in tandem with [SBB image search](image-search.md)

## Setup

Required python version is 3.11. 
Consider use of [pyenv](https://github.com/pyenv/pyenv) if that python version is not available on your system. 

Activate virtual environment (virtualenv):
```
source venv/bin/activate
```
or (pyenv):
```
pyenv activate my-python-3.11-virtualenv
```

Make sure that you have the most recent pip:
```
pip install -U pip
```
Install sbb_images package:
```
pip install git+https://github.com/qurator-spk/sbb_images.git
```

Create a passwd file:
```
htpasswd -c .htpasswd username_A
htpasswd .htpasswd username_B
...
```

Create a JSON configuration file named "region-annotator-config.json" (content see below).

Start region-annotator instance:
```commandline
gunicorn --timeout 600 --chdir . --bind 0.0.0.0:4713 qurator.sbb_images.webapp.wsgi_region_annotator:app
```
Now, region-annotator is available on localhost:4713 . In order to annotate URLs they have to be configured. See section below.
Since region-annotator uses basic-auth authentication its direct use is only recommend in a trusted environment
like a VPN or other private network. If you want to access it through an untrusted network you should put it behind 
an https proxy such as nginx or apache.

Here a template of an example nginx configuration that makes region-annotator available at https://your.host.name/region-annotator/ :
```nginx
server {
    listen 443 ssl;
    server_name _;

    ssl_certificate     /etc/letsencrypt/live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/privkey.pem;

    ssl_protocols       TLSv1.2 TLSv1.3;

    ssl_ciphers "ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA:ECDHE-RSA-AES128-SHA:ECDHE-RSA-DES-CBC3-SHA:AES256-GCM-SHA384:AES128-GCM-SHA256:AES256-SHA256:AES128-SHA256:AES256-SHA:AES128-SHA:DES-CBC3-SHA:!aNULL:!eNULL:!EXPORT:!DES:!MD5:!PSK:!RC4";
    ssl_prefer_server_ciphers on;

    root /srv/public_html;
 
    location /region-annotator/ {
     proxy_pass http://localhost:4713/;
    }
}
                 
```
In order to automatically start the region-annotator instance, 
we recommend to add a systemd service file /etc/systemd/system/region-annotator.service. 
Here an example template (with pyenv):
```systemd
[Unit]
Description=Region Annotator
After=network.target

[Service]
User=webservice
Group=webservice
WorkingDirectory=/home/webservice/region-annotator
Environment="PATH=/home/webservice/.pyenv/versions/region-annotator-3.8/bin"
Environment="CONFIG=region-annotator-config.json"
ExecStart=/home/webservice/.pyenv/versions/region-annotator-3.8/bin/gunicorn --timeout 600 --chdir . --bind 0.0.0.0:4713 qurator.sbb_images.webapp.wsgi_region_annotator:app
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true

```
The service has to enabled permanently with
```commandline
systemctl enable region-annotator.service
```
and than started:
```commandline
systemctl restart region-annotator.service
```

## Configuration file
```json
{
    "PASSWD_FILE": ".htpasswd",
    "AUTH_REALM": "region-annotate",
    "SQLITE_FILE": "region-annotations.sqlite",
    "ADMIN_USERS": ["username_A"],
    "COOPERATIVE_ACCESS": true,
    "COOPERATIVE_MODIFICATION": false
}
```
* PASSWD_FILE: htpasswd file that contains user login information
* AUTH_REALM: Used by the web browser to manage login information - if region-annotator is used in connection with the image search the same auth realm can be used so that users have to enter their login credentials only once.
* SQLITE_FILE: sqlite database where the instance stores all the annotation data. That file will be newly created if it is not already present.
* ADMIN_USERS: List of admin users. Admin users are allowed to view and edit all annotations and have access to the configuration and data export pages.
* COOPERATIVE_ACCESS: If true then all users can see the annotations of all other users.
* COOPERATIVE_MODIFICATION: If true then all users can modify the annotations of all other users. Otherwise each user can only modify its own annotations.

## Configuration Page

Admin users can access the configuration page.

![region-annotator-admin-detail1](screenshots/region-annotator-admin-detail1.png?raw=true)

URLs of images that are to be annotated need to be configured in the configuration page. 
The tool will load only those image-URLs that match either a configured pattern or a configured complete URL. 
Complete URLs or URL-patterns can be added together with an optional description.

An example of an URL-pattern:

```text
https://content.staatsbibliothek-berlin.de/dms/PPN*/1200/0/*.jpg
```

Configuration example:

![region-annotator-configuration](screenshots/region-annotator-configuration.png?raw=true)

## Data Export

Admin users can access the data export page.

![region-annotator-admin-detail1](screenshots/region-annotator-admin-detail1.png?raw=true)

The data export page provides functionality to download the annotation data of particular users/URLs either 
in JSON or generic XML. Additionally, a sqlite database backup can be downloaded which contains the entire state of the tool 
and enables the complete restore of the setup (apart from the user login information that is stored in the htpasswd file).

Data export example:

![region-annotator-export](screenshots/region-annotator-export.png?raw=true)

See 
[The labours of the months in medieval manuscripts: Image Annotations with ICONCLASS](https://zenodo.org/records/8358608)
for example results that have been obtained with region annotator during a datathon in the [Stabi-Lab](https://lab.sbb.berlin/datenset-datathon/).
In that case the generic XML data has been transformed into TEI by means of an [XSLT-transformation](region-annotator-TEI.xsl). 
