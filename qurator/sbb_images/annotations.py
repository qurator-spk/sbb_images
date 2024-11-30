import sqlite3
import pandas as pd
import re
import io
import requests

from datetime import datetime

from PIL import Image
from requests.auth import HTTPBasicAuth


def parse_annotation(annotation):

    anno_id = annotation['id']

    if annotation['type'] != 'Annotation':
        return "", 0, 0, 0, 0, [], ""

    img_url = annotation['target']['source']

    region = annotation['target']['selector']['value']

    points = m[1] if (m := re.match(r'<svg><polygon points="(.*)"', region)) else None

    labels = []

    for entry in annotation['body']:

        if entry['type'] != 'TextualBody' or entry['purpose'] != 'tagging':
            continue

        labels.append({'tag': entry['value'],
                       'timestamp': entry['modified'] if 'modified' in entry else entry['created']})

    labels.append({'tag': 'is_annotation', 'timestamp': datetime.now()})

    if points is not None:

        points = [float(s) for s in re.findall('([0-9.]+)', points)]
        x_coors = points[0::2]
        y_coors = points[1::2]

        assert (len(x_coors) == len(y_coors))

        left, right = int(min(x_coors)), int(max(x_coors))
        top, bottom = int(min(y_coors)), int(max(y_coors))

        width = right - left
        height = bottom - top

    else:
        xywh = m[1] if (m := re.match(r'xywh=pixel:(.*)', region)) else None

        if xywh is None:
            print("Could not interpret {}.".format(region))

            return "", 0, 0, 0, 0, [], ""

        left, top, width, height = [int(float(s)) for s in re.findall('([0-9.]+)', xywh)]

    return img_url, left, top, width, height, labels, anno_id


def update_annotation_image_and_labels(anno_id, img_url, left, top, width, height, labels, image_con):

    anchor = "region-annotator:{}".format(anno_id)

    sbb_link, ppn, physid = None, None, None

    thumbnail_must_be_updated = True

    if m := re.match(".*(PPN[^-]+)-([0-9]+)/.*", img_url):
        ppn, physid = m[1], m[2][-4:]

        sbb_link = "https://digital.staatsbibliothek-berlin.de/werkansicht?" + \
                   "PPN={}&PHYSID=PHYS_{}".format(ppn, physid)

    check_img = image_con.execute("SELECT rowid FROM images WHERE file=? AND x=? AND y=? "
                                  "AND width=? AND height=? AND anchor=?",
                                  (img_url, left, top, width, height, anchor)).fetchone()
    if check_img is not None:
        print("Url {} with coordinates {},{},{},{} already contained in image database.".
              format(img_url, left, top, width, height))
        thumbnail_must_be_updated = False

    check_img = image_con.execute("SELECT rowid FROM images WHERE anchor=?", (anchor,)).fetchone()

    if check_img is not None:
        print("Updating Url {} with coordinates {},{},{},{}.".format(img_url, left, top, width, height))

        image_id = check_img[0]

        image_con.execute('BEGIN EXCLUSIVE TRANSACTION')

        image_con.execute('UPDATE images SET '
                          'file=?, num_annotations=?, x=?, y=?, width=?, height=?, anchor=? '
                          'WHERE rowid=?', (img_url, 0, left, top, width, height, anchor, image_id))

        image_con.execute('COMMIT TRANSACTION')
    else:

        print("Inserting Url {} with coordinates {},{},{},{}. Anchor: {}".
              format(img_url, left, top, width, height, anchor))

        image_con.execute('BEGIN EXCLUSIVE TRANSACTION')

        image_id = image_con.execute('SELECT max(rowid) FROM images').fetchone()[0] + 1

        image_con.execute('INSERT INTO images(rowid, file, num_annotations, x, y, width, height, anchor) '
                          'VALUES(?,?,?,?,?,?,?,?)', (image_id, img_url, 0, left, top, width, height, anchor))

        if sbb_link is not None:
            try:
                image_con.execute('INSERT INTO links(rowid, url, ppn, phys_id) VALUES(?,?,?,?)',
                                  (image_id, sbb_link, ppn, physid))
            except sqlite3.IntegrityError:
                print(image_id)

        image_con.execute('INSERT INTO iiif_links(image_id, url) VALUES(?,?)', (image_id, img_url))

        image_con.execute('COMMIT TRANSACTION')

    image_con.execute('BEGIN EXCLUSIVE TRANSACTION')

    image_con.execute("DELETE FROM tags WHERE image_id=?", (image_id,))

    df_meta = pd.read_sql(
        'SELECT * FROM tags WHERE image_id IN ('
        'SELECT rowid FROM images WHERE rowid IN ('
        'SELECT image_id FROM iiif_links WHERE url=?'
        ') limit 1'
        ') AND read_only=1', params=(img_url,), con=image_con)

    for idx, row in df_meta.iterrows():
        image_con.execute('INSERT INTO tags(image_id, tag, user, timestamp, read_only) VALUES(?,?,?,?,?)',
                          (image_id, row.tag, row.user, row.timestamp, row.read_only))

    for label in labels:
        image_con.execute('INSERT INTO tags(image_id, tag, user, timestamp, read_only) VALUES(?,?,?,?,?)',
                          (image_id, label['tag'], anchor, label['timestamp'], 1))

    image_con.execute('COMMIT TRANSACTION')

    return thumbnail_must_be_updated


