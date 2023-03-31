import os
import pandas as pd
import click
from .data_access import IconClassRandomSampler

import json
import sqlite3


@click.command()
@click.argument('data-json', type=click.Path(exists=True))
@click.argument('sqlite_file', type=click.Path(exists=False))
def add_iconclass_table(data_json, sqlite_file):

    with open(data_json) as f:
        df = json.load(f)

    df = pd.DataFrame.from_dict(df, orient='index').replace('', None).dropna(how='all')

    samples = IconClassRandomSampler.parse(df)

    samples['file'] = os.path.dirname(data_json) + "/" + samples['file']

    with sqlite3.connect(sqlite_file) as conn:

        images = pd.read_sql("SELECT file, rowid FROM images", con=conn)

        samples = samples.merge(images, on="file", how="inner").\
            rename(columns={"rowid": "imageid"})

        samples.to_sql(name='iconclass', con=conn, if_exists='replace', index=True)
