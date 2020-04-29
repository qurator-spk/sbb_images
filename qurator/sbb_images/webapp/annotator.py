import os
# import signal
import io
import flask
import logging
from flask_htpasswd import HtPasswdAuth
from flask import send_from_directory, redirect, jsonify, request, send_file
import sqlite3
import pandas as pd
import threading

import PIL
from PIL import Image


app = flask.Flask(__name__)

app.config.from_json('annotator-config.json' if not os.environ.get('CONFIG') else os.environ.get('CONFIG'))

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

app.config['FLASK_HTPASSWD_PATH'] = app.config['PASSWD_FILE']

htpasswd = HtPasswdAuth(app)

connection_map = dict()


def get_db():

    thid = threading.current_thread().ident

    conn = connection_map.get(thid)

    if conn is None:

        logger.info('Create database connection: {}'.format(app.config['SQLITE_FILE']))

        conn = sqlite3.connect(app.config['SQLITE_FILE'])

        conn.execute('pragma journal_mode=wal')

        connection_map[thid] = conn

    return conn


@app.route('/')
def entry():
    return redirect("annotator.html", code=302)


@app.route('/image')
@app.route('/image/<image_id>')
@htpasswd.required
def get_image(user, image_id=None):

    del user

    max_img_size = app.config['MAX_IMG_SIZE']

    filename = pd.read_sql('select file from images where rowid=?', con=get_db(), params=(image_id,)).file.iloc[0]

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


@app.route('/labels')
@htpasswd.required
def get_labels(user):

    del user

    return jsonify(app.config['LABELS'])


def has_predictions():
    return \
        get_db().execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?;", ('predictions',)).fetchone()\
        is not None


@app.route('/haspredictions')
@htpasswd.required
def get_has_predictions(user):
    del user
    return jsonify(has_predictions())


@app.route('/prediction/<image_id>')
@htpasswd.required
def get_prediction(user, image_id=None):
    del user

    if not has_predictions():

        return jsonify("")

    label = pd.read_sql('select * from predictions where rowid=?', con=get_db(), params=(image_id,)).label.iloc[0]

    return jsonify(label)


@app.route('/randomid')
@htpasswd.required
def get_random_id(user):

    selected_class = request.args.get('selected_class', default=None, type=str)

    del user

    num_anno = app.config['NUM_ANNOTATIONS']

    if not has_predictions() or selected_class is None or len(selected_class) == 0:

        num_incomplete = get_db().execute('select count(*) from images '
                                          'where num_annotations > 0 and num_annotations < ?', (num_anno,)).fetchone()[0]

        if num_incomplete >= app.config['WORKING_SET_SIZE']:
            result = get_db().execute(
                'select rowid from images where num_annotations > 0 and num_annotations < ? '
                'order by RANDOM() limit 1', (num_anno,)).\
                    fetchone()
        else:
            result = get_db().execute('select rowid from images '
                                      'where num_annotations < ? order by RANDOM() limit 1', (num_anno,)).\
                fetchone()
    else:
        num_incomplete = get_db().execute('select count(*) from images '
                                          'join predictions on predictions.rowid=images.rowid '
                                          'where images.num_annotations > 0 and images.num_annotations < ? '
                                          'and predictions.label=?',
                                          (num_anno, selected_class)).fetchone()[
            0]

        if num_incomplete >= app.config['WORKING_SET_SIZE']:
            result = get_db().execute(
                'select images.rowid from images '
                'join predictions on predictions.rowid=images.rowid '
                'where images.num_annotations > 0 and images.num_annotations < ? '
                'and predictions.label=? '
                'order by RANDOM() limit 1', (num_anno, selected_class)). \
                fetchone()
        else:
            result = get_db().execute('select images.rowid from images '
                                      'join predictions on predictions.rowid=images.rowid '
                                      'where images.num_annotations < ? '
                                      'and predictions.label=?'
                                      'order by RANDOM() limit 1', (num_anno, selected_class)). \
                fetchone()

    if result is not None:
        rowid = result[0]
    else:
        rowid = -1

    return jsonify(rowid)


@app.route('/annotate', methods=['GET', 'POST'])
@htpasswd.required
def add_annotation(user):

    rowid = request.json['rowid']
    label = request.json['label']

    get_db().execute('BEGIN EXCLUSIVE TRANSACTION')

    get_db().execute('UPDATE images SET num_annotations = num_annotations + 1 WHERE rowid = ?', (rowid,))

    get_db().execute('COMMIT TRANSACTION')

    new_entry = pd.DataFrame({'image': rowid, 'label': label, 'user': user}, index=[0])

    new_entry.to_sql('annotations', con=get_db(), if_exists='append', index=False)

    return "OK", 200


@app.route('/<path:path>')
@htpasswd.required
def send_js(user, path):

    del user

    return send_from_directory('static', path)
