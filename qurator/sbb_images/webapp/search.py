import os
# import signal
import flask
from PIL.Image import Image
from werkzeug.exceptions import *
import io
import logging
# import cv2

from flask import send_from_directory, redirect, jsonify, request, send_file  # , flash
import sqlite3
import pandas as pd
import threading
# import torch
import json
import base64
import numpy as np

import PIL
from PIL import Image, ImageDraw, ImageStat  # ImageOps, ImageFilter

from ..feature_extraction import load_extraction_model
from ..saliency import load_saliency_model, process_region, find_all_regions
from ..iconclass.data_access import IconClassDataset

# noinspection PyUnresolvedReferences
from annoy import AnnoyIndex

from flask_cachecontrol import (cache_for)

from fnmatch import fnmatch

# from torchvision import transforms

app = flask.Flask(__name__)

try:
    config_file = 'search-config.json' if not os.environ.get('CONFIG') else os.environ.get('CONFIG')

    app.config.from_file(os.path.join(os.getcwd(), config_file), load=json.load)

except FileNotFoundError as e:
    import pathlib
    print(e)
    print("Current path: {}".format(pathlib.Path(os.getcwd())))


if "ICONCLASS_DB_LOCATION" in app.config:
    os.environ["ICONCLASS_DB_LOCATION"] = app.config["ICONCLASS_DB_LOCATION"]


logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

print(app.config['PASSWD_FILE'])

if len(app.config['PASSWD_FILE']) > 0 and os.path.exists(os.path.join(os.getcwd(), app.config['PASSWD_FILE'])):
    app.config['FLASK_HTPASSWD_PATH'] = os.path.join(os.getcwd(), app.config['PASSWD_FILE'])
    app.config['FLASK_AUTH_REALM'] = app.config['AUTH_REALM']
    from flask_htpasswd import HtPasswdAuth
else:
    print("AUTHENTICATION DISABLED!!!")
    from .no_auth import NoAuth as HtPasswdAuth

htpasswd = HtPasswdAuth(app)

import iconclass


class ThreadStore:

    def __init__(self):

        self._connection_map = dict()
        self._model_map = dict()
        self._index_map = dict()

        self._predict_saliency = None
        self._predict_transform = None

        self._index = None

    def get_db(self, data_conf):

        thid = threading.current_thread().ident

        conn = self._connection_map.get((data_conf, thid))

        if conn is None:

            logger.info('Create database connection: {}'.format(app.config['SQLITE_FILES'][data_conf]))

            conn = sqlite3.connect(app.config['SQLITE_FILES'][data_conf])

            conn.execute('pragma journal_mode=wal')

            self._connection_map[(data_conf, thid)] = conn

        return conn

    def get_thumb_db(self):

        thid = threading.current_thread().ident

        conn = self._connection_map.get(("__THUMBNAILS__", thid))

        if conn is None and "THUMBNAILS" in app.config:

            logger.info('Create database connection: {}'.format(app.config['THUMBNAILS']))

            conn = sqlite3.connect(app.config['THUMBNAILS'])

            conn.execute('pragma journal_mode=wal')

            self._connection_map[("__THUMBNAILS__", thid)] = conn

        return conn

    def get_search_index(self, index_conf, model_conf):

        print("Search index: ", index_conf)

        if index_conf in self._index_map:
            return self._index_map[index_conf]

        if index_conf not in app.config["INDEX_CONFIGURATION"]:
            raise RuntimeError("Unknown index")

        iconfig = app.config["INDEX_CONFIGURATION"][index_conf]
        extract_features, extract_transform = self.get_extraction_model(model_conf)

        mode = 'RGB'
        size = (100, 100)
        color = (128, 128, 128)

        # noinspection PyTypeChecker
        img = Image.new(mode, size, color)

        img = extract_transform(img).unsqueeze(0)

        fe = extract_features(img)

        index = AnnoyIndex(fe.shape[1], iconfig['DIST_MEASURE'])

        index.load(iconfig['INDEX_FILE'])

        self._index_map[index_conf] = index

        return self._index_map[index_conf]

    def get_extraction_model(self, model_conf):

        if model_conf in self._model_map:

            return self._model_map[model_conf]

        if model_conf not in app.config["MODEL_CONFIGURATION"]:
            raise RuntimeError("Unknown model")

        mconfig = app.config["MODEL_CONFIGURATION"][model_conf]

        model_name = None
        tokenizer = None
        if "MODEL_NAME" in mconfig:
            model_name = mconfig["MODEL_NAME"]

        clip_model = None
        if "CLIP_MODEL" in mconfig:
            clip_model = mconfig["CLIP_MODEL"]

        ms_clip_model_yaml = None
        if "MS_CLIP_MODEL_CONFIG" in mconfig:
            ms_clip_config = app.config['MS_CLIP_MODEL_CONFIG'][mconfig["MS_CLIP_MODEL_CONFIG"]]
            ms_clip_model_yaml = ms_clip_config["YAML"]
            tokenizer = ms_clip_config["TOKENIZER"]

        extract_features, extract_transform, _ = load_extraction_model(model_name=model_name, clip_model=clip_model,
                                                                       ms_clip_model=ms_clip_model_yaml,
                                                                       tokenizer=tokenizer)

        self._model_map[model_conf] = (extract_features, extract_transform)

        return self._model_map[model_conf]

    def get_saliency_model(self):

        if self._predict_saliency is not None:
            return self._predict_saliency, self._predict_transform

        if "VIT_MODEL" not in app.config or "VST_MODEL" not in app.config or \
                len(app.config['VIT_MODEL']) == 0 or (app.config['VST_MODEL'] == 0):
            return None, None

        self._predict_saliency, self._predict_transform = \
            load_saliency_model(app.config['VIT_MODEL'], app.config['VST_MODEL'])

        return self._predict_saliency, self._predict_transform


