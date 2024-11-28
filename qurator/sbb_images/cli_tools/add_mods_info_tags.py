import sqlite3
import click
import re
import pandas as pd
from tqdm import tqdm
from datetime import datetime
import ast

from ..database import setup_tags_table


@click.command()
@click.argument('mods-info-file', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.option('--append', type=bool, is_flag=True, default=False)
def cli(mods_info_file, sqlite_file, append):
    """
        Special functionality of the SBB (Staatsbibliothek zu Berlin):

        MODS_INFO_FILE:
        SQLITE_FILE: sqlite3 database file that contains the images table.
    """

    timestamp = str(datetime.now())

    with sqlite3.connect(sqlite_file) as conn:

        setup_tags_table(conn)

        if not append:
            conn.execute('DELETE FROM tags WHERE user="mods-info"')

        print("Reading image table ...")

        df_images = pd.read_sql('SELECT rowid,file FROM images', conn).\
            rename(columns={'rowid': 'image_id'})

        print("Number of images: {}".format(len(df_images)))

        ppn_info = \
            df_images.file.str.\
                extract('.*/(PPN.*?)/').\
                rename(columns={0: 'ppn'})

        df_images = \
            df_images.merge(ppn_info, left_index=True, right_index=True).\
            sort_values(by=['ppn'])

        print("Number of images with MODS-data: {}".format(len(df_images)))

        print("Reading MODS info ...")

        drop_columns={'identifier-purl'}

        if mods_info_file.endswith(".csv"):
            df_mods_info = pd.read_csv(mods_info_file, low_memory=False).\
                drop(columns=drop_columns).\
                rename(columns={'Unnamed: 0': 'ppn'}).\
                sort_values(by=['ppn']).\
                reset_index(drop=True)
        else:
            raise RuntimeError("{} file format not support.".format(mods_info_file))

        keep = [c for c in df_mods_info.columns
                if 'namePart' not in c
                and 'roleTerm' not in c
                and 'mets' not in c
                and 'digitization' not in c
                and c not in drop_columns]

        df_mods_info = df_mods_info[keep]

        print("done")

        def clean_str(s):
            s = re.sub(r"\s+-\s+", '-', s)
            s = re.sub(r"\s+", '_', s)
            s = re.sub(r"\s*,\s*", ',', s)
            return s

        df_all_tags = []

        col_seq = tqdm(df_mods_info.columns)

        for column in col_seq:

            col_seq.set_description(column)

            tmp_tags = df_mods_info.loc[~df_mods_info[column].isnull()][['ppn', column]]

            col_seq.set_description(column + "({})".format(len(tmp_tags)))

            tmp_tags[column] = tmp_tags[column].astype(str)

            df_tags = []
            for _, (ppn, value) in tmp_tags.iterrows():

                try:
                    if value.startswith("{'") and  value.endswith("'}"):
                         values = ast.literal_eval(value)

                         for val in values:
                             val = clean_str(val)

                             df_tags.append((ppn, val))
                    else:
                        value = clean_str(value)

                        df_tags.append((ppn, value))
                except:
                    import ipdb
                    ipdb.set_trace()

            df_tags = pd.DataFrame(df_tags, columns=['ppn', 'tag'])

            df_all_tags.append(df_tags)

        df_all_tags = pd.concat(df_all_tags)

        print("Merging ...")

        df_images = df_images.merge(df_all_tags, on='ppn')

        df_all_tags = df_images[['image_id', 'tag']]

        df_all_tags = df_all_tags.drop_duplicates().copy()

        df_all_tags['user'] = 'mods-info'
        df_all_tags['timestamp'] = timestamp
        df_all_tags['read_only'] = 1

        print("done.")

        if len(df_all_tags) == 0:
            print("No tags added.")
            return

        df_all_tags.to_sql('tags', con=conn, if_exists='append', index=False)


if __name__ == '__main__':
    cli()
