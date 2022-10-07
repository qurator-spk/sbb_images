import os
# import signal
import flask
from werkzeug.exceptions import *
import io
import logging
import cv2

from flask import send_from_directory, redirect, jsonify, request, send_file  # , flash
import sqlite3
import pandas as pd
import threading
# import torch
import json
import base64
import numpy as np

import PIL
from PIL import Image, ImageDraw, ImageOps, ImageFilter

from ..feature_extraction import load_extraction_model
from ..saliency import load_saliency_model

# noinspection PyUnresolvedReferences
from annoy import AnnoyIndex

from flask_cachecontrol import (
    FlaskCacheControl,
    cache_for)

app = flask.Flask(__name__)
flask_cache_control = FlaskCacheControl()
flask_cache_control.init_app(app)

app.config.from_json('search-config.json' if not os.environ.get('CONFIG') else os.environ.get('CONFIG'))

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

if len(app.config['PASSWD_FILE']) > 0:
    app.config['FLASK_HTPASSWD_PATH'] = app.config['PASSWD_FILE']
    app.config['FLASK_AUTH_REALM'] = app.config['AUTH_REALM']
    from flask_htpasswd import HtPasswdAuth
else:
    print("AUTHENTICATION DISABLED!!!")
    from .no_auth import NoAuth as HtPasswdAuth

htpasswd = HtPasswdAuth(app)


class ThreadStore:

    def __init__(self):

        self._connection_map = dict()

        self._extract_features = None
        self._extract_transform = None

        self._predict_saliency = None

        self._index = None

    def get_db(self):

        thid = threading.current_thread().ident

        conn = self._connection_map.get(thid)

        if conn is None:

            logger.info('Create database connection: {}'.format(app.config['SQLITE_FILE']))

            conn = sqlite3.connect(app.config['SQLITE_FILE'])

            conn.execute('pragma journal_mode=wal')

            self._connection_map[thid] = conn

        return conn

    def get_search_index(self):

        if self._index is not None:
            return self._index

        mode = 'RGB'
        size = (100, 100)
        color = (128, 128, 128)

        img = Image.new(mode, size, color)

        extract_features, extract_transform = self.get_extraction_model()

        img = extract_transform(img).unsqueeze(0)

        fe = extract_features(img)

        self._index = AnnoyIndex(fe.shape[1], app.config['DIST_MEASURE'])

        self._index.load(app.config['INDEX_FILE'])

        return self._index

    def get_extraction_model(self):

        if self._extract_features is not None:

            return self._extract_features, self._extract_transform

        self._extract_features, self._extract_transform = load_extraction_model(app.config['MODEL_NAME'])

        return self._extract_features, self._extract_transform

    def get_saliency_model(self):

        if self._predict_saliency is not None:
            return self._predict_saliency

        self._predict_saliency = load_saliency_model(app.config['VIT_MODEL'], app.config['VST_MODEL'])

        return self._predict_saliency


thread_store = ThreadStore()


@app.route('/')
def entry():
    return redirect("search.html", code=302)


def load_image_from_database(search_id , x=-1, y=-1, width=-1, height=-1):
    x, y, width, height = float(x), float(y), float(width), float(height)

    sample = pd.read_sql('select * from images where rowid=?', con=thread_store.get_db(), params=(search_id,))

    if sample is None or len(sample) == 0:
        raise NotFound()

    filename = sample.file.iloc[0]

    detections = pd.read_sql('select x,y,width,height from images where file=?',
                             con=thread_store.get_db(), params=(filename,))

    if not os.path.exists(filename):

        parts = filename.split('.')

        filename = ".".join(parts[:-1]) + ".jpeg"

        if not os.path.exists(filename):
            raise NotFound()

    img = Image.open(filename).convert('RGB')

    if x < 0 and y < 0 and width < 0 and height < 0:
        x, y, width, height = float(sample.x.iloc[0]), float(sample.y.iloc[0]), \
                              float(sample.width.iloc[0]), float(sample.height.iloc[0])

        x, y, width, height = x / img.size[0], y / img.size[1], width / img.size[0], height / img.size[1]

    if len(detections) > 0:
        detections.x /= img.size[0]
        detections.y /= img.size[1]

        detections.width /= img.size[0]
        detections.height /= img.size[1]

        detections = detections.loc[(detections.x > 0) & (detections.y > 0) &
                                    (detections.width > 0) & (detections.height > 0)]

    return img, x, y, width, height, detections


@app.route('/saliency', methods=['GET', 'POST'])
@app.route('/saliency/<x>/<y>/<width>/<height>', methods=['GET', 'POST'])
def get_saliency(x=-1, y=-1, width=-1, height=-1):

    max_img_size = 4*app.config['MAX_IMG_SIZE']

    search_id = request.args.get('search_id', default=None, type=int)

    if request.method == 'GET' and search_id is not None:

        img, x, y, width, height, detections = load_image_from_database(search_id, x, y, width, height)

    elif request.method == 'POST':
        # check if the post request has the file part
        if 'file' not in request.files:
            raise BadRequest()

        file = request.files['file']

        img = Image.open(file).convert('RGB')

        detections = pd.DataFrame([])
    else:
        raise BadRequest()

    x, y, width, height = float(x), float(y), float(width), float(height)

    if x < 0 and y < 0 and width < 0 and height < 0:
        x, y, width, height = 0.0, 0.0, 1.0, 1.0

    max_size = float(max(img.size[0], img.size[1]))

    scale_factor = 1.0 if max_size <= max_img_size else max_img_size / max_size

    hsize = int((float(img.size[0]) * scale_factor))
    vsize = int((float(img.size[1]) * scale_factor))

    img = img.resize((hsize, vsize), PIL.Image.ANTIALIAS)

    full_img = ImageOps.autocontrast(img)
    full_img = full_img.filter(ImageFilter.UnsharpMask(radius=2))
    predict_saliency = thread_store.get_saliency_model()

    def process_region(rx, ry, rwidth, rheight):
        img = full_img

        if rx >= 0 and ry >= 0 and rwidth > 0 and rheight > 0:
            img = full_img.crop((full_img.size[0]*rx, full_img.size[1]*ry,
                                 full_img.size[0]*rx + rwidth*full_img.size[0],
                                 full_img.size[1]*ry + rheight*full_img.size[1]))

        saliency_img = predict_saliency(img).convert("L")

        local_mask = Image.fromarray(np.zeros((full_img.height, full_img.width))).convert("L")

        local_mask.paste(saliency_img, (int(full_img.size[0] * rx), int(full_img.size[1] * ry)))

        boolean_mask = local_mask.point(lambda p: 0 if p < 64 else 255)

        num_components, component_labels, c_stats, centroids = \
            cv2.connectedComponentsWithStats(np.asarray(boolean_mask))

        c_stats = pd.DataFrame(c_stats, columns=['x', 'y', 'width', 'height', 'area'])

        c_stats.x = (c_stats.x / full_img.width).round(2)
        c_stats.width = (c_stats.width / full_img.width).round(2)

        c_stats.y = (c_stats.y / full_img.height).round(2)
        c_stats.height = (c_stats.height / full_img.height).round(2)

        return c_stats[1:], local_mask

    _, mask = process_region(x, y, width, height)

    def find_all_regions(search_regions, regions=None):

        cc_stats = []

        if regions is not None:
            max_area = max([search_regions.area.max(), regions.area.max()])
        else:
            max_area = search_regions.area.max()

        for _, (rx, ry, rwidth, rheight, rarea) in search_regions.iterrows():

            if regions is not None and (rx, ry, rwidth, rheight) in regions:
                print("skip")
                continue

            if max_area > 0 and rarea / max_area < 10e-3:
                print("skip")
                continue

            print(rx, ry, rwidth, rheight)

            _cc_stats, _ = process_region(rx, ry, rwidth, rheight)

            cc_stats.append(_cc_stats)

        if len(cc_stats) == 0:
            regions = regions.reset_index()

            regions.x *= full_img.width
            regions.width *= full_img.width

            regions.y *= full_img.height
            regions.height *= full_img.height

            regions = regions.drop_duplicates(subset=['x', 'y', 'width'])
            regions = regions.drop_duplicates(subset=['x', 'y', 'height'])

            return regions

        if regions is not None:
            regions = pd.concat([regions, search_regions.set_index(['x', 'y', 'width', 'height'])])
        else:
            regions = search_regions.set_index(['x', 'y', 'width', 'height'])

        regions = regions[~regions.index.duplicated(keep='first')]

        search_regions = pd.concat(cc_stats).drop_duplicates(subset=['x', 'y', 'width', 'height'])

        search_regions = search_regions.loc[
            ~search_regions.set_index(['x', 'y', 'width', 'height']).index.isin(regions.index)]

        return find_all_regions(search_regions, regions,)

    search_regions = [(x, y, width, height, 0.0)]

    if width > 0.2 and height > 0.2:
        search_regions.append((min([1.0, x + 0.05]), min([1.0, y + 0.05]),
                               max([0.0, width - 0.1]), max([0.0, height - 0.1, 0.0]), 0.0))

    search_regions = pd.DataFrame(search_regions, columns=['x', 'y', 'width', 'height', 'area'])

    all_stats = find_all_regions(search_regions)

    mask = mask.point(lambda p: 25 if p < 64 else p)

    full_img = full_img.convert("RGBA")
    full_img.putalpha(mask)

    full_area = all_stats.area.max()

    draw = ImageDraw.Draw(full_img, 'RGBA')

    for i, (rx, ry, rwidth, rheight, rarea) in all_stats.iterrows():

        if rarea / full_area < 10e-3:
            continue

        print (rarea/full_area)

        draw.rectangle([(rx, ry), (rx+rwidth, ry+rheight)], outline=(255, 25, 0))

    for i, (dx, dy, dwidth, dheight) in detections.iterrows():

        draw.rectangle([(dx*full_img.width, dy*full_img.height),
                        ((dx+dwidth)*full_img.width, (dy+dheight)*full_img.height)],
                       outline=(0, 25, 255))


    buffer = io.BytesIO()
    full_img.save(buffer, "PNG")
    buffer.seek(0)

    img_base64 = base64.b64encode(buffer.read()).decode("utf-8")

    #  return send_file(buffer, mimetype='image/jpeg')

    return jsonify(
        {'image': 'data:image/png;base64,' + img_base64,
         'x': x, 'y': y, 'width': width, 'height': height})


