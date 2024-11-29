import os
import flask
from werkzeug.exceptions import *
import logging

from flask import send_from_directory, redirect, jsonify, request, send_file
import sqlite3
import pandas as pd
import threading
import random
import string
import json
import re
import io
import requests

from pathlib import Path
from urllib.parse import urlparse
from urlmatch import urlmatch
from urlmatch import BadMatchPattern

import dicttoxml
from xml.dom.minidom import parseString

from datetime import datetime, timedelta
from dateutil.parser import parse as parse_date

from ..database import setup_region_annotator_database
from ..annotations import update_annotation_image_and_labels, update_url_thumbnail, \
    delete_annotation_image_and_labels, delete_url_thumbnail, parse_annotation

from PIL import Image

dicttoxml.LOG.setLevel(logging.ERROR)

app = flask.Flask(__name__)

try:
    config_file = 'config/region-annotator-config.json' if not os.environ.get('CONFIG') else os.environ.get('CONFIG')

    app.config.from_file(os.path.join(os.getcwd(), config_file), load=json.load)

except FileNotFoundError as e:
    import pathlib
    print(e)
    print("Current path: {}".format(pathlib.Path(os.getcwd())))

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

htpasswd = None
if len(app.config['PASSWD_FILE']) > 0 and os.path.exists(os.path.join(os.getcwd(), app.config['PASSWD_FILE'])):
    app.config['FLASK_HTPASSWD_PATH'] = os.path.join(os.getcwd(), app.config['PASSWD_FILE'])
    app.config['FLASK_AUTH_REALM'] = app.config['AUTH_REALM']
    app.config['FLASK_SECRET'] = \
        ''.join(random.SystemRandom().choice(string.ascii_uppercase + string.digits) for _ in range(40))

    from.no_auth import AuthReloader

    htpasswd = AuthReloader(app, app.config['PASSWD_FILE'])
else:
    print("AUTHENTICATION DISABLED!!!")
    from .no_auth import NoAuth

    htpasswd = NoAuth()

url_auth = None

if "URL_USER" in app.config and "URL_PASSWD" in app.config:
    from requests.auth import HTTPBasicAuth

    url_auth = HTTPBasicAuth(app.config['URL_USER'], app.config['URL_PASSWD'])

if app.config['COOPERATIVE_MODIFICATION']:
    app.config['COOPERATIVE_ACCESS'] = True

connection_map = dict()

image_connection_map = dict()

thumb_connection_map = dict()

thumb_size = 250


def get_thumb_db():

    def make_conn():
        thid = threading.current_thread().ident

        conn = thumb_connection_map.get(thid)

        if conn is None:
            logger.info('Create database connection: {}'.format(app.config['THUMB_DB']))

            conn = sqlite3.connect(app.config['THUMB_DB'])

            conn.execute('pragma journal_mode=wal')

            thumb_connection_map[thid] = conn

        return conn

    if "THUMB_DB" not in app.config:
        return None

    if not os.path.exists(app.config['THUMB_DB']):

        return None

    return make_conn()


def get_image_db():

    def make_conn():
        thid = threading.current_thread().ident

        conn = image_connection_map.get(thid)

        if conn is None:
            logger.info('Create database connection: {}'.format(app.config['IMAGE_DB']))

            conn = sqlite3.connect(app.config['IMAGE_DB'])

            conn.execute('pragma journal_mode=wal')

            image_connection_map[thid] = conn

        return conn

    if "IMAGE_DB" not in app.config:
        return None

    if not os.path.exists(app.config['IMAGE_DB']):

        return None

    return make_conn()


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

        setup_region_annotator_database(co)

        return co

    return make_conn()


def writeable(user, owner):
    return app.config['COOPERATIVE_MODIFICATION'] or (user == owner) or (user in app.config['ADMIN_USERS'])


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


