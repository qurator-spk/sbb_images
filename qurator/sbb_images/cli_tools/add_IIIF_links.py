import sqlite3
import click
import pandas as pd

from ..database import setup_iiif_links_table


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

    with sqlite3.connect(sqlite_file) as conn:

        setup_iiif_links_table(conn)

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

        iiif = df_images[['rowid', 'fileGrp_DEFAULT_file_FLocat_href']].\
            rename(columns={'rowid': 'image_id', 'fileGrp_DEFAULT_file_FLocat_href': 'url'}).\
            reset_index(drop=True)

        iiif.to_sql('iiif_links', con=conn, if_exists='append' if append else 'replace', index=False)

        setup_iiif_links_table(conn)


if __name__ == '__main__':
    cli()
