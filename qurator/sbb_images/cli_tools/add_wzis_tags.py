import sqlite3
import click
import re
import pandas as pd
from tqdm import tqdm
from datetime import datetime

from qurator.sbb_images.database import setup_tags_table, setup_links_table, setup_iiif_links_table


@click.command()
@click.argument('wzis-csv-file', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.option('--path-prefix', type=str, default=None)
@click.option('--append', type=bool, is_flag=True, default=False)
def cli(wzis_csv_file, sqlite_file, path_prefix, append):
    """
        PAGE_INFO_FILE:
        SQLITE_FILE: sqlite3 database file that contains the images table.
    """

    timestamp = str(datetime.now())

    with sqlite3.connect(sqlite_file) as conn:

        setup_tags_table(conn)

        if not append:
            conn.execute('DELETE FROM tags WHERE user="WZIS-Meta-Data"')

        print("Reading WZIS info ...")

        df_wzis = pd.read_csv(wzis_csv_file, sep=";")

        print("done")

        df_wzis['path'] = \
            df_wzis.Path.str.extract(".*?([0-9]+).*?").rename(columns={0: 'Path'}).Path + \
            '/' + df_wzis.IDwmarks.astype(str) + '.png'

        if path_prefix is not None:
            prefix = path_prefix + '/'
        else:
            prefix = ''

        df_wzis['fullpath'] = prefix + df_wzis.path

        print("Reading image table from database ...")

        df_images = pd.read_sql('select rowid,file from images', conn)

        print("done.")

        print("Merging WZIS meta-data ...")

        df_images = df_images.merge(df_wzis, left_on='file', right_on='fullpath')

        print("done.")

        if len(df_images) == 0:
            print("No matching images found. Did you use the correct path prefix?")
            return

        df_all_tags = []

        author = "WZIS-Meta-Data"

        links = []
        iiif_links = []
        for _, row in tqdm(df_images.iterrows(), total=len(df_images)):

            links.append(("https://www.wasserzeichen-online.de/wzis/struktur.php?ref={}".
                          format(row.Refnumber), "", "", row.rowid))

            iiif_links.append((row.rowid,
                               "http://wasserzeichen.lx0246.sbb.spk-berlin.de/image/WZIS/{}/full".format(row.rowid)))

            df_all_tags.append((row.rowid, row.Refnumber, author, timestamp, 1))
            df_all_tags.append((row.rowid, "IDMo_" + str(row.IDmotif), author, timestamp, 1))
            df_all_tags.append((row.rowid, row.Method_de, author, timestamp, 1))

            tags = [re.sub(r'\s+', '_', re.sub(r'[,()-]', ' ', s).strip())
                    for s in row.Motiflong_de.split('/')]

            for tag in tags:
                df_all_tags.append((row.rowid, tag, author, timestamp, 1))

        df_all_tags = pd.DataFrame(df_all_tags, columns=['image_id', 'tag', 'user', 'timestamp', 'read_only'])

        if len(df_all_tags) == 0:
            print("No tags added.")
            return

        df_all_tags.to_sql('tags', con=conn, if_exists='append', index=False)

        links = pd.DataFrame(links, columns=['url', 'ppn', 'phys_id', 'index']).set_index('index')

        iiif = pd.DataFrame(iiif_links, columns=['image_id', 'url'])

        links.to_sql('links', con=conn, if_exists='replace')

        setup_links_table(conn)

        iiif.to_sql('iiif_links', con=conn, if_exists='replace', index=False)

        setup_iiif_links_table(conn)


if __name__ == '__main__':
    cli()