@app.route('/get-write-permit', methods=['POST'])
@htpasswd.required
def get_write_permit(user):

    anno_id = request.json['anno_id']
    last_read_time = parse_date(request.json['last_read_time'])

    get_db().execute('BEGIN EXCLUSIVE TRANSACTION')

    df_anno = pd.read_sql("SELECT user, write_permit, wp_valid_time, anno_json, last_write_time"
                          " FROM annotations WHERE anno_id=?", con=get_db(), params=(anno_id,))
    if len(df_anno) == 0:
        get_db().execute('COMMIT TRANSACTION')

        raise BadRequest()

    owner, write_permit, wp_valid_time, anno_json, last_write_time = \
        df_anno.iloc[0].user, df_anno.iloc[0].write_permit, parse_date(df_anno.iloc[0].wp_valid_time), \
        df_anno.iloc[0].anno_json, parse_date(df_anno.iloc[0].last_write_time)

    if len(anno_json) > 0 and last_write_time > last_read_time:
        get_db().execute('COMMIT TRANSACTION')
        raise Conflict()

    if not writeable(user, owner):
        get_db().execute('COMMIT TRANSACTION')
        raise Forbidden()

    if len(write_permit) > 0 and (wp_valid_time - datetime.now()).seconds < 60:
        get_db().execute('COMMIT TRANSACTION')
        raise Conflict()

    characters = string.ascii_letters + string.digits + string.punctuation

    write_permit = ''.join(random.choice(characters) for _ in range(20))

    get_db().execute('UPDATE annotations SET write_permit = ? '
                     'WHERE anno_id = ?', (write_permit, anno_id))

    get_db().execute('UPDATE annotations SET wp_valid_time = ? '
                     'WHERE anno_id = ?', ((datetime.now() + timedelta(seconds=60)), anno_id))

    get_db().execute('COMMIT TRANSACTION')

    permit = {'write_permit_id': anno_id, 'write_permit': write_permit}

    return jsonify(permit)


@app.route('/renew-write-permit', methods=['POST'])
@htpasswd.required
def renew_write_permit(user):

    del user

    write_permit = request.json['write_permit']

    get_db().execute('BEGIN EXCLUSIVE TRANSACTION')

    get_db().execute('UPDATE annotations SET wp_valid_time = ? '
                     'WHERE write_permit = ?', ((datetime.now() + timedelta(seconds=60)), write_permit))

    get_db().execute('COMMIT TRANSACTION')

    return "OK", 200


@app.route('/release-write-permit', methods=['POST'])
@htpasswd.required
def release_write_permit(user):

    del user

    write_permit = request.json['write_permit']

    get_db().execute('BEGIN EXCLUSIVE TRANSACTION')

    get_db().execute('UPDATE annotations SET wp_valid_time = ? '
                     'WHERE write_permit = ?', (datetime.now(), write_permit))

    get_db().execute('UPDATE annotations SET write_permit = ? '
                     'WHERE write_permit = ?', (write_permit, write_permit))

    get_db().execute('COMMIT TRANSACTION')

    return "OK", 200


@app.route('/add-annotation', methods=['POST'])
@htpasswd.required
def add_annotation(user):

    annotation = request.json['annotation']

    anno_id = annotation['id']
    url = annotation['target']['source']

    matches, description = _match_url(url)

    if not matches:
        raise BadRequest()

    anno_json = json.dumps(annotation)

    new_entry = pd.DataFrame(
        {'anno_id': anno_id, "url": url, 'user': user, "anno_json": anno_json, "state": "private",
         'last_write_time': str(datetime.now()), 'write_permit': "", "wp_valid_time": str(datetime.now())},
        index=[0])

    try:
        new_entry.to_sql('annotations', con=get_db(), if_exists='append', index=False)

    except sqlite3.IntegrityError as e:
        print(e)
        raise BadRequest()
    except sqlite3.OperationalError as e:
        print(e)
        raise InternalServerError()

    if (image_con := get_image_db()) is not None:

        img_url, left, top, width, height, labels, anno_id = parse_annotation(annotation)

        if len(anno_id) > 0:
            update_thumbnail = update_annotation_image_and_labels(anno_id, img_url,
                                                                  left, top, width, height, labels, image_con)

            if update_thumbnail and (thumb_con := get_thumb_db()) is not None:
                update_url_thumbnail(anno_id, img_url, left, top, width, height, thumb_size, thumb_con, url_auth)

    return "OK", 200


