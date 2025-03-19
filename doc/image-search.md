# Image search

![search-by-image](screenshots/search-by-image.png?raw=true)

## Features

* Comparison of multiple models / datasets
* Search by example image
* Search by textual description (if supported by configured model)
* Search by boolean expression on tags
* Search by boolean expression on filename
* Search by Iconclass label (if supported by configured model)
* Tagging of images / export of tag-sets as Excel file
* Tags can be used to train [image classifiers](classifier.md)
* Image classifiers can be used in order to [create new tags](classifier.md)
* Can be connected to [region-annotation tool](region-annotator.md)
* Various meta-data can be easily imported as tags

## Setup 

Please look into the [setup doc](image-search-setup.md).

## Settings Section

Multiple image databases and models can be configured. The settings section is used to switch between image sets/databases 
and/or models. See [setup doc](image-search-setup.md) for how to configure multiple databases/models.

## Search by Image

Find images that are similar to a given example image. 
The example image can either be provided by file upload or pasted with Ctrl-V from the clipboard.
Click on the "More" button of some search result image in order to find similar images to that image.

![search-by-image](screenshots/search-by-image.png?raw=true)

## Search by Description

Find images on the basis of a description provided in terms of free text.

NOTE: Textual search might only be supported by some models while being not available for pure image models 
as for instance [Inception](https://www.cv-foundation.org/openaccess/content_cvpr_2015/html/Szegedy_Going_Deeper_With_2015_CVPR_paper.html).

![search-by-description](screenshots/search-by-description.png?raw=true)

## Search by Boolean Expression on Tags

Find images by a match of a boolean expression to image tags that have been either imported from existing meta data
such as MODS/METS data, domain expert provided Iconclass tags, or user supplied tags that have been added to the images 
via the interface of the image search.

*A* | *B & *C* & !*D* finds those images that have one or more tags that contain the character string A 
or end with the character string B and contain the character string C and do not contain the character string D.

In addition to the * operator, the ? operator, which stands for exactly one arbitrary character, 
as well as character ranges and negation are supported.

*A?? finds all tags that end with A followed by two arbitrary characters.

*A[0-9] finds all tags that end with A followed by a number 0-9.

*A[^0-9] finds all tags that end with A followed by a character that is not 0-9.

### Sorting order

The order of the search results in the tag and file name search can be controlled by the order in the search query.

A & B first delivers the results that match A and then the results that match B. Within A, 
the results are sorted according to the matching tags/file names, the same applies to the order within B.

## Tagging Interface

The tagging interface can be enabled by configuration of a htpasswd user accounts file in JSON conf file of the image search
(see [setup doc](image-search-setup.md) for details).
The tagging interface provides functionality to registered users to add/remove tags to/from images as well as to export tag sets
as Excel-sheets.

![search-by-tags](screenshots/search-by-tag.png?raw=true)

## Search by Boolean Expression on Filename

For filename search the same applies as for the tag search - only that the queries naturally refer to the image filenames instead of tags.

![search-by-filename](screenshots/search-by-filename.png?raw=true)

## Search by Iconclass

At [SBB](https://staatsbibliothek-berlin.de/),
we performed [experiments](https://dl.acm.org/doi/abs/10.1145/3604951.3605516) to adapt published image-text similarity models
such as [MSCLIP](https://github.com/Hxyou/MSCLIP) to specific domains like [Iconclass](https://iconclass.org/).

For Iconclass, we implemented a special search mode that uses the [Iconclass package ](https://pypi.org/project/iconclass/)
in order to translate a given Iconclass label into its corresponding textual equivalent. The textual equivalent is then 
fed into the model and used for similarity search. 

NOTE: this functionality works only if the configured model has been
adapted to the particular Iconclass domain in order to correctly map the textual equivalents to images.
In our work mentioned above, we show that at least for the approach used in the experiments this goal is achieved to
certain degree only for image descriptive and pre-iconographic concepts but fails for iconographic concepts.

### Iconclass visualization

The frontend detects if particular image tags are Iconclass labels and applies a specific visualization to the tags on click.
For normal tags only tags of other images that are exactly the same are highlighted - for Iconclass tags also related concepts
are highlighted - the brighter some other tag is highlighted the closer it is to the selected tag in the Iconclass hierarchy.

![search-by-iconclass](screenshots/search-by-iconclass.png?raw=true)