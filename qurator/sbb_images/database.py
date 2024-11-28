import sqlite3

# IMAGES ===================================================


def setup_images_table(conn):
    conn.execute('BEGIN EXCLUSIVE TRANSACTION')

    conn.execute('CREATE TABLE IF NOT EXISTS "images" ('
                 '"index" INTEGER,  "file" TEXT,  '
                 '"num_annotations" INTEGER,  '
                 '"x" INTEGER,  '
                 '"y" INTEGER,  '
                 '"width" INTEGER,  '
                 '"height" INTEGER, '
                 '"anchor" TEXT);')

    try:
        conn.execute("ALTER TABLE images ADD anchor TEXT")  # there might be some database files out there
                                                            # that do not have this column
    except sqlite3.Error:
        pass

    conn.execute('CREATE INDEX IF NOT EXISTS idx_num_annotations on images(num_annotations);')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_num_annotations on images(num_annotations);')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_file on images(file);')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_images_anchor on images(anchor);')
    conn.execute("CREATE INDEX IF NOT EXISTS idx_images_file_x_y_width_height ON images(file,x,y,width,height)")
    conn.execute('CREATE INDEX IF NOT EXISTS idx_images_anchor ON images(anchor);')

    conn.execute('COMMIT TRANSACTION')


def setup_tags_table(conn):
    conn.execute('BEGIN EXCLUSIVE TRANSACTION')

    conn.execute('CREATE TABLE IF NOT EXISTS tags ('
                 'id integer primary key, '
                 'image_id integer, '
                 'tag text not null, '
                 'user text not null, '
                 'timestamp text not null)')

    conn.execute('CREATE INDEX IF NOT EXISTS idx_tags_imageid on tags(image_id)')

    conn.execute('CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user);')

    conn.execute('COMMIT TRANSACTION')


def setup_links_table(conn):
    conn.execute('BEGIN EXCLUSIVE TRANSACTION')

    conn.execute('CREATE TABLE IF NOT EXISTS "links" ('
                 '"index" INTEGER,  '
                 '"url" TEXT,  '
                 '"ppn" TEXT,  '
                 '"phys_id" TEXT);')

    conn.execute('CREATE INDEX IF NOT EXISTS "ix_links_index"ON "links" ("index");')
    conn.execute('CREATE INDEX IF NOT EXISTS ix_links_ppn on links(ppn);')

    conn.execute('COMMIT TRANSACTION')


def setup_iiif_links_table(conn):
    conn.execute('BEGIN EXCLUSIVE TRANSACTION')

    conn.execute('CREATE TABLE IF NOT EXISTS "iiif_links" ("image_id" INTEGER,  "url" TEXT);')

    conn.execute('CREATE INDEX IF NOT EXISTS idx_iiif_links_imageid on iiif_links(image_id)')

    conn.execute('COMMIT TRANSACTION')


def setup_annotations_table(conn):
    conn.execute('BEGIN EXCLUSIVE TRANSACTION')

    conn.execute('CREATE TABLE IF NOT EXISTS "annotations"('
                 '"index" integer primary key, '
                 '"user" TEXT, '
                 '"label" TEXT,'
                 '"IMAGE" integer)')

    conn.execute('CREATE INDEX IF NOT EXISTS idx_user on annotations(user);')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_label on annotations(label);')

    conn.execute('COMMIT TRANSACTION')


def setup_image_database(conn):

    setup_images_table(conn)

    setup_tags_table(conn)

    setup_links_table(conn)

    setup_iiif_links_table(conn)

    setup_annotations_table(conn)

    setup_iiif_links_table(conn)


# THUMBNAILS =============================================

def setup_thumbnail_database(conn):
    conn.execute('BEGIN EXCLUSIVE TRANSACTION')

    conn.execute('CREATE TABLE IF NOT EXISTS thumbnails ('
                 'id INTEGER PRIMARY KEY, '
                 'filename TEXT NOT NULL, '
                 'data BLOB NOT NULL, '
                 'size INTEGER, '
                 'scale_factor REAL)')

    conn.execute('CREATE INDEX IF NOT EXISTS idx_thumb ON thumbnails(filename, size);')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_thumb_fn ON thumbnails(filename);')

    conn.execute('COMMIT TRANSACTION')

# REGION ANNOTATOR ========================


def setup_region_annotator_database(conn):
    conn.execute('BEGIN EXCLUSIVE TRANSACTION')

    conn.execute('CREATE TABLE IF NOT EXISTS "target_patterns" ('
                 '"url_pattern" '
                 'TEXT primary key, '
                 '"description" TEXT, '
                 '"user" TEXT)')

    conn.execute('CREATE TABLE IF NOT EXISTS "annotations" ('
                 '"anno_id" TEXT primary key, '
                 '"url" TEXT, "user" TEXT, '
                 '"anno_json" TEXT, '
                 '"state" TEXT, '
                 '"last_write_time" TEXT, '
                 '"write_permit" TEXT, '
                 '"wp_valid_time" TEXT)')

    conn.execute('CREATE INDEX IF NOT EXISTS "idx_annotations_by_url" ON annotations(url)')
    conn.execute('CREATE INDEX IF NOT EXISTS "idx_annotations_by_url_and_state" ON annotations(url, state)')
    conn.execute('CREATE INDEX IF NOT EXISTS "idx_annotations_by_url_and_user" ON annotations(url, user)')

    conn.execute('COMMIT TRANSACTION')