@app.route('/update-annotation', methods=['POST'])
@htpasswd.required
def update_annotation(user):

    del user

    annotation = request.json['annotation']
    write_permit = request.json['write_permit']
    anno_id = annotation['id']
    anno_json = json.dumps(annotation)

    get_db().execute('BEGIN EXCLUSIVE TRANSACTION')

    get_db().execute('UPDATE annotations SET anno_json = ? '
                     'WHERE anno_id = ? AND write_permit = ?', (anno_json, anno_id, write_permit))

    get_db().execute('UPDATE annotations SET last_write_time = ?'
                     'WHERE anno_id = ? AND write_permit = ?', (str(datetime.now()), anno_id, write_permit))

    get_db().execute('UPDATE annotations SET write_permit = "" '
                     'WHERE anno_id = ? AND write_permit = ?', (anno_id, write_permit))

    get_db().execute('COMMIT TRANSACTION')

    if (image_con := get_image_db()) is not None:

        print(anno_json)

        img_url, left, top, width, height, labels, anno_id = parse_annotation(annotation)

        if len(anno_id) > 0:
            update_thumbnail = update_annotation_image_and_labels(anno_id, img_url,
                                                                  left, top, width, height, labels, image_con)

            if update_thumbnail and (thumb_con := get_thumb_db()) is not None:
                update_url_thumbnail(anno_id, img_url, left, top, width, height, thumb_size, thumb_con, url_auth)

    return "OK", 200


@app.route('/delete-annotation', methods=['POST'])
@htpasswd.required
def delete_annotation(user):

    anno_id = request.json['anno_id']
    write_permit = request.json['write_permit']

    if (image_con := get_image_db()) is not None:

        if user in app.config['ADMIN_USERS'] or app.config['COOPERATIVE_ACCESS']:
            df_anno = pd.read_sql("SELECT anno_json "
                                  "FROM annotations WHERE anno_id=?", con=get_db(), params=(anno_id,))
        else:
            df_anno = pd.read_sql("SELECT anno_json "
                                  "FROM annotations WHERE anno_id=? AND user=?", con=get_db(), params=(anno_id, user))

        for _, row in df_anno.iterrows():
            img_url, left, top, width, height, labels, anno_id = parse_annotation(json.loads(row.anno_json))

            if len(anno_id) > 0:
                delete_annotation_image_and_labels(anno_id, image_con)

                if (thumb_con := get_thumb_db()) is not None:
                    delete_url_thumbnail(anno_id, img_url, thumb_con, thumb_size)

    get_db().execute('BEGIN EXCLUSIVE TRANSACTION')

    get_db().execute('UPDATE annotations SET anno_json = "" '
                     'WHERE anno_id = ? AND write_permit = ?', (anno_id, write_permit))

    get_db().execute('UPDATE annotations SET last_write_time = ?'
                     'WHERE anno_id = ? AND write_permit = ?', (str(datetime.now()), anno_id, write_permit))

    get_db().execute('UPDATE annotations SET write_permit = "" '
                     'WHERE anno_id = ? AND write_permit = ?', (anno_id, write_permit))

    get_db().execute('COMMIT TRANSACTION')

    return "OK", 200


@app.route('/has-annotations', methods=['POST'])
@htpasswd.required
def has_annotations(user):

    url = request.json['url']

    if user in app.config['ADMIN_USERS'] or app.config['COOPERATIVE_ACCESS']:
        count = pd.read_sql("SELECT COUNT(*) FROM annotations WHERE url=?", con=get_db(), params=(url,))
    else:
        count = pd.read_sql("SELECT COUNT(*) FROM annotations WHERE url=? AND user=?", con=get_db(), params=(url, user))

    count = count['COUNT(*)'][0] if count is not None and len(count) > 0 else 0

    return jsonify({"count": int(count)})