@app.route('/similar', methods=['GET', 'POST'])
@app.route('/similar/<start>/<count>', methods=['GET', 'POST'])
@app.route('/similar/<start>/<count>/<x>/<y>/<width>/<height>', methods=['GET', 'POST'])
@htpasswd.required
@cache_for(minutes=10)
def get_similar(user, start=0, count=100, x=-1, y=-1, width=-1, height=-1):

    del user
    start, count, x, y, width, height = int(start), int(count), float(x), float(y), float(width), float(height)

    search_id = request.args.get('search_id', default=None, type=int)

    if request.method == 'GET' and search_id is not None:

        img, x, y, width, height = load_image_from_database(search_id, x, y, width, height)

    elif request.method == 'POST':
        # check if the post request has the file part
        #if 'file' not in request.files:
        #    raise BadRequest()

        #  file = request.files['file']

        # img_base64 = request.

        # import ipdb;ipdb.set_trace()

        img_base64 = request.json['image']
        img_bytes = io.BytesIO(base64.b64decode(img_base64[len('data:image/png;base64,'):]))

        img = Image.open(img_bytes) #  .convert('RGB')

        mask = img.getchannel('A')

        img_rgb = img.convert('RGB')
        img_empty = Image.new('RGB', size=(img.width, img.height))

        img = Image.composite(img_rgb, img_empty, mask=mask)

        # import ipdb;ipdb.set_trace()

        # img.save('test.jpeg', "JPEG")
    else:
        raise BadRequest()

    full_img = img

    if x >= 0 and y >= 0 and width > 0 and height > 0:
        img = full_img.crop((full_img.size[0]*x, full_img.size[1]*y,
                             full_img.size[0]*x + width*full_img.size[0],
                             full_img.size[1]*y + height*full_img.size[1]))

    extract_features, extract_transform = thread_store.get_extraction_model()

    img = extract_transform(img).unsqueeze(0)

    fe = extract_features(img)

    fe = fe.squeeze()

    #  import ipdb;ipdb.set_trace()
    result = []

    min_result_len = count

    index = thread_store.get_search_index()

    while len(result) < min_result_len:

        neighbours = index.get_nns_by_vector(fe, start + count)

        neighbour_ids = [n + 1 for n in neighbours[start:start + count]]  # sqlite rowids are 1-based

        imgs = pd.read_sql('SELECT * FROM images WHERE rowid IN({})'.format(",".join([str(i) for i in neighbour_ids])),
                           con=thread_store.get_db())

        imgs['index'] = imgs['index']+1
        imgs = imgs.reset_index(drop=True).set_index('index')

        rank = pd.DataFrame([(nid, rank) for rank, nid in enumerate(neighbour_ids)], columns=['rowid', 'rank']).\
            set_index('rowid')

        imgs = imgs.merge(rank, left_index=True, right_index=True)

        result =\
            pd.DataFrame(
                [(img_grp.iloc[img_grp['rank'].argmin()].name, img_grp.iloc[img_grp['rank'].argmin()]['rank'])
                 for _, img_grp in imgs.groupby('file')], columns=['rowid', 'rank']).\
            sort_values('rank', ascending=True)

        result = result.rowid.to_list()

        count += min_result_len

    if x < 0 and y < 0 and width < 0 and height < 0:
        x, y, width, height = 0.0, 0.0, 1.0, 1.0

    return jsonify({'ids': result, 'x': x, 'y': y, 'width': width, 'height': height})