thread_store = ThreadStore()


def get_similar_from_features(conf, count, data_conf, fe, model_conf, start):
    result = []

    min_result_len = count

    index = thread_store.get_search_index(conf, model_conf)
    while len(result) < min_result_len:
        neighbours = index.get_nns_by_vector(fe, start + count)

        assert (len(neighbours) == len(set(neighbours)))

        neighbour_ids = [n + 1 for n in neighbours[start:start + count]]  # sqlite rowids are 1-based

        imgs = pd.read_sql('SELECT * FROM images WHERE rowid IN({})'.format(",".join([str(i) for i in neighbour_ids])),
                           con=thread_store.get_db(data_conf))

        imgs['index'] = imgs['index'] + 1
        imgs = imgs.reset_index(drop=True).set_index('index')

        rank = pd.DataFrame([(nid, rank) for rank, nid in enumerate(neighbour_ids)], columns=['rowid', 'rank']). \
            set_index('rowid')

        imgs = imgs.merge(rank, left_index=True, right_index=True)

        result = \
            pd.DataFrame(
                [(img_grp.iloc[img_grp['rank'].argmin()].name, img_grp.iloc[img_grp['rank'].argmin()]['rank'])
                 for _, img_grp in imgs.groupby('file')], columns=['rowid', 'rank']). \
                sort_values('rank', ascending=True)

        result = result.rowid.to_list()

        count += min_result_len

    return result


def load_image_from_database(data_conf, search_id, x=-1, y=-1, width=-1, height=-1):
    x, y, width, height = float(x), float(y), float(width), float(height)

    sample = pd.read_sql('select * from images where rowid=?', con=thread_store.get_db(data_conf), params=(search_id,))

    if sample is None or len(sample) == 0:
        raise NotFound()

    filename = sample.file.iloc[0]

    detections = pd.read_sql('select x,y,width,height from images where file=?',
                             con=thread_store.get_db(data_conf), params=(filename,))

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


@app.route('/')
def entry():
    return redirect("search.html", code=302)