@app.route('/get-annotations', methods=['POST'])
@htpasswd.required
def get_annotations(user):

    url = request.json['url']
    last_read_time = parse_date(request.json['last_read_time']) if 'last_read_time' in request.json else None

    read_time = datetime.now()

    if user in app.config['ADMIN_USERS'] or app.config['COOPERATIVE_ACCESS']:
        df_anno = pd.read_sql("SELECT anno_id, url, user, anno_json, state, last_write_time "
                              "FROM annotations WHERE url=?", con=get_db(), params=(url,))
    else:
        df_anno = pd.read_sql("SELECT anno_id, url, user, anno_json, state, last_write_time "
                              "FROM annotations WHERE url=? AND user=?", con=get_db(), params=(url, user))

    annotations_update = dict()

    for idx, (anno_id, url, owner, anno_json, state, last_write_time) in df_anno.iterrows():

        last_write_time = parse_date(last_write_time)

        if len(anno_json) == 0 and last_write_time - read_time > timedelta(hours=1):
            get_db().execute('DELETE FROM annotations WHERE anno_id=?', (anno_id,))
            continue

        if last_read_time is not None and last_write_time <= last_read_time:
            continue

        anno_info = {'anno_id': anno_id, 'url': url, 'user': owner, 'state': state,
                     'read_only': not writeable(user, owner)}

        if len(anno_json) > 0:
            anno_info['annotation'] = json.loads(anno_json)

        annotations_update[anno_id] = anno_info

    return jsonify({'annotations': annotations_update, 'read_time': str(read_time)})


@app.route('/get-annotated-urls', methods=['POST'])
@htpasswd.required
def get_annotated_urls(user):

    if user in app.config['ADMIN_USERS'] or app.config['COOPERATIVE_ACCESS']:
        df_anno = pd.read_sql("SELECT anno_id, url, user, anno_json, state, last_write_time "
                              "FROM annotations", con=get_db())
    else:
        df_anno = pd.read_sql("SELECT anno_id, url, user, anno_json, state, last_write_time "
                              "FROM annotations WHERE user=?", con=get_db(), params=(user,))

    df_anno = df_anno.sort_values("url")

    df_anno = df_anno.loc[df_anno.anno_json.str.len() > 0]

    df_url_patterns = pd.read_sql("SELECT url_pattern, description FROM target_patterns", con=get_db())

    ret = []

    for url, part in df_anno.groupby("url"):

        matches, description = _match_url(url, url_patterns=df_url_patterns)

        if not matches:
            continue

        ret.append({"url": url, "description": description, "users": part.user.unique().tolist()})

    return jsonify(ret)


@app.route('/get-url-patterns', methods=['POST'])
@htpasswd.required
def get_url_patterns(user):

    df_target_patterns = pd.read_sql("SELECT url_pattern,description,user from target_patterns", con=get_db())

    df_target_patterns['is_generic'] = df_target_patterns.url_pattern.str.contains('\*')

    df_target_patterns = df_target_patterns.sort_values(['is_generic', 'url_pattern'], ascending=[False, True])

    df_target_patterns = df_target_patterns.drop(columns=['is_generic'])

    target_patterns = []

    for _, (url_pattern, description, user) in df_target_patterns.iterrows():
        target_patterns.append({'url_pattern': url_pattern, 'description': description, 'user': user})

    return jsonify(target_patterns)


@app.route('/add-url-pattern', methods=['POST'])
@htpasswd.required
def add_url_pattern(user):

    if user not in app.config['ADMIN_USERS']:
        raise Unauthorized()

    url = request.json['url_pattern']
    url = url.strip()
    description = request.json['description']

    new_entry = pd.DataFrame({'url_pattern': url, 'description': description, 'user': user}, index=[0])

    try:
        new_entry.to_sql('target_patterns', con=get_db(), if_exists='append', index=False)
    except sqlite3.IntegrityError as e:
        print(e)
        raise BadRequest()
    except sqlite3.OperationalError as e:
        print(e)
        raise InternalServerError()

    return "OK", 200


