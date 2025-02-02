# Image Search Setup

We explain the setup of the image search using an example configuration for the 
[Extracted Illustrations of the Berlin State Library's Digitized Collections](https://zenodo.org/records/2602431)
that can be downloaded from zenodo. We provide a [Makefile](../digisam/Makefile) 
and a [configuration file](../digisam/search-config.json) that can be used as a starting point 
for other deployments.

# Step-by-Step recipe

Create a python 3.11 virtual environment named digisam-3.11 either using virtualenv or [pyenv](https://github.com/pyenv/pyenv) depending on your system.

Activate virtual environment:
```commandline
virtualenv source digisam-3.11/bin/activate
```
or
```commandline
pyenv activate digisam-3.11
```
Make sure you that have the most recent pip:
```commandline
pip install -U pip
```
Install sbb_images:
```commandline
pip install git+https://github.com/qurator-spk/sbb_images.git
```

Create a new working directory and download the [Extracted Illustrations of the Berlin State Library's Digitized Collections](https://zenodo.org/records/2602431)
from zenodo and extract the image archives. This can be done with the [Makefile](../digisam/Makefile).
Copy the [Makefile](../digisam/Makefile) into the working directory and run the "download" target. 
That step takes probably several hours - depending on your internet connection. 
NOTE: Due to the space requirements of the zip extraction process and the size of the download image data, 
you need roughly 500GB free space for the working directory.
Run:
```commandline
make download
```
After running the download target and copying the [Makefile](../digisam/Makefile) and [configuration file](../digisam/search-config.json) into the working directory, you should end up 
with the following directory structure:
```commandline
├── Makefile
├── search-config.json
├── MSCLIP
│   ├── original
│   │   ├── b16-yfcc-msclips_ckpt.pth
│   │   ├── b32-laion-msclips_ckpt.pth
│   │   ├── b32-yfcc-msclips_ckpt.pth
│   │   └── config
│   │       ├── b16-yfcc-msclips.yaml
│   │       ├── b32-laion-msclips.yaml
│   │       ├── b32.yaml
│   │       └── b32-yfcc-msclips.yaml
│   └── tokenizer
│       └── bpe_simple_vocab_16e6.txt.gz
├── Stabi-Illustrationen
```
Note: Stabi-Illustrationen is the folder obtained from the zenodo archives - created by the download target.
[Makefile](../digisam/Makefile) and [search-config.json](../digisam/search-config.json) are located in the [digisam](../digisam/) subfolder of this project.
The original MS-CLIP checkpoints (*.pth) and YAML files can also be downloaded from the [MSCLIP repo](https://github.com/Hxyou/MSCLIP/blob/main/README.md) - though this should not be necessary since they should have been downloaded automatically.
Only if you download the original YAML files you might have to adapt the path information in these files, i.e., it is the PRETRAINED_MODEL entry in the YAML files that has to be set to the correct relative path.

Enter your working directory that has the file structure shown above. 
Create the image database (Note: You might have to add the --follow-symlinks option to the create-database call in the Makefile if your image directory structure contains symlinks) :
```commandline
make ./stabi-illustrations.sqlite
```
Create the thumbnail database (Note: You might have to add the --follow-symlinks option to the create-thumbnails call in the Makefile if your image directory structure contains symlinks which should not be the case by default):
```commandline
make thumbnails
```
Create the image indices:
```commandline
make googlenet-index
make msclip-indices
```
Run image search:
```commandline
make run-service-production
```
Image search is available at [http://localhost:4716]().

## Adding authentication

The PASSWD_FILE entry in the provided configuration file is empty. This variable can be set to a htpasswd file so that 
only registered users have access to the image search. Authentication is implemented via basic-auth in that case. 
If running on a unsecure network which is typically the default you are required to put a https proxy in front of the image search.

## Connecting to Region Annotator

To be written.