@app.route('/saliency/<conf>', methods=['GET', 'POST'])
@app.route('/saliency/<conf>/<x>/<y>/<width>/<height>', methods=['GET', 'POST'])
def get_saliency(conf, x=-1, y=-1, width=-1, height=-1):
    data_conf = app.config["CONFIGURATION"][conf]["DATA_CONF"]

    # max_img_size = 4*app.config['MAX_IMG_SIZE']

    search_id = request.args.get('search_id', default=None, type=int)
    search_id_from = request.args.get('search_id_from', default=data_conf)

    if request.method == 'GET' and search_id is not None:

        img, x, y, width, height, detections = load_image_from_database(search_id_from, search_id, x, y, width, height)

    elif request.method == 'POST':
        # check if the post request has the file part
        if 'file' not in request.files:
            raise BadRequest()

        file = request.files['file']

        # noinspection PyTypeChecker
        img = Image.open(file).convert('RGB')

        detections = pd.DataFrame([])
    else:
        raise BadRequest()

    x, y, width, height = float(x), float(y), float(width), float(height)

    if x < 0 and y < 0 and width < 0 and height < 0:
        x, y, width, height = 0.0, 0.0, 1.0, 1.0

    # max_size = float(max(img.size[0], img.size[1]))
    #
    # scale_factor = 1.0 if max_size <= max_img_size else max_img_size / max_size
    #
    # hsize = int((float(img.size[0]) * scale_factor))
    # vsize = int((float(img.size[1]) * scale_factor))
    #
    # img = img.resize((hsize, vsize), PIL.Image.ANTIALIAS)

    # full_img = ImageOps.autocontrast(img)
    # full_img = full_img.filter(ImageFilter.UnsharpMask(radius=2))

    full_img = img

    predict_saliency, predict_transform = thread_store.get_saliency_model()

    if predict_saliency is not None and predict_transform is not None:

        _, mask = process_region(predict_saliency, predict_transform, full_img, x, y, width, height)

        if "SALIENCY_DEBUG" not in app.config or app.config["SALIENCY_DEBUG"] < 1:

            full_img = full_img.convert("RGBA")
            full_img.putalpha(mask)

        else:
            search_regions = [(x, y, width, height, 0.0)]

            if width > 0.2 and height > 0.2:

                for offset in [0.01, 0.05, 0.1]:

                    search_regions.append(
                        (min([1.0, x + offset]), min([1.0, y + offset]),
                         max([0.0, width - 2*offset]), max([0.0, height - 2*offset]), 0.0))

            search_regions = pd.DataFrame(search_regions, columns=['x', 'y', 'width', 'height', 'area'])

            all_stats = find_all_regions(predict_saliency, predict_transform, full_img, search_regions)

            # mask = mask.point(lambda p: 25 if p < 64 else p)

            full_img = full_img.convert("RGBA")
            full_img.putalpha(mask)

            full_area = all_stats.area.max()

            draw = ImageDraw.Draw(full_img, 'RGBA')

            for i, (rx, ry, rwidth, rheight, rarea) in all_stats.iterrows():

                if rarea / full_area < 10e-3:
                    continue

                print(rarea/full_area)

                # noinspection PyTypeChecker
                draw.rectangle([(rx, ry), (rx+rwidth, ry+rheight)], outline=(255, 25, 0))

            for i, (dx, dy, dwidth, dheight) in detections.iterrows():

                # noinspection PyTypeChecker
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