def delete_annotation_image_and_labels(anno_id, image_con):

    anchor = "region-annotator:{}".format(anno_id)

    check_img = image_con.execute("SELECT rowid FROM images WHERE anchor=?", (anchor,)).fetchone()

    if check_img is not None:
        image_id = check_img[0]

        image_con.execute('BEGIN EXCLUSIVE TRANSACTION')

        image_con.execute("DELETE FROM images WHERE anchor=?", (anchor,)).fetchone()

        image_con.execute("DELETE FROM tags WHERE image_id=?", (image_id,))

        image_con.execute("DELETE FROM links WHERE rowid=?", (image_id,))

        image_con.execute('COMMIT TRANSACTION')


def update_url_thumbnail(anno_id, img_url, left, top, width, height, thumb_size, thumb_con, auth=None):
    anchor = "region-annotator:{}".format(anno_id)

    thumb_filename = "{}|{}".format(img_url, anchor)

    if auth is None:
        img_resp = requests.get(img_url, timeout=(30, 30))
    else:
        img_resp = requests.get(img_url, timeout=(30, 30), auth=auth)

    if img_resp.status_code == 200:
        img = Image.open(io.BytesIO(img_resp.content))

        img = img.crop((left, top, left + width + 1, top + height + 1))

        max_size = float(max(img.size[0], img.size[1]))

        scale_factor = 1.0 if max_size <= thumb_size else thumb_size / max_size

        hsize = int((float(img.size[0]) * scale_factor))
        vsize = int((float(img.size[1]) * scale_factor))

        img = img.resize((hsize, vsize), Image.Resampling.LANCZOS)
    else:
        print("Could not retrieve: {}.".format(img_url))
        return

    buffer = io.BytesIO()

    img.save(buffer, 'JPEG')

    buffer.seek(0)

    check_thumb_id = thumb_con.execute("SELECT id FROM thumbnails WHERE filename=? AND size=? AND scale_factor=?",
                                       (thumb_filename, thumb_size, 1.0)).fetchone()

    if check_thumb_id is not None:
        print("Updating ID:{} URL: {}.".format(check_thumb_id[0], thumb_filename))

        thumb_con.execute('BEGIN EXCLUSIVE TRANSACTION')

        thumb_con.execute('UPDATE thumbnails SET data=? WHERE rowid=?', (sqlite3.Binary(buffer.read()),
                                                                         check_thumb_id[0]))

        thumb_con.execute('COMMIT TRANSACTION')
    else:
        print("Inserting {}.".format(thumb_filename))

        thumb_con.execute('BEGIN EXCLUSIVE TRANSACTION')

        thumb_con.execute('INSERT INTO thumbnails VALUES(NULL,?,?,?,?)',
                          (thumb_filename, sqlite3.Binary(buffer.read()), thumb_size, scale_factor))

        thumb_con.execute('COMMIT TRANSACTION')


def delete_url_thumbnail(anno_id, img_url, thumb_con, thumb_size):
    anchor = "region-annotator:{}".format(anno_id)

    thumb_filename = "{}|{}".format(img_url, anchor)

    check_thumb_id = thumb_con.execute("SELECT id FROM thumbnails WHERE filename=? AND size=? AND scale_factor=?",
                                       (thumb_filename, thumb_size, 1.0)).fetchone()

    if check_thumb_id is not None:
        thumb_con.execute('BEGIN EXCLUSIVE TRANSACTION')

        thumb_con.execute('DELETE FROM thumbnails WHERE id=?', (check_thumb_id[0],))

        thumb_con.execute('COMMIT TRANSACTION')
