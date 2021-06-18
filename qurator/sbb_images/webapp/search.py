import os
# import signal
import flask
import io
import logging

from flask import send_from_directory, redirect, jsonify, request, send_file, flash
import sqlite3
import pandas as pd
import threading
import torch

import PIL
from PIL import Image, ImageDraw

from ..feature_extraction import load_extraction_model

# noinspection PyUnresolvedReferences
from annoy import AnnoyIndex

app = flask.Flask(__name__)

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

        self._model_extr = None
        self._extract_transform = None
        self._device = None

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

        model_extr, extract_transform, device = self.get_extraction_model()

        img = extract_transform(img)

        img = img.to(device)

        with torch.set_grad_enabled(False):
            fe = model_extr(img.unsqueeze(0)).to('cpu').numpy()

        self._index = AnnoyIndex(fe.shape[1], app.config['DIST_MEASURE'])

        self._index.load(app.config['INDEX_FILE'])

        return self._index

    def get_extraction_model(self):

        if self._model_extr is not None:

            return self._model_extr, self._extract_transform, self._device

        self._model_extr, self._extract_transform, self._device = load_extraction_model(app.config['MODEL_NAME'])

        return self._model_extr, self._extract_transform, self._device


thread_store = ThreadStore()


@app.route('/')
def entry():
    return redirect("search.html", code=302)


@app.route('/similar', methods=['GET', 'POST'])
@app.route('/similar/<start>/<count>', methods=['GET', 'POST'])
@app.route('/similar/<start>/<count>/<x>/<y>/<width>/<height>', methods=['GET', 'POST'])
@htpasswd.required
def get_similar(user, start=0, count=100, x=-1, y=-1, width=-1, height=-1):

    del user
    start, count, x, y, width, height = int(start), int(count), float(x), float(y), float(width), float(height)

    search_id = request.args.get('search_id', default=None, type=int)

    if request.method == 'GET' and search_id is not None:

        sample = pd.read_sql('select * from images where rowid=?', con=thread_store.get_db(), params=(search_id,))

        if sample is None or len(sample) == 0:
            return "NOT FOUND", 404

        filename = sample.file.iloc[0]

        if not os.path.exists(filename):
            return "NOT FOUND", 404

        img = Image.open(filename).convert('RGB')

        if x < 0 and y < 0 and width < 0 and height < 0:
            x, y, width, height = float(sample.x.iloc[0]), float(sample.y.iloc[0]), \
                                  float(sample.width.iloc[0]), float(sample.height.iloc[0])

            x, y, width, height = x / img.size[0], y / img.size[1], width / img.size[0], height / img.size[1]

    elif request.method == 'POST':
        # check if the post request has the file part
        if 'file' not in request.files:
            return "BAD PARAMS", 400

        file = request.files['file']

        img = Image.open(file).convert('RGB')
    else:
        return "BAD PARAMS", 400

    if x >= 0 and y >= 0 and width > 0 and height > 0:
        img = img.crop((img.size[0]*x, img.size[1]*y, img.size[0]*x + width*img.size[0],
                        img.size[1]*y + height*img.size[1]))

    model_extr, extract_transform, device = thread_store.get_extraction_model()

    img = extract_transform(img)

    img = img.to(device)

    with torch.set_grad_enabled(False):
        fe = model_extr(img.unsqueeze(0)).to('cpu').numpy()

    fe = fe.squeeze()

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


def has_links():
    return \
        thread_store.get_db().execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
                                      ('links',)).fetchone()\
        is not None


@app.route('/haslinks')
@htpasswd.required
def get_has_links(user):
    del user
    return jsonify(has_links())


@app.route('/link/<image_id>')
@htpasswd.required
def get_link(user, image_id=None):
    del user

    if not has_links():

        return jsonify("")

    link = pd.read_sql('select * from links where rowid=?', con=thread_store.get_db(), params=(image_id,))

    if link is None or len(link) == 0:
        return jsonify("")

    url = link.url.iloc[0]

    return jsonify(url)


@app.route('/image')
@app.route('/image/<image_id>')
@app.route('/image/<image_id>/<version>')
@app.route('/image/<image_id>/<version>/<marker>')
@htpasswd.required
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

        return "NOT FOUND", 404

    img = Image.open(filename)

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

    return send_file(buffer, mimetype='image/jpeg')


@app.route('/<path:path>')
@htpasswd.required
def send_js(user, path):

    del user

    return send_from_directory('static', path)
