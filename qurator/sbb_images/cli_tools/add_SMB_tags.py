import sqlite3
import click
import re
import numpy as np
import pandas as pd
from tqdm import tqdm
from datetime import datetime

from qurator.sbb_images.database import setup_tags_table, setup_iiif_links_table
import requests


@click.command()
@click.argument('smb-csv-file', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=True))
@click.option('--path-prefix', type=str, default=None)
@click.option('--append', type=bool, is_flag=True, default=False)
def cli(smb_csv_file, sqlite_file, path_prefix, append):
    """
        SMB_CSV_FILE: CSV file that contains the SMB meta-data.
        SQLITE_FILE: sqlite3 database file that contains the images table.
    """

    timestamp = str(datetime.now())

    with sqlite3.connect(sqlite_file) as conn:

        setup_tags_table(conn)

        if not append:
            conn.execute('DELETE FROM tags WHERE user="SMB-Meta-Data"')

        print("Reading SMB info ...")

        df_smb = pd.read_csv(smb_csv_file, low_memory=False).\
            sort_values(["Digital.Asset.ID", "Objekt.Ident..Nr."]).\
            drop_duplicates(subset=["Digital.Asset.ID"], keep="first")

        print("done")

        df_smb['path'] = 'ID-' + df_smb['Digital.Asset.ID'].astype(str) + '.jpg'

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

        df_tags = []
        df_iconclass = []
        df_links = []

        author = "SMB-Meta-Data"

        def clean_str(s):

            if type(s) == str:
                s = re.sub(r'\s*-\s*', '-', s).strip()
                s = re.sub(r'"', ' ', s).strip()
                s = re.sub(r"'", ' ', s).strip()
                s = re.sub(r'[)(,.*&!"§$%/?:;]', ' ', s).strip()

                s = re.sub(r'(?m)\s+', ' ', s).strip()

                s = re.sub(r'\s+', '_', s)

                return s

            if np.isnan(s):
                return ""

        iiif_links = []
        for _, row in tqdm(df_images.iterrows(), total=len(df_images)):

            iiif_links.append((row.rowid,
                               "https://id.smb.museum/digital-asset/{}".format(row['Digital.Asset.ID'])))

            df_links.append((row.rowid, "https://id.smb.museum/object/" + str(row['Objekt.ID'])))

            if type(row['Objekt.Titel']) == str:

                titel = row['Objekt.Titel']
                titel = [ti.strip() for ti in re.split(r'[/;,()|]', titel)]

                for ti in titel:
                    df_tags.append((row.rowid, clean_str(ti), author, timestamp, 1))

            df_tags.append((row.rowid, clean_str(row.Sammlung), author, timestamp, 1))

            if type(row['Objekt.Bereich']) == str:
                ober = row['Objekt.Bereich']
                ober = [bt.strip() for bt in re.split(r'[;,]', ober)]

                for br in ober:
                    df_tags.append((row.rowid, clean_str(br), author, timestamp, 1))

            df_tags.append((row.rowid, clean_str(row['Institution.ISIL']), author, timestamp, 1))
            df_tags.append((row.rowid, clean_str(row['Urheber.in.Fotograf.in']), author, timestamp, 1))
            df_tags.append((row.rowid, clean_str(row['Bildrechte']), author, timestamp, 1))

            if type(row['Objekt.Beteiligte']) == str:
                btlgt = row['Objekt.Beteiligte']
                btlgt = [bt.strip() for bt in re.split(r'[;,]', btlgt)]

                for bt in btlgt:
                    df_tags.append((row.rowid, clean_str(bt), author, timestamp, 1))

            if type(row['Objekt.Datierung']) != float:
                datier = str(row['Objekt.Datierung'])
                datier = [dat.strip() for dat in re.split(r'[;,]', datier)]

                for dat in datier:
                     df_tags.append((row.rowid, clean_str(dat), author, timestamp, 1))

            if type(row['Objekt.Geogr..Bezüge']) == str:
                geogrbz = row['Objekt.Geogr..Bezüge']
                geogrbz = [geo.strip() for geo in re.split(r'[;,]', geogrbz)]

                for geo in geogrbz:
                    df_tags.append((row.rowid, clean_str(geo), author, timestamp, 1))

            if type(row['Objekt.Material...Technik']) == str:
                mattech = row['Objekt.Material...Technik']
                mattech = [mt.strip() for mt in re.split(r'[;,]', mattech)]

                for mt in mattech:
                    df_tags.append((row.rowid, clean_str(mt), author, timestamp, 1))

            if type(row['Objekt.Sachbegriff']) == str:

                sbgs = row['Objekt.Sachbegriff']
                sbgs = [sbg.strip() for sbg in re.split(r'[/;,()|]', sbgs)]

                for sbg in sbgs:
                    df_tags.append((row.rowid, clean_str(sbg), author, timestamp, 1))

            if type(row['Objekt.Schlagwort']) == str:

                schlwrt = row['Objekt.Schlagwort']
                schlwrt = [sw.strip() for sw in re.split(r'[/;,()|]', schlwrt)]

                for sw in schlwrt:
                    df_tags.append((row.rowid, clean_str(sw), author, timestamp, 1))

            if type(row['Objekt.Iconclass.Notation.alt']) == str:
                df_tags.append((row.rowid, "Mit_Iconclass", author, timestamp, 1))

                iconcls = row['Objekt.Iconclass.Notation.alt']
                iconcls = [ic.strip() for ic in re.split(r'[;]', iconcls)]

                for ic in iconcls:

                    ic = re.sub(r'\s+', '', ic)

                    df_iconclass.append((row.file, ic, ic, row.rowid, row.rowid))

            else:
                df_tags.append((row.rowid, "Ohne_Iconclass", author, timestamp, 1))

            if type(row['Objekt.Text.Online']) == str:
                df_tags.append((row.rowid, "Mit_OnlineText", author, timestamp, 1))
            else:
                df_tags.append((row.rowid, "Ohne_OnlineText", author, timestamp, 1))

        df_tags = pd.DataFrame(df_tags, columns=['image_id', 'tag', 'user', 'timestamp', 'read_only'])

        df_tags = df_tags.loc[df_tags.tag.str.len() > 0]

        if len(df_tags) == 0:
            print("No tags added.")
            return

        df_tags.to_sql('tags', con=conn, if_exists='append', index=False)

        df_links = pd.DataFrame(df_links, columns=["index", "url"]).set_index("index")

        df_iconclass = pd.DataFrame(df_iconclass, columns=["file", "target", "label", "imageid", "index"]).\
            set_index("index")

        df_iconclass.to_sql(name='iconclass', con=conn, if_exists='replace', index=True)

        df_links.to_sql('links', con=conn, if_exists='replace')

        iiif = pd.DataFrame(iiif_links, columns=['image_id', 'url'])

        iiif.to_sql('iiif_links', con=conn, if_exists='replace', index=False)

        setup_iiif_links_table(conn)


if __name__ == '__main__':
    cli()