@app.route('/change-url-pattern', methods=['POST'])
@htpasswd.required
def change_url_pattern(user):

    if user not in app.config['ADMIN_USERS']:
        raise Unauthorized()

    url_pattern = request.json['url_pattern']
    description = request.json['description']

    get_db().execute('BEGIN EXCLUSIVE TRANSACTION')

    try:
        get_db().execute('UPDATE target_patterns SET description = ? '
                         'WHERE url_pattern = ? ', (description, url_pattern))

        get_db().execute('UPDATE target_patterns SET url_pattern = ? '
                         'WHERE url_pattern = ? ', (url_pattern, url_pattern))

        get_db().execute('COMMIT TRANSACTION')

    except sqlite3.IntegrityError as e:
        get_db().execute('COMMIT TRANSACTION')
        print(e)
        raise BadRequest()
    except sqlite3.OperationalError as e:
        get_db().execute('COMMIT TRANSACTION')
        print(e)
        raise InternalServerError()

    return "OK", 200


@app.route('/delete-url-pattern', methods=['POST'])
@htpasswd.required
def delete_url_pattern(user):

    if user not in app.config['ADMIN_USERS']:
        raise Unauthorized()

    url_pattern = request.json['url_pattern']

    get_db().execute('BEGIN EXCLUSIVE TRANSACTION')

    get_db().execute('DELETE FROM target_patterns WHERE url_pattern=?', (url_pattern,))

    get_db().execute('COMMIT TRANSACTION')

    return "OK", 200


@app.route('/has-url-pattern', methods=['POST'])
@htpasswd.required
def has_url_pattern(user):

    url_pattern = request.json['url_pattern']

    if len(pd.read_sql("SELECT * FROM target_patterns WHERE url_pattern=?;", con=get_db(), params=(url_pattern,))) > 0:
        return "OK", 200

    raise BadRequest()


def _match_url(url, url_patterns=None):

    if url_patterns is None:
        df_url_patterns = pd.read_sql("SELECT url_pattern, description FROM target_patterns", con=get_db())
    else:
        df_url_patterns = url_patterns

    for _, (url_pattern, description) in df_url_patterns.iterrows():
        if urlmatch(url_pattern, url):
            return True, description

    return False, ""


@app.route('/match-url', methods=['POST'])
@htpasswd.required
def match_url(user):

    url = request.json['url']

    matches, description = _match_url(url)

    if matches:
        return "OK", 200

    raise BadRequest()


@app.route('/suggestions', methods=['POST'])
@htpasswd.required
def suggestions(user):

    search_pattern = request.json['url']

    parsed_uri = urlparse(search_pattern)

    raw_pattern = search_pattern

    if len(parsed_uri.netloc) == 0 and len(parsed_uri.scheme) == 0:
        search_pattern = "http://*/" + search_pattern

    df_url_patterns = pd.read_sql("SELECT url_pattern, description FROM target_patterns", con=get_db())

    df_urls = pd.read_sql("SELECT url FROM annotations", con=get_db()). \
        drop_duplicates(subset=['url'], keep='first')

    df_urls_filtered = []
    for _, (url,) in df_urls.iterrows():
        match, description = _match_url(url, url_patterns=df_url_patterns)

        if match:
            df_urls_filtered.append((url, description))

    df_urls_filtered = pd.DataFrame(df_urls_filtered, columns=['url_pattern', 'description'])

    df_url_patterns = pd.concat([df_url_patterns, df_urls_filtered]).\
        drop_duplicates(subset=['url_pattern'], keep='first')

    df_url_patterns['is_generic'] = df_url_patterns.url_pattern.str.contains('\*')

    df_url_patterns = df_url_patterns.sort_values(['is_generic', 'url_pattern'], ascending=[False, True])

    df_url_patterns = df_url_patterns.drop(columns=['is_generic'])

    found = []
    for _, (url_pattern, description) in df_url_patterns.iterrows():
        try:
            if urlmatch(url_pattern, search_pattern, path_required=False, fuzzy_scheme=True):
                found.append({'url_pattern': url_pattern, 'description': description})
                continue
        except BadMatchPattern:
            pass
        try:
            if urlmatch(search_pattern, url_pattern, path_required=False, fuzzy_scheme=True):
                found.append({'url_pattern': url_pattern, 'description': description})
                continue
        except BadMatchPattern:
            pass

        if raw_pattern in description:
            found.append({'url_pattern': url_pattern, 'description': description})

    return jsonify(found)