@app.route('/similar-by-tag/<conf>', methods=['POST'])
@app.route('/similar-by-tag/<conf>/<start>/<count>', methods=['POST'])
@htpasswd.required
@cache_for(minutes=10)
def get_similar_by_tag(user, conf, start=0, count=100):

    del user
    start, count = int(start), int(count)

    data_conf = app.config["CONFIGURATION"][conf]["DATA_CONF"]

    if "tag" not in request.json:
        raise BadRequest("tag missing.")

    search_tag = request.json['tag']
    ids = []
    highlight_labels = []
    text = ""

    if has_table("iconclass", data_conf):

        highlight_labels = [search_tag]

        text = IconClassDataset.get_text(search_tag)

        if text is not None:

            df_iconclass = pd.read_sql('SELECT imageid, label FROM iconclass WHERE label LIKE ?', con=thread_store.get_db(data_conf),
                                       params=(search_tag+"%",))

            df_iconclass = df_iconclass.drop_duplicates(subset=['imageid'])

            label_parts = iconclass.get_parts(search_tag)

            if len(label_parts) > 0:
                highlight_labels = label_parts

            ids += df_iconclass['imageid'].tolist()[start:start + count]

    if has_table("tags", data_conf):
        df_tags = pd.read_sql('SELECT image_id, tag FROM tags WHERE tag LIKE ?',
                                   con=thread_store.get_db(data_conf),
                                   params=(search_tag + "%",))

        df_tags = df_tags.drop_duplicates(subset=['image_id'])

        ids += df_tags['image_id'].tolist()[start:start + count]

    ret = {'ids': ids, 'info': text}

    if len(highlight_labels) > 0:
        ret['highlight_labels'] = highlight_labels

    return jsonify(ret)


@app.route('/similar-by-filename/<conf>', methods=['POST'])
@app.route('/similar-by-filename/<conf>/<start>/<count>', methods=['POST'])
@htpasswd.required
@cache_for(minutes=10)
def get_similar_by_filename(user, conf, start=0, count=100):

    del user
    start, count = int(start), int(count)

    data_conf = app.config["CONFIGURATION"][conf]["DATA_CONF"]

    if "pattern" not in request.json:
        raise BadRequest("pattern missing.")

    search_pattern = request.json['pattern']
    print(search_pattern)

    df_files = pd.read_sql('SELECT rowid, file from images', con=thread_store.get_db(data_conf))

    found = []
    for _, (rowid, file) in df_files.iterrows():
        if fnmatch(file, search_pattern):
            found.append(rowid)

        if len(found) >= start + count:
            break;

    return jsonify({'ids': found[start:start+count]})


@app.route('/similar-by-iconclass/<conf>', methods=['POST'])
@app.route('/similar-by-iconclass/<conf>/<start>/<count>', methods=['POST'])
@htpasswd.required
@cache_for(minutes=10)
def get_similar_by_iconclass(user, conf, start=0, count=100):

    del user
    start, count = int(start), int(count)

    data_conf = app.config["CONFIGURATION"][conf]["DATA_CONF"]
    model_conf = app.config["CONFIGURATION"][conf]["MODEL_CONF"]

    if "iconclass_label" not in request.json:
        raise BadRequest("iconclass_label missing.")

    iconclass_label = request.json['iconclass_label']

    text = IconClassDataset.get_text(iconclass_label)

    if text is None:
        raise BadRequest(description="Invalid iconclass label.")

    label_parts = iconclass.get_parts(iconclass_label)

    extract_features, extract_transform = thread_store.get_extraction_model(model_conf)

    fe = extract_features(text)

    fe = fe.squeeze()

    result = get_similar_from_features(conf, count, data_conf, fe, model_conf, start)

    return jsonify({'ids': result, 'info': text, 'highlight_labels': label_parts})


@app.route('/similar-by-text/<conf>', methods=['POST'])
@app.route('/similar-by-text/<conf>/<start>/<count>', methods=['POST'])
@htpasswd.required
@cache_for(minutes=10)
def get_similar_by_text(user, conf, start=0, count=100):
    data_conf = app.config["CONFIGURATION"][conf]["DATA_CONF"]
    model_conf = app.config["CONFIGURATION"][conf]["MODEL_CONF"]

    print(request.json)

    if "text" not in request.json:
        raise BadRequest()

    text = request.json['text']

    del user
    start, count = int(start), int(count)

    extract_features, extract_transform = thread_store.get_extraction_model(model_conf)

    fe = extract_features(text)

    fe = fe.squeeze()

    result = get_similar_from_features(conf, count, data_conf, fe, model_conf, start)

    return jsonify({'ids': result, 'info': '"{}"'.format(text)})


