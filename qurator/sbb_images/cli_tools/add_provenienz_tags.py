import sqlite3
import click
import re
import pandas as pd
from tqdm import tqdm
from datetime import datetime
import ast
from ast import literal_eval

from qurator.sbb_images.database import setup_tags_table

@click.command()
@click.argument('meta-fotothek-file', type=click.Path(exists=True))
@click.argument('meta-wiki-file', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.option('--append', type=bool, is_flag=True, default=False)
def cli(meta_fotothek_file, meta_wiki_file, sqlite_file, append):
    """
        Special functionality of the SBB (Staatsbibliothek zu Berlin):

        SQLITE_FILE: sqlite3 database file that contains the images table.

        META_FOTOTHEK_FILE:

        META_WIKI_FILE:
    """

    timestamp = str(datetime.now())

    with sqlite3.connect(sqlite_file) as conn:

        setup_tags_table(conn)

        if not append:
            conn.execute('DELETE FROM tags WHERE user="meta-provenienz"')

        print("Reading image table ...")

        df_images = pd.read_sql('SELECT rowid,file FROM images', conn).\
            rename(columns={'rowid': 'image_id'})

        print("Number of images: {}".format(len(df_images)))

        df_images['is_fotothek'] = ~df_images.file.str.extract('.*(Fotothek).*').isnull()
        df_images['is_wiki'] = ~df_images.file.str.extract('.*(Wiki).*').isnull()

        df_wiki = df_images[df_images.is_wiki].copy()
        df_fotothek = df_images[df_images.is_fotothek].copy()

        meta_foto = pd.read_csv(meta_fotothek_file).drop_duplicates(subset=['recordID'])
        meta_wiki = pd.read_csv(meta_wiki_file).drop_duplicates(subset=['pageid'])

        df_fotothek['recordID'] = df_fotothek.file.str.extract('.*/(.*).jpg')
        df_fotothek['recordID'] = df_fotothek.recordID.astype(str)
        meta_foto['recordID'] = meta_foto.recordID.astype(str)
        df_foto_meta = df_fotothek.merge(meta_foto, on='recordID').copy()
        df_foto_meta['categories'] = df_foto_meta.categories.map(lambda s: literal_eval(s))

        df_wiki['pageid'] = df_wiki.file.str.extract('.*/(.*).jpg')
        df_wiki['pageid'] = df_wiki.pageid.astype(int)
        meta_wiki['pageid'] = meta_wiki.pageid.astype(int)
        df_wiki_meta = df_wiki.merge(meta_wiki, on='pageid').copy()
        df_wiki_meta['categories'] = df_wiki_meta.categories.map(lambda s: literal_eval(s))

        def clean_str(s):
            s = re.sub(r'\s*-\s*', '-', s).strip()
            s = re.sub(r'"', ' ', s).strip()
            s = re.sub(r"'", ' ', s).strip()
            s = re.sub(r'[)(,.*&!"§$%/?:;]', ' ', s).strip()
            s = re.sub(r'(?m)\s+', ' ', s).strip()
            s = re.sub(r'\s+', '_', s)
            return s

        df_all_tags = []

        for _, (image_id, categories, title) in df_foto_meta[['image_id', 'categories', 'title']].iterrows():
            for cat in categories:
                df_all_tags.append((image_id, cat))

            df_all_tags.append((image_id, 'fotothek'))

            for tp in title.split('/'):
                df_all_tags.append((image_id, clean_str(tp)))

        for _, (image_id, categories, title) in df_wiki_meta[['image_id', 'categories', 'title_string']].iterrows():
            for cat in categories:
                df_all_tags.append((image_id, cat))

            df_all_tags.append((image_id, 'wiki'))

            df_all_tags.append((image_id, clean_str(title)))

        df_all_tags = pd.DataFrame(df_all_tags, columns=['image_id', 'tag'])
        df_all_tags = df_all_tags.drop_duplicates().copy()

        print(df_all_tags.tag.value_counts().head(30))

        df_all_tags['user'] = 'meta-provenienz'
        df_all_tags['timestamp'] = timestamp
        df_all_tags['read_only'] = 1

        if len(df_all_tags) == 0:
            print("No tags added.")
            return

        df_all_tags.to_sql('tags', con=conn, if_exists='append', index=False)

        links = []

        for _, (image_id, recordID) in df_foto_meta[['image_id', 'recordID']].iterrows():
            links.append((image_id, "https://www.deutschefotothek.de/documents/obj/" + recordID))

        for _, (image_id, description_url) in df_wiki_meta[['image_id', 'description-url']].iterrows():
            links.append((image_id, description_url))

        df_links = pd.DataFrame(links, columns=['index', 'url']).set_index('index').sort_index()

        df_links.to_sql('links', con=conn, if_exists='replace')

if __name__ == '__main__':
    cli()