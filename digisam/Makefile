N_TREES=50
DATA_DIR=.
IMAGE_DATA_BASE=stabi-illustrations.sqlite
INDEX_PREFIX=$(basename $(IMAGE_DATA_BASE))-NT$(N_TREES)
NUM_WORKERS=5

THUMBNAIL_FILE=stabi-thumbnails.sqlite

IMAGE_BASE_DIR="Stabi-Illustrationen"

$(DATA_DIR)/$(IMAGE_DATA_BASE):
	create-database --pattern="*.jpg" $(IMAGE_BASE_DIR) $(IMAGE_DATA_BASE)

googlenet-index:
	create-search-index --model-name=googlenet --n-trees=$(N_TREES) $(IMAGE_DATA_BASE) $(INDEX_PREFIX)-googlenet.ann --num-workers $(NUM_WORKERS) --thumbnail-sqlite-file $(THUMBNAIL_FILE) --thumbnail-table-name thumbnails

%-msclip-index-b16-yfcc.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --ms-clip-model=MSCLIP/original/config/b16-yfcc-msclips.yaml --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS) --thumbnail-sqlite-file $(THUMBNAIL_FILE) --thumbnail-table-name thumbnails

%-msclip-index-b32-laion.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --ms-clip-model=MSCLIP/original/config/b32-laion-msclips.yaml --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS) --thumbnail-sqlite-file $(THUMBNAIL_FILE) --thumbnail-table-name thumbnails

%-msclip-index-b32-yfcc.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --ms-clip-model=MSCLIP/original/config/b32-yfcc-msclips.yaml --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS) --thumbnail-sqlite-file $(THUMBNAIL_FILE) --thumbnail-table-name thumbnails

msclip-indices: $(INDEX_PREFIX)-msclip-index-b32-yfcc.ann $(INDEX_PREFIX)-msclip-index-b16-yfcc.ann $(INDEX_PREFIX)-msclip-index-b32-laion.ann

thumbnails:
	create-thumbnails --pattern="*.jpg" $(IMAGE_BASE_DIR) $(THUMBNAIL_FILE) 
run-service-debug:
	env CONFIG=`pwd`/search-config.json env FLASK_APP=search.py env FLASK_ENV=development flask run --port=4716 --host=0.0.0.0
run-service-production:
	gunicorn --timeout 600 --chdir . --bind 0.0.0.0:4716 qurator.sbb_images.webapp.wsgi_search:app