@app.route('/similar-by-image/<conf>', methods=['GET', 'POST'])
@app.route('/similar-by-image/<conf>/<start>/<count>', methods=['GET', 'POST'])
@app.route('/similar-by-image/<conf>/<start>/<count>/<x>/<y>/<width>/<height>', methods=['GET', 'POST'])
@htpasswd.required
@cache_for(minutes=10)
def get_similar_by_image(user, conf, start=0, count=100, x=-1, y=-1, width=-1, height=-1):

    data_conf = app.config["CONFIGURATION"][conf]["DATA_CONF"]
    model_conf = app.config["CONFIGURATION"][conf]["MODEL_CONF"]

    del user
    start, count, x, y, width, height = int(start), int(count), float(x), float(y), float(width), float(height)

    search_id = request.args.get('search_id', default=None, type=int)
    search_id_from = request.args.get('search_id_from', default=data_conf)

    # import ipdb;ipdb.set_trace();

    if request.method == 'GET' and search_id is not None:

        sample = pd.read_sql('select * from images where rowid=?',
                             con=thread_store.get_db(search_id_from), params=(search_id,))

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

    elif request.method == 'POST' and 'file' in request.files:

        file = request.files['file']

        # noinspection PyTypeChecker
        img = Image.open(file).convert('RGB')

    elif request.method == 'POST' and 'image' in request.json:

        img_base64 = request.json['image']
        img_bytes = io.BytesIO(base64.b64decode(img_base64[len('data:image/png;base64,'):]))

        img = Image.open(img_bytes)  # .convert('RGB')

        try:
            img_rgb = img.convert("RGB")
            img_mean = ImageStat.Stat(img_rgb).mean
            # noinspection PyTypeChecker
            img_rgb = np.array(img_rgb).astype(float)

            mask = img.getchannel('A')
            # noinspection PyTypeChecker
            mask = np.expand_dims(np.array(mask), -1).astype(float) / 255.0

            img_empty = Image.new('RGB', size=(img.width, img.height), color=tuple([int(c) for c in img_mean]))
            # noinspection PyTypeChecker
            img_empty = np.array(img_empty).astype(float)

            img = (1.0 - mask) * img_empty + mask*img_rgb

            img = Image.fromarray(img.astype('uint8'))

            # img.save('test.jpeg', "JPEG")

            # img_empty = Image.new('RGB', size=(img.width, img.height), color=tuple([int(c) for c in img_mean]))
            # img = Image.composite(img_rgb, img_empty, mask=mask)

            # img.save('test.jpeg', "JPEG")
        except ValueError:
            pass
    else:
        raise BadRequest()

    full_img = img

    if x >= 0 and y >= 0 and width > 0 and height > 0:
        # noinspection PyTypeChecker
        img = full_img.crop((full_img.size[0]*x, full_img.size[1]*y,
                             full_img.size[0]*x + width*full_img.size[0],
                             full_img.size[1]*y + height*full_img.size[1]))

    extract_features, extract_transform = thread_store.get_extraction_model(model_conf)

    # import ipdb;ipdb.set_trace()

    img = extract_transform(img)

    # import ipdb;ipdb.set_trace()

    # transforms.ToPILImage()(img).save('test.jpeg', 'JPEG')

    img = img.unsqueeze(0)

    fe = extract_features(img)

    fe = fe.squeeze()

    result = get_similar_from_features(conf, count, data_conf, fe, model_conf, start)

    if x < 0 and y < 0 and width < 0 and height < 0:
        x, y, width, height = 0.0, 0.0, 1.0, 1.0

    return jsonify({'ids': result, 'x': x, 'y': y, 'width': width, 'height': height})


def has_table(table_name, data_conf):
    return \
        thread_store.get_db(data_conf).execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
                                               (table_name,)).fetchone()\
        is not None


@app.route('/configuration')
@htpasswd.required
def configuration(user):
    gconf = dict()

    gconf['CONFIGURATION'] = app.config['CONFIGURATION']
    gconf['MODEL_CONFIGURATION'] = app.config['MODEL_CONFIGURATION']
    gconf['DATA_CONFIGURATION'] = app.config['DATA_CONFIGURATION']

    return jsonify(gconf)


