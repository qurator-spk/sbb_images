# sbb-images:

This package currently provides:

* [A tool to annotate multiple regions in an image with multiple tags.](doc/region-annotator.md)
* [A tool to annotate images with on unique label per image.](doc/annotator.md) 
* [A tool that trains an image classifier](doc/classifier.md) on the basis of the annotations. 
* [A tool that implements an image similarity search](doc/image-search.md) on the basis of an image classifier.

A main design goal of this package is to provide simple separate tools that each solve a simple constrained problem 
while allowing for interaction between these tools in a loosely coupled way.

## Installation

Required python version is 3.8. 
Consider use of [pyenv](https://github.com/pyenv/pyenv) if that python version is not available on your system. 

Activate virtual environment:
```
source venv/bin/activate
```
or
```
pyenv activate my-python-3.8-virtualenv
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

  DIRECTORY: Recursively enlist all the image files in this directory. Write
  the file list into the images table of SQLITE_FILE that is a sqlite3
  database file.

Options:
  --pattern TEXT           File pattern to search for. Default: *.jpg
  --follow-symlinks
  --subset-json PATH       Consider only the subset of image files defined in
                           this json file.
  --subset-dirs-json PATH  Recursively search only through a subset of sub-
                           directories as defined in this json file.
  --help                   Show this message and exit.

```

In order to speed up things, some command line tools of this package can use a pre-compiled thumbnail 
database instead of loading the images directly from disk. 
Depending on the type of disk storage this pre-compilation can heavily improve processing speed.

That thumbnail database can be created follows:
```
create-thumbnails --help
Usage: create-thumbnails [OPTIONS] DIRECTORY SQLITE_FILE

  DIRECTORY: Recursively enlist all the image files in this directory and add
  them to the thumbnail database. Write the thumbnail information to the
  thumbnails table of SQLITE_FILE that is a sqlite3 database file.

Options:
  --pattern TEXT           File pattern to search for. Default: *.jpg
  --follow-symlinks
  --subset-json PATH       Consider only the subset of image files defined in
                           this json file.
  --subset-dirs-json PATH  Recursively search only through a subset of sub-
                           directories as defined in this json file.
  --max-img-size INTEGER   Scale all the images before storing such that the
                           maximum of their width and height is equal to this
                           values (default 250).
  --processes INTEGER      Number of parallel processes to be used.
  --help                   Show this message and exit.
```

Note that your current `pwd` should be from where you want to run the webapp (annotator, region-annotator or image search) later on.
