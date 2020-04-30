import os
# import signal
# import io
import flask
import logging
from flask_htpasswd import HtPasswdAuth
from flask import send_from_directory, redirect, jsonify, request, send_file
import sqlite3
# import pandas as pd
import threading

# import PIL
# from PIL import Image


app = flask.Flask(__name__)

app.config.from_json('search-config.json' if not os.environ.get('CONFIG') else os.environ.get('CONFIG'))

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
    return redirect("search.html", code=302)