@app.route('/imageids/<data_conf>')
@htpasswd.required
@cache_for(minutes=10)
def get_image_ids(user, data_conf):
    # import ipdb;ipdb.set_trace()
    del user

    df = pd.read_sql('select rowid from images', con=thread_store.get_db(data_conf))

    if df is None or len(df) == 0:
        return jsonify("")

    return jsonify(df.rowid.tolist())


@app.route('/haslinks/<data_conf>')
@htpasswd.required
def has_links(user, data_conf):
    del user
    return jsonify(has_table('links', data_conf))


@app.route('/hasiconclass/<data_conf>')
@htpasswd.required
def has_iconclass(user, data_conf):
    del user
    return jsonify(has_table('iconclass', data_conf))

@app.route('/hastags/<data_conf>')
@htpasswd.required
def has_tags(user, data_conf):
    del user
    return jsonify(has_table('tags', data_conf))


@app.route('/link/<data_conf>/<image_id>')
@htpasswd.required
@cache_for(minutes=10)
def get_link(user, data_conf, image_id=None):
    del user

    if not has_table('links', data_conf):

        return jsonify("")

    link = pd.read_sql('select * from links where rowid=?', con=thread_store.get_db(data_conf), params=(image_id,))

    if link is None or len(link) == 0:
        return jsonify("")

    url = link.url.iloc[0]

    return jsonify(url)


@app.route('/ppn/<data_conf>/<ppn>')
@htpasswd.required
@cache_for(minutes=10)
def get_ppn_images(user, data_conf, ppn=None):
    del user

    if not has_table('links', data_conf):

        return jsonify("")


    if not has_table('predictions', data_conf):
        links = pd.read_sql('select links.rowid from links where links.ppn=?',
                            con=thread_store.get_db(data_conf), params=(ppn,))
    else:
        links = pd.read_sql('select links.rowid from links join predictions on predictions.rowid=links.rowid '
                            'where links.ppn=? and '
                            '(predictions.label="Abbildung" or predictions.label="Photo" or predictions.label="Karte")',
                            con=thread_store.get_db(data_conf), params=(ppn,))

    if links is None or len(links) == 0:
        return jsonify("")

    return jsonify({'ids': links.rowid.tolist()})


@app.route('/image-ppn/<data_conf>/<rowid>')
@htpasswd.required
@cache_for(minutes=10)
def get_image_ppn(user, data_conf, rowid=None):
    del user

    if not has_table('links', data_conf):

        return "NOT FOUND", 404

    link = pd.read_sql('select * from links where rowid=?', con=thread_store.get_db(data_conf), params=(rowid,))

    if link is None or len(link) == 0:
        return jsonify("")

    return jsonify(json.loads(link.iloc[0].to_json()))


@app.route('/image-iconclass/<data_conf>/<rowid>')
@htpasswd.required
@cache_for(minutes=10)
def get_image_iconclass(user, data_conf, rowid=None):
    del user

    if not has_table('iconclass', data_conf):

        return "NOT FOUND", 404

    iconclass_info = pd.read_sql('select * from iconclass where imageid=?', con=thread_store.get_db(data_conf),
                                 params=(rowid,))

    result = []
    for _, (index, file, target, label, imageid) in iconclass_info.iterrows():

        label_parts = iconclass.get_parts(label)

        result.append({'text': target, 'label': label, 'parts': label_parts})

    return jsonify(result)

@app.route('/delete-image-tag/<data_conf>', methods=['POST'])
@htpasswd.required
def delete_image_tag(user, data_conf):

    if not has_table('tags', data_conf):
        return "OK", 200

    conn = thread_store.get_db(data_conf)

    if "tag" not in request.json:
        raise BadRequest()

    if "ids" not in request.json:
        raise BadRequest()

    for image_id in request.json['ids']:

        if conn.execute("select * from tags where image_id=? and tag=?",
                        (image_id, request.json['tag'])).fetchone() is None:
            continue

        # print("Deleting...")

        conn.execute('BEGIN EXCLUSIVE TRANSACTION')

        conn.execute('delete from tags where image_id=? and tag=?', (image_id, request.json['tag']))

        conn.execute('COMMIT TRANSACTION')

    return "OK", 200

@app.route('/add-image-tag/<data_conf>', methods=['POST'])
@htpasswd.required
def add_image_tag(user, data_conf):

    conn = thread_store.get_db(data_conf)

    if not has_table('tags', data_conf):
        conn.execute('BEGIN EXCLUSIVE TRANSACTION')

        conn.execute('create table tags (id integer primary key, image_id integer, '
                     'tag text not null, user text not null, timestamp text not null)')

        conn.execute('COMMIT TRANSACTION')

    if "tag" not in request.json:
        raise BadRequest()

    if "ids" not in request.json:
        raise BadRequest()

    conn.execute('BEGIN EXCLUSIVE TRANSACTION')

    for image_id in request.json['ids']:
        if conn.execute("select * from tags where image_id=? and tag=?",
                        (image_id, request.json['tag'])).fetchone() is not None:
            print("continue")
            continue


        conn.execute('insert into tags(image_id, tag, user, timestamp) values(?,?,?,?)',
                     (image_id,request.json['tag'], user, datetime.now()))

        print("insert into tags(image_id, tag, user, timestamp) values(?,?,?,?)");

    conn.execute('COMMIT TRANSACTION')

    return "OK", 200


@app.route('/image-tags/<data_conf>/<image_id>')
@htpasswd.required
def get_image_tags(user, data_conf, image_id=None):
    del user

    #result = [{'tag' : 'test', 'user': 'klabusch', 'timestamp' : datetime.now()}]

    if not has_table('tags', data_conf):

        return "NOT FOUND", 404

    tag_info = pd.read_sql('select * from tags where image_id=?', con=thread_store.get_db(data_conf),
                           params=(image_id,))
    result = []
    for _, (index, image_id, tag, user, timestamp) in tag_info.iterrows():

        result.append({ 'tag': tag, 'user': user, 'timestamp': timestamp})

    return jsonify(result)


@app.route('/image-file/<data_conf>/<rowid>')
@htpasswd.required
@cache_for(minutes=10)
def get_image_file(user, data_conf, rowid=None):
    del user

    img = pd.read_sql('select * from images where rowid=?', con=thread_store.get_db(data_conf), params=(rowid,))

    if img is None or len(img) == 0:
        return jsonify("")

    return jsonify(json.loads(img.iloc[0].to_json()))


@app.route('/image/<data_conf>')
@app.route('/image/<data_conf>/<image_id>')
@app.route('/image/<data_conf>/<image_id>/<version>')
@app.route('/image/<data_conf>/<image_id>/<version>/<marker>')
@htpasswd.required
@cache_for(hours=3600)
def get_image(user, data_conf, image_id=None, version='resize', marker='regionmarker'):

    del user

    max_img_size = app.config['MAX_IMG_SIZE']

    sample = pd.read_sql('select * from images where rowid=?', con=thread_store.get_db(data_conf), params=(image_id,))

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

    if version == 'resize':

        scale_factor = None
        img = None
        conn = thread_store.get_thumb_db()
        if conn is not None:

            result = conn.execute("SELECT data, scale_factor FROM thumbnails WHERE filename=? AND size=?",
                                  (filename, max_img_size)).fetchone()
            if result is not None:
                data, scale_factor = result

                buffer = io.BytesIO(data)

                img = Image.open(buffer)

        if img is None:
            img = Image.open(filename).convert('RGB')

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
        img = Image.open(filename).convert('RGB')
    else:
        return "BAD PARAMS <version>: full/resize", 400

    if marker == 'nomarker':
        pass
    elif marker == 'regionmarker':

        if x >= 0 and y >= 0 and width > 0 and height > 0:

            draw = ImageDraw.Draw(img, 'RGBA')

            # noinspection PyTypeChecker
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