@app.route('/data-export', methods=['POST'])
@htpasswd.required
def data_export(user):

    if user not in app.config['ADMIN_USERS']:
        raise Unauthorized()

    if "export_type" not in request.json:
        raise BadRequest()

    export_type = request.json['export_type']

    if "selection" not in request.json:
        raise BadRequest()

    selection = request.json["selection"]

    if export_type != "sqlite" and len(selection) == 0:
        raise BadRequest()

    get_db().execute("VACUUM")

    filename = Path(app.config['SQLITE_FILE']).stem + '-' + str(datetime.now())

    filename = re.sub(r'\s+|:', '-', filename)

    if export_type == "json":
        df_anno = pd.read_sql("SELECT * FROM annotations", con=get_db())

        df_anno = df_anno.loc[df_anno.anno_json.str.len() > 0]

        df_anno = df_anno.loc[df_anno.url.isin(selection)]

        df_export = []
        for url, part in df_anno.groupby("url"):
            df_export.append(part.loc[part.user.isin(selection[url])])
        df_export = pd.concat(df_export)

        data = [json.loads(df_export.iloc[i].anno_json) for i in range(len(df_export))]

        return jsonify({'data': data, 'mimetype': 'application/json', 'filename': filename + '.json'})

    elif export_type == "xml":

        # app.logger.error("os.environ['http_proxy'] :" + os.environ['http_proxy'])
        # app.logger.error("os.environ['no_proxy'] :" + os.environ['no_proxy'])

        df_anno = pd.read_sql("SELECT * FROM annotations", con=get_db())

        df_anno = df_anno.loc[df_anno.anno_json.str.len() > 0]

        df_anno = df_anno.loc[df_anno.url.isin(selection)]

        df_export = []
        for url, part in df_anno.groupby("url"):
            df_export.append(part.loc[part.user.isin(selection[url])])
        df_export = pd.concat(df_export)

        data = [json.loads(df_export.iloc[i].anno_json) for i in range(len(df_export))]

        images = dict()

        for data_item in data:
            img_url = data_item['target']['source']

            data_item['target']['width'], data_item['target']['height'] = 100, 100

            # app.logger.error("Downloading {}".format(img_url))

            try:
                if img_url not in images:
                    img_resp = requests.get(img_url, timeout=(3, 3))

                    if img_resp.status_code == 200:

                        images[img_url] = Image.open(io.BytesIO(img_resp.content))

                img = images[img_url]

                data_item['target']['width'],  data_item['target']['height'] = img.size
            except Exception as ex:
                app.logger.error(str(ex))

        xml = dicttoxml.dicttoxml(data, return_bytes=False)

        dom = parseString(xml)
        xml = dom.toprettyxml()

        buffer = io.BytesIO()
        buffer.write(bytes(xml, 'utf8'))
        buffer.seek(0)

        response = send_file(buffer, download_name=filename + '.xml', mimetype='application/octet-stream',
                             as_attachment=True)

        return response

    elif export_type == "sqlite":

        buffer = io.BytesIO()

        for line in get_db().iterdump():
            buffer.write(bytes('%s\n' % line, 'utf8'))

        buffer.seek(0)

        response = send_file(buffer, download_name=filename + '.sql', mimetype='application/octet-stream',
                             as_attachment=True)
        return response

    raise BadRequest()


@app.route('/<path:path>')
# @htpasswd.required
def send_js(path):
    # del user

    return send_from_directory('static', path)





