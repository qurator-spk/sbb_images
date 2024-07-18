# An image annotation tool based on [annotorious openseadragon](https://github.com/annotorious/annotorious-openseadragon)

![sbb-ner-demo example](screenshots/region-annotator-example.png?raw=true)

## Features

* An instance of the tool can be setup within a few minutes given basic knowledge about python and nginx. 
* Collaborative editing with multiple users working together is possible
* No separate database server required => backups of the entire annotation data via webinterface possible.
* Export of annotation data as JSON and generic XML
* The tool only requires access to the images via HTTP/HTTPS URLs. These can be IIIF-URLs but other URL schemas are possible. What type of URLs can be loaded into the tool can be pre-configured/restricted.
* Simple user rights system, i.e. normal users and administrators.
