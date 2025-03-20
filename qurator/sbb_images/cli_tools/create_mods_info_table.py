import sqlite3
import click
import pandas as pd

@click.command()
@click.argument('mods-info-file', type=click.Path(exists=True))
@click.argument('sqlite-file', type=click.Path(exists=True))
def cli(mods_info_file, sqlite_file):
    """
        Special functionality of the SBB (Staatsbibliothek zu Berlin):

        MODS_INFO_FILE:
        SQLITE_FILE: sqlite3 database file that contains the images table.
    """


    print("Reading MODS info ...")

    drop_columns={'identifier-purl', 'identifier-VD17'}

    if mods_info_file.endswith(".csv"):
        mods_info = pd.read_csv(mods_info_file, low_memory=False).drop(columns=drop_columns).\
            rename(columns={'Unnamed: 0': 'ppn'}).\
            sort_values(by=['ppn']).\
            reset_index(drop=True)

        # new_columns = {c: c.replace('-', '_') for c in mods_info.columns}
        # mods_info = mods_info.rename(columns=new_columns)
        # mods_info = mods_info.loc[:, ~mods_info.columns.duplicated()].copy()
    else:
        raise RuntimeError("{} file format not support.".format(mods_info_file))

    with sqlite3.connect(sqlite_file) as con:
        mods_info.to_sql('mods_info', con=con, if_exists='replace')

        con.execute('CREATE INDEX IF NOT EXISTS "ix_mods_info_ppn"ON "mods_info" ("ppn");')