@cache_for(minutes=10)
def has_links():
    return \
        thread_store.get_db().execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
                                      ('links',)).fetchone()\
        is not None


@app.route('/haslinks')
@htpasswd.required
@cache_for(minutes=10)
def get_has_links(user):
    del user
    return jsonify(has_links())


@app.route('/link/<image_id>')
@htpasswd.required
@cache_for(minutes=10)
def get_link(user, image_id=None):
    del user

    if not has_links():

        return jsonify("")

    link = pd.read_sql('select * from links where rowid=?', con=thread_store.get_db(), params=(image_id,))

    if link is None or len(link) == 0:
        return jsonify("")

    url = link.url.iloc[0]

    return jsonify(url)


@app.route('/ppn/<ppn>')
@htpasswd.required
@cache_for(minutes=10)
def get_ppn_images(user, ppn=None):
    del user

    if not has_links():

        return jsonify("")

    links = pd.read_sql('select links.rowid from links join predictions on predictions.rowid=links.rowid '
                        'where links.ppn=? and '
                        '(predictions.label="Abbildung" or predictions.label="Photo" or predictions.label="Karte")',
                        con=thread_store.get_db(), params=(ppn,))

    if links is None or len(links) == 0:
        return jsonify("")

    return jsonify({'ids': links.rowid.tolist()})


@app.route('/image-ppn/<rowid>')
@htpasswd.required
@cache_for(minutes=10)
def get_image_ppn(user, rowid=None):
    del user

    if not has_links():

        return jsonify("")

    link = pd.read_sql('select * from links where rowid=?', con=thread_store.get_db(), params=(rowid,))

    if link is None or len(link) == 0:
        return jsonify("")

    return jsonify(json.loads(link.iloc[0].to_json()))


@app.route('/image')
@app.route('/image/<image_id>')
@app.route('/image/<image_id>/<version>')
@app.route('/image/<image_id>/<version>/<marker>')
@htpasswd.required
@cache_for(hours=3600)
def get_image(user, image_id=None, version='resize', marker='regionmarker'):

    del user

    max_img_size = app.config['MAX_IMG_SIZE']

    sample = pd.read_sql('select * from images where rowid=?', con=thread_store.get_db(), params=(image_id,))

    filename = sample.file.iloc[0]
    x = sample.x.iloc[0]
    y = sample.y.iloc[0]
    width = sample.width.iloc[0]
    height = sample.height.iloc[0]

    if not os.path.exists(filename):

        parts = filename.split('.')

        filename = ".".join(parts[:-1]) + ".jpeg"

        if not os.path.exists(filename):

            return "NOT FOUND", 404

    img = Image.open(filename).convert('RGB')

    if version == 'resize':

        max_size = float(max(img.size[0], img.size[1]))

        scale_factor = 1.0 if max_size <= max_img_size else max_img_size / max_size

        hsize = int((float(img.size[0]) * scale_factor))
        vsize = int((float(img.size[1]) * scale_factor))

        img = img.resize((hsize, vsize), PIL.Image.ANTIALIAS)

        if x >= 0 and y >= 0 and width > 0 and height > 0:
            x = int((float(x) * scale_factor))
            y = int((float(y) * scale_factor))
            width = int((float(width) * scale_factor))
            height = int((float(height) * scale_factor))

    elif version == 'full':
        pass
    else:
        return "BAD PARAMS <version>: full/resize", 400

    if marker == 'nomarker':
        pass
    elif marker == 'regionmarker':

        if x >= 0 and y >= 0 and width > 0 and height > 0:

            draw = ImageDraw.Draw(img, 'RGBA')

            draw.rectangle([(x, y), (x + width, y + height)], outline=(255, 25, 0))
    else:
        return "BAD PARAMS <marker>: regionmarker/nomarker", 400

    buffer = io.BytesIO()
    img.save(buffer, "JPEG")
    buffer.seek(0)

    return send_file(buffer, mimetype='image/jpeg', last_modified=os.path.getmtime(filename))


@app.route('/<path:path>')
@htpasswd.required
def send_js(user, path):

    del user

    return send_from_directory('static', path)
