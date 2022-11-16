import os
import flask
from werkzeug.exceptions import *
import logging

from flask import send_from_directory, redirect, jsonify, request  # , send_file
import sqlite3
import pandas as pd
import threading
import random
import string
import json

app = flask.Flask(__name__)

app.config.from_json('config/region-annotator-config.json' if not os.environ.get('CONFIG') else os.environ.get('CONFIG'))

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

if len(app.config['PASSWD_FILE']) > 0:
    app.config['FLASK_HTPASSWD_PATH'] = app.config['PASSWD_FILE']
    app.config['FLASK_AUTH_REALM'] = app.config['AUTH_REALM']

    from flask_htpasswd import HtPasswdAuth

    app.config['FLASK_AUTH_REALM'] = app.config['AUTH_REALM']
    app.config['FLASK_SECRET'] = \
        ''.join(random.SystemRandom().choice(string.ascii_uppercase + string.digits) for _ in range(40))

else:
    print("AUTHENTICATION DISABLED!!!")
    from .no_auth import NoAuth as HtPasswdAuth

htpasswd = HtPasswdAuth(app)

connection_map = dict()


def get_db():

    def make_conn():
        thid = threading.current_thread().ident

        conn = connection_map.get(thid)

        if conn is None:
            logger.info('Create database connection: {}'.format(app.config['SQLITE_FILE']))

            conn = sqlite3.connect(app.config['SQLITE_FILE'])

            conn.execute('pragma journal_mode=wal')

            connection_map[thid] = conn

        return conn

    if not os.path.exists(app.config['SQLITE_FILE']):

        co = make_conn()

        co.execute('CREATE TABLE "targets" ("url" TEXT primary key, "user" TEXT)')

        co.execute('CREATE TABLE "annotations" '
                   '("anno_id" TEXT primary key, "url" TEXT, "user" TEXT, "anno_json" TEXT, "state" TEXT)')
        co.execute('CREATE INDEX "idx_annotations_by_url" ON annotations(url)')
        co.execute('CREATE INDEX "idx_annotations_by_url_and_state" ON annotations(url, state)')
        co.execute('CREATE INDEX "idx_annotations_by_url_and_user" ON annotations(url, user)')

        return co

    return make_conn()


@app.route('/')
def entry():
    return redirect("region-annotator.html", code=302)


@app.route('/authenticate')
@htpasswd.required
def authenticate(user):
    return jsonify({'user': user})


@app.route('/auth-test')
@htpasswd.required
def auth_test(user):
    return jsonify({'user': user})


@app.after_request
def after(response):
    if request.url.endswith('auth-test'):
        response.headers.remove('WWW-Authenticate')

    return response


@app.route('/isadmin')
@htpasswd.required
def isadmin(user):
    return jsonify({'isadmin': user in app.config['ADMIN_USERS']})


@app.route('/add-annotation', methods=['POST'])
@htpasswd.required
def add_annotation(user):

    annotation = request.json['annotation']

    anno_id = annotation['id']
    url = annotation['target']['source']

    anno_json = json.dumps(annotation)

    new_entry = pd.DataFrame(
        {'anno_id': anno_id, "url": url, 'user': user, "anno_json": anno_json, "state": "private"},
        index=[0])

    try:
        new_entry.to_sql('annotations', con=get_db(), if_exists='append', index=False)

    except sqlite3.IntegrityError as e:
        print(e)
        raise BadRequest()
    except sqlite3.OperationalError as e:
        print(e)
        raise InternalServerError()

    return "OK", 200


@app.route('/update-annotation', methods=['POST'])
@htpasswd.required
def update_annotation(user):

    annotation = request.json['annotation']
    anno_id = annotation['id']
    anno_json = json.dumps(annotation)

    get_db().execute('BEGIN EXCLUSIVE TRANSACTION')

    if user in app.config['ADMIN_USERS']:
        get_db().execute('UPDATE annotations SET anno_json = ? WHERE anno_id = ?', (anno_json, anno_id))
    else:
        get_db().execute('UPDATE annotations SET anno_json = ? WHERE anno_id = ? AND user = ?',
                         (anno_json, anno_id, user))

    get_db().execute('COMMIT TRANSACTION')

    return "OK", 200


@app.route('/delete-annotation', methods=['POST'])
@htpasswd.required
def delete_annotation(user):

    anno_id = request.json['anno_id']

    get_db().execute('BEGIN EXCLUSIVE TRANSACTION')

    if user in app.config['ADMIN_USERS']:
        get_db().execute('DELETE FROM annotations WHERE anno_id=?', (anno_id,))
    else:
        get_db().execute('DELETE FROM annotations WHERE anno_id=? AND user=user', (anno_id, user))

    get_db().execute('COMMIT TRANSACTION')

    return "OK", 200


@app.route('/get-annotations', methods=['POST'])
@htpasswd.required
def get_annotations(user):

    url = request.json['url']

    if user in app.config['ADMIN_USERS'] or app.config['COOPERATIVE_ACCESS']:
        df_anno = pd.read_sql("SELECT * FROM annotations WHERE url=?", con=get_db(), params=(url,))
    else:
        df_anno = pd.read_sql("SELECT * FROM annotations WHERE url=? AND user=?",
                              con=get_db(), params=(url, user))
    annotations = []

    for idx, (anno_id, url, owner, anno_json, state) in df_anno.iterrows():

        writeable = app.config['COOPERATIVE_MODIFICATION'] or (user == owner) or (user in app.config['ADMIN_USERS'])

        annotations.append({'url': url, 'user': owner, 'annotation': json.loads(anno_json), 'state': state,
                            'read_only': not writeable})

    return jsonify(annotations)

# @app.route('/find-url', methods=['POST'])
# @htpasswd.required
# def find_url(user):
#
#     url = request.json['url']
#
#     pd.read_sql()


@app.route('/add-url', methods=['POST'])
@htpasswd.required
def add_url(user):

    if user not in app.config['ADMIN_USERS']:
        raise Unauthorized()

    url = request.json['url']

    new_entry = pd.DataFrame({'url': url, 'user': user}, index=[0])

    try:
        new_entry.to_sql('targets', con=get_db(), if_exists='append', index=False)
    except sqlite3.IntegrityError as e:
        print(e)
        raise BadRequest()
    except sqlite3.OperationalError as e:
        print(e)
        raise InternalServerError()

    return "OK", 200


@app.route('/<path:path>')
# @htpasswd.required
def send_js(path):
    # del user

    return send_from_directory('static', path)
