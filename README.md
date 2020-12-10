# sbb-images:

This package currently provides:

* [A tool to annotate images.](doc/annotator.md) 
* [A tool that trains an image classifier](doc/classifier.md) on the basis of the annotations. 
* [A tool that implements an image similarity search](doc/image-search.md) on the basis of an image classifier.

## Installation

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

## Create Image Database

All the tools require a SQLITE database that describes the set of images you are working on.
That database does not store the actual images but only their path.
You can create that image database using a command-line tool provided by this package: 

```
create-database --help
Usage: create-database [OPTIONS] DIRECTORY SQLITE_FILE                                                                                                                                                 
                                                                                                                                                                                                       
  DIRECTORY: Recursively enlist all the image files in this directory. 
  Write the file list into the images table of SQLITE_FILE that is a sqlite3                                                                                                                                 
  database file.                                                                                                                                                                                       
                                                                                                                                                                                                       
Options:                                                                                                                                                                                               
  --pattern TEXT  File pattern to search for. Default: *.jpg                                                                                                                                           
  --help          Show this message and exit.
```

Note that your current `pwd` should be from where you want to run the webapp (annotator or image search) later on.
