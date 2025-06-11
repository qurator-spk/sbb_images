import htpasswd
import click
import pandas as pd
import string
import random
import re
import os
import sqlite3
import json

from huggingface_hub import delete_webhook
from tqdm import tqdm

def fix_umlauts(s):
    return s.replace("ä", "ae").replace("ü", "ue").replace("ö", "oe").replace("ß", "sz")


def rnd_passwd(len):

    return ''.join(random.choice(string.ascii_lowercase) for _ in range(len))


@click.command()
@click.argument('passwd-file', type=click.Path())
@click.argument('user-input-file', type=click.Path(exists=True))
@click.argument('user-output-file', type=click.Path(exists=False))
@click.option('--password_len', type=int, default=8)
def create_accounts(passwd_file, user_input_file, user_output_file, password_len):

    df_users = pd.read_csv(user_input_file)

    df_users = df_users[['last_name', 'first_name']]

    df_output = []
    with htpasswd.Basic(passwd_file, mode="md5") as passwd_file:
        for idx, (last_name, first_name) in df_users.iterrows():

            fname_prefix_len = 1
            while True:
                try:
                    fn = re.sub(r"\s+", "_", fix_umlauts(first_name.lower().strip()))
                    ln = re.sub(r"\s+", "_", fix_umlauts(last_name.lower().strip()))

                    username = ''.join([fn[0:0+fname_prefix_len], ln])
                    password = ''.join(random.choice(string.ascii_lowercase) for _ in range(password_len))

                    passwd_file.add(username, password)

                    break
                except htpasswd.basic.UserExists:
                    fname_prefix_len += 1

            df_output.append((first_name.strip(), last_name.strip(), username, password))

    df_output = pd.DataFrame(df_output, columns=['first_name', 'last_name', 'username', 'password'])

    df_output.to_csv(user_output_file)

@click.command()
@click.argument('region-annotator-db', type=click.Path(True))
@click.argument('image-db', type=click.Path(exists=True))
@click.argument('thumb-db', type=click.Path(exists=True))
@click.argument('config_file', type=click.Path(exists=True))
@click.option('--dry-run', type=bool, is_flag=True)
@click.option('--url-user', type=string, default=None)
@click.option('--url-passwd', type=string, default=None)
def update_images_and_thumbs_from_region_annotator(region_annotator_db, image_db, thumb_db, config_file,
                                                   url_user, url_passwd, dry_run):

    os.environ["CONFIG"] = config_file

    from .region_annotator import (app, get_image_db, get_thumb_db, parse_annotation, thumb_size,
                                   update_annotation_image_and_labels, update_url_thumbnail,
                                   delete_annotation_image_and_labels, delete_url_thumbnail)

    app.config["IMAGE_DB"] = image_db
    app.config["THUMB_DB"] = thumb_db

    if (image_con := get_image_db()) is None:
        print("Set IMAGE_DB entry in {} first!".format(config_file))
        return

    if (thumb_con := get_thumb_db()) is None:
        print("Set THUMB_DB entry in {} first!".format(config_file))
        return

    url_auth=None
    if url_passwd is not None and url_user is not None:
        from requests.auth import HTTPBasicAuth

        url_auth = HTTPBasicAuth(app.config['URL_USER'], app.config['URL_PASSWD'])

    with sqlite3.connect(region_annotator_db) as con:
        df_annotations = pd.read_sql("SELECT * from annotations", con)
        # df_annotations = df_annotations.loc[df_annotations.anno_json.str.len()>0]

    with sqlite3.connect(image_db) as con:
        df_links = pd.read_sql("SELECT image_id, url from iiif_links", con)

        df_images = pd.read_sql("SELECT rowid, file from images "
                                "WHERE x=-1 AND y=-1 AND width=-1 AND height=-1", con)

    df_links = df_images.merge(df_links, left_on="rowid", right_on="image_id")

    df_la = df_annotations.merge(df_links, left_on="url", right_on="url", how="inner")

    for _, row in tqdm(df_la.iterrows(), total=len(df_la)):

        if len(row.anno_json)==0:
            if dry_run:
                continue

            delete_annotation_image_and_labels(row.anno_id, image_con)
            delete_url_thumbnail(row.anno_id, "*", thumb_con, thumb_size)
        else:
            annotation = json.loads(row.anno_json)

            img_url, left, top, width, height, labels, anno_id = parse_annotation(annotation)

            if dry_run:
                continue

            thumbnail_must_be_updated =\
                update_annotation_image_and_labels(anno_id, img_url, left, top, width, height, labels, image_con)

            if thumbnail_must_be_updated:
                update_url_thumbnail(anno_id, img_url, left, top, width, height, thumb_size, thumb_con, url_auth,
                                     timeout=(300,300))