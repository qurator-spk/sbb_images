import sqlite3
import click
import re
import pandas as pd
from tqdm import tqdm
from datetime import datetime

from ..database import setup_tags_table

@click.command()
@click.argument('page-info-file', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.option('--path-prefix', type=str, default=None)
@click.option('--append', type=bool, is_flag=True, default=False)
def cli(page_info_file, sqlite_file, path_prefix, append):
    """
        Special functionality of the SBB (Staatsbibliothek zu Berlin):

        PAGE_INFO_FILE:
        SQLITE_FILE: sqlite3 database file that contains the images table.
    """

    timestamp = str(datetime.now())

    with sqlite3.connect(sqlite_file) as conn:

        setup_tags_table(conn)

        if not append:
            conn.execute('DELETE FROM tags WHERE user="page-info"')

        print("Reading page info ...")

        df_page_info = pd.read_pickle(page_info_file)

        print("done")

        file_info = \
            df_page_info.fileGrp_PRESENTATION_file_FLocat_href.str.\
                extract('.*/(PPN.*)').\
                rename(columns={0: 'path'})

        df_page_info = df_page_info.merge(file_info, left_index=True, right_index=True)

        if path_prefix is not None:
            prefix = path_prefix + '/'
        else:
            prefix = ''

        df_page_info['fullpath'] = prefix + df_page_info.path

        print("Reading image table from database ...")

        df_images = pd.read_sql('SELECT rowid,file FROM images', conn)

        df_images = df_images.merge(df_page_info, left_on='file', right_on='fullpath')

        print("done")

        if len(df_images) == 0:
            print("No matching images found. Did you use the correct path prefix?")
            return

        df_all_tags = []

        col_seq = tqdm(df_images.columns)

        for c in col_seq:

            m = re.match('structMap-LOGICAL_TYPE_(.*)', c)

            if not m:
                continue

            col_seq.set_description(c)

            tag = m[1]

            df_tags = \
                df_images.loc[df_images[c] == 1.0][['rowid']].\
                    rename(columns={'rowid': 'image_id'}).reset_index(drop=True)

            df_tags['tag'] = tag
            df_tags['user'] = 'page-info'
            df_tags['timestamp'] = timestamp
            df_tags['read_only'] = 1

            df_all_tags.append(df_tags)

        df_all_tags = pd.concat(df_all_tags)

        if len(df_all_tags) == 0:
            print("No tags added.")
            return

        df_all_tags.to_sql('tags', con=conn, if_exists='append', index=False)


if __name__ == '__main__':
    cli()
