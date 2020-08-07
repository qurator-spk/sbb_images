from io import open
from setuptools import find_packages, setup

with open('requirements.txt') as fp:
    install_requires = fp.read()

setup(
    name="image-annotator",
    version="0.0.1",
    author="The Qurator Team",
    author_email="qurator@sbb.spk-berlin.de",
    description="A tool to label images.",
    long_description=open("README.md", "r", encoding='utf-8').read(),
    long_description_content_type="text/markdown",
    keywords='qurator',
    license='Apache',
    url="https://qurator.ai",
    packages=find_packages(exclude=["*.tests", "*.tests.*",
                                    "tests.*", "tests"]),
    install_requires=install_requires,
    entry_points={
      'console_scripts': [
        "create-database=qurator.sbb_images.cli:create_database",
        "model-selection=qurator.sbb_images.cli:model_selection",
        "train-classifier=qurator.sbb_images.cli:train",
        "apply-classifier=qurator.sbb_images.cli:apply",
        "create-search-index=qurator.sbb_images.cli:create_search_index",
        "create-sbb-links=qurator.sbb_images.cli:create_sbb_link_table",
        "add-detections=qurator.sbb_images.cli:add_detections"
        ]
    },
    python_requires='>=3.6.0',
    tests_require=['pytest'],
    classifiers=[
          'Intended Audience :: Science/Research',
          'License :: OSI Approved :: Apache Software License',
          'Programming Language :: Python :: 3',
          'Topic :: Scientific/Engineering :: Artificial Intelligence',
    ],
)
