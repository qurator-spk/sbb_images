import sqlite3
import click
import re
import pandas as pd
from tqdm import tqdm


@click.command()
@click.argument('sqlite-file', type=click.Path(exists=True))
def cli(sqlite_file):
    """
    Special functionality of the SBB (Staatsbibliothek zu Berlin):
    Creates a link table that links each image in the database to the corresponding webpage within the
    "digitalisierte Sammlungen".

    SQLITE_FILE: sqlite3 database file that contains the images table.
    """

    with sqlite3.connect(sqlite_file) as con:
        images = pd.read_sql('select * from images', con=con)

    links = []
    for rowid, img in tqdm(images.iterrows(), total=len(images)):

        m = re.match(r'.*/(PPN.+)/([0-9]+).*', img.file)

        if m is None:
            print(img.file)
            continue

        ppn = m.group(1)
        phys_id = m.group(2)[-4:]

        links.append(("https://digital.staatsbibliothek-berlin.de/werkansicht?" +
                      "PPN={}&PHYSID=PHYS_{}".format(ppn, phys_id), ppn, phys_id, rowid))

    links = pd.DataFrame(links, columns=['url', 'ppn', 'phys_id', 'index']).set_index('index')

    with sqlite3.connect(sqlite_file) as con:
        links.to_sql('links', con=con, if_exists='replace')

        try:
            con.execute("create index ix_links_ppn on links(ppn)")
        except sqlite3.Error as e:
            print(e)


if __name__ == '__main__':
    cli()
