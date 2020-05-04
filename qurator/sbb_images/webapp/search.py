import os
# import signal
import flask
import io
import logging
from flask_htpasswd import HtPasswdAuth
from flask import send_from_directory, redirect, jsonify, request, send_file, flash
import sqlite3
import pandas as pd
import threading
import torch

import PIL
from PIL import Image

from ..feature_extraction import load_extraction_model

# noinspection PyUnresolvedReferences
from annoy import AnnoyIndex

app = flask.Flask(__name__)

app.config.from_json('search-config.json' if not os.environ.get('CONFIG') else os.environ.get('CONFIG'))

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

app.config['FLASK_HTPASSWD_PATH'] = app.config['PASSWD_FILE']

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

    def get_search_index(self, fe):

        if self._index is not None:
            return self._index

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
@htpasswd.required
def get_similar(user):

    del user

    neighbours = []

    if request.method == 'POST':
        # check if the post request has the file part
        if 'file' not in request.files:
            flash('No file part')
            return redirect(request.url)

        file = request.files['file']

        img = Image.open(file).convert('RGB')

        model_extr, extract_transform, device = thread_store.get_extraction_model()

        img = extract_transform(img)

        img = img.to(device)

        with torch.set_grad_enabled(False):
            fe = model_extr(img.unsqueeze(0)).to('cpu').numpy()

        index = thread_store.get_search_index(fe)

        neighbours = index.get_nns_by_vector(fe.squeeze(), 20)

        neighbours = [n + 1 for n in neighbours]  # sqlite rowids are 1-based

    return jsonify(neighbours)


@app.route('/image')
@app.route('/image/<image_id>')
@htpasswd.required
def get_image(user, image_id=None):

    del user

    max_img_size = app.config['MAX_IMG_SIZE']

    filename = pd.read_sql('select file from images where rowid=?', con=thread_store.get_db(),
                           params=(image_id,)).file.iloc[0]

    if not os.path.exists(filename):

        return "NOT FOUND", 404

    img = Image.open(filename)
    max_size = float(max(img.size[0], img.size[1]))

    scale_factor = 1.0 if max_size <= max_img_size else max_img_size / max_size

    hsize = int((float(img.size[0]) * scale_factor))
    vsize = int((float(img.size[1]) * scale_factor))

    img = img.resize((hsize, vsize), PIL.Image.ANTIALIAS)

    buffer = io.BytesIO()
    img.save(buffer, "JPEG")
    buffer.seek(0)

    return send_file(buffer, mimetype='image/jpeg')


@app.route('/<path:path>')
@htpasswd.required
def send_js(user, path):

    del user

    return send_from_directory('static', path)
