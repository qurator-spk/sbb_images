import sqlite3
import click
import re
import numpy as np
import pandas as pd
from tqdm import tqdm
from datetime import datetime


@click.command()
@click.argument('smb-csv-file', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.option('--path-prefix', type=str, default=None)
@click.option('--append', type=bool, is_flag=True, default=False)
def cli(smb_csv_file, sqlite_file, path_prefix, append):
    """
        PAGE_INFO_FILE:
        SQLITE_FILE: sqlite3 database file that contains the images table.
    """

    timestamp = str(datetime.now())

    with sqlite3.connect(sqlite_file) as conn:

        try:
            conn.execute('create table tags (id integer primary key, image_id integer, '
                         'tag text not null, user text not null, timestamp text not null, read_only integer)')
        except sqlite3.Error:
            pass

        try:
            conn.execute('create index idx_tags_imageid on tags(image_id)')
        except sqlite3.Error:
            pass

        try:
            conn.execute('create index idx_tags_tag on tags(tag)')
        except sqlite3.Error:
            pass

        if not append:
            conn.execute('delete from tags where user="page-info"')

        print("Reading SMB info ...")

        df_smb = pd.read_csv(smb_csv_file)

        print("done")

        df_smb['path'] = 'ID-' + df_smb['Objekt.ID'].astype(str) + '.jpg'

        if path_prefix is not None:
            prefix = path_prefix + '/'
        else:
            prefix = ''

        df_smb['fullpath'] = prefix + df_smb.path

        print("Reading image table from database ...")

        df_images = pd.read_sql('select rowid,file from images', conn)

        print("done.")

        print("Merging SMB meta-data ...")

        df_images = df_images.merge(df_smb, left_on='file', right_on='fullpath')

        print("done.")

        if len(df_images) == 0:
            print("No matching images found. Did you use the correct path prefix?")
            return

        df_all_tags = []

        author = "SMB-Meta-Data"

        def clean_str(s):
            if np.isnan(s):
                return ""

            return s.strip()

        for _, row in tqdm(df_images.iterrows(), total=len(df_images)):

            df_all_tags.append((row.rowid, clean_str(row.Sammlung), author, timestamp, 1))
            df_all_tags.append((row.rowid, clean_str(row['Objekt.Bereich']), author, timestamp, 1))
            df_all_tags.append((row.rowid, clean_str(row['Institution.ISIL']), author, timestamp, 1))
            df_all_tags.append((row.rowid, clean_str(row['Urheber.in.Fotograf.in']), author, timestamp, 1))
            df_all_tags.append((row.rowid, clean_str(row['Bildrechte']), author, timestamp, 1))
            df_all_tags.append((row.rowid, clean_str(row['Objekt.Beteiligte']), author, timestamp, 1))
            df_all_tags.append((row.rowid, clean_str(row['Objekt.Datierung']), author, timestamp, 1))
            df_all_tags.append((row.rowid, clean_str(row['Objekt.Geogr..Bezüge']), author, timestamp, 1))

            sbg = clean_str(row['Objekt.Sachbegriff'])
            sbgs = re.sub(r'[,()-]', ' ', sbg).strip().split(" ")

            for sbg in sbgs:
                df_all_tags.append((row.rowid, sbg, author, timestamp, 1))

        df_all_tags = pd.DataFrame(df_all_tags, columns=['image_id', 'tag', 'user', 'timestamp', 'read_only'])

        df_all_tags = df_all_tags.loc[df_all_tags.tag.len > 0]

        if len(df_all_tags) == 0:
            print("No tags added.")
            return

        df_all_tags.to_sql('tags', con=conn, if_exists='append', index=False)


if __name__ == '__main__':
    cli()
