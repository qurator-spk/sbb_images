from io import open
from setuptools import find_packages, setup

with open('requirements.txt') as fp:
    install_requires = fp.read()

setup(
    name="sbb-images",
    version="0.0.2",
    author="The Qurator Team",
    author_email="qurator@sbb.spk-berlin.de",
    description="An image search engine plus some tool to label images.",
    long_description=open("README.md", "r", encoding='utf-8').read(),
    long_description_content_type="text/markdown",
    keywords='qurator',
    license='Apache',
    url="https://qurator.ai",
    packages=find_packages(exclude=["*.tests", "*.tests.*",
                                    "tests.*", "tests"]),
    package_data={'sbb_images': ['qurator/sbb_images/webapp/static/*/*']},
    include_package_data=True,
    install_requires=install_requires,
    entry_points={
      'console_scripts': [
        "create-accounts=qurator.sbb_images.webapp.cli:create_accounts",
        "create-database=qurator.sbb_images.cli:create_database",
        "create-thumbnails=qurator.sbb_images.cli:create_thumbnails",
        "model-selection=qurator.sbb_images.cli:model_selection",
        "train-classifier=qurator.sbb_images.cli:train",
        "apply-classifier=qurator.sbb_images.cli:apply",
        "create-search-index=qurator.sbb_images.cli:create_search_index",
        "create-sbb-links=qurator.sbb_images.cli_tools.create_sbb_link_table:cli",
        "add-detections=qurator.sbb_images.cli:add_detections",
        "add-page-info-tags=qurator.sbb_images.cli_tools.add_page_info_tags:cli",
        "filter-detections=qurator.sbb_images.cli:filter_detections",
        "image-info=qurator.sbb_images.image_info:cli",

        "saliency-rois=qurator.sbb_images.saliency:saliency_roi_detect",

        "iconclass-train=qurator.sbb_images.iconclass.train:train",
        "iconclass-traintestsplit=qurator.sbb_images.iconclass.train:traintestsplit",
        "iconclass-add-table=qurator.sbb_images.iconclass.cli:add_iconclass_table",
        "iconclass-evaluation=qurator.sbb_images.iconclass.evaluation:evaluate"
        ]
    },
    python_requires='>=3.8.0',
    tests_require=['pytest'],
    classifiers=[
          'Intended Audience :: Science/Research',
          'License :: OSI Approved :: Apache Software License',
          'Programming Language :: Python :: 3',
          'Topic :: Scientific/Engineering :: Artificial Intelligence',
    ],
)
