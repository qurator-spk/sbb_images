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

%-multi-lang-clip.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --multi-lang-clip-model "M-CLIP/XLM-Roberta-Large-Vit-B-16Plus" --open-clip-model="ViT-B-16-plus-240" --open-clip-pretrained "laion400m_e32" --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS) --thumbnail-sqlite-file $(THUMBNAIL_FILE) --thumbnail-table-name thumbnails

multi-lang: $(INDEX_PREFIX)-multi-lang-clip.ann

msclip-indices: $(INDEX_PREFIX)-msclip-index-b32-yfcc.ann $(INDEX_PREFIX)-msclip-index-b16-yfcc.ann $(INDEX_PREFIX)-msclip-index-b32-laion.ann

thumbnails:
	create-thumbnails --pattern="*.jpg" $(IMAGE_BASE_DIR) $(THUMBNAIL_FILE) 
run-service-debug:
	env CONFIG=`pwd`/search-config.json env FLASK_APP=search.py env FLASK_ENV=development flask run --port=4716 --host=0.0.0.0
run-service-production:
	gunicorn --timeout 600 --chdir . --bind 0.0.0.0:4716 qurator.sbb_images.webapp.wsgi_search:app

download:
	echo "Downloading Zenodo archive part 1 ..."
	curl https://zenodo.org/api/records/2602431/files-archive -o part1.zip
	echo "Extracting Zenodo archive part 1 ..."
	7z e part1.zip
	rm -f part1.zip
	echo "Downloading Zenodo archive part 2 ..."
	curl https://zenodo.org/api/records/2598145/files-archive -o part2.zip
	echo "Extracting Zenodo archive part 2 ..."
	7z e part2.zip
	rm -f part2.zip
	echo "Downloading Zenodo archive part 3 ..."
	curl https://zenodo.org/api/records/2598261/files-archive -o part3.zip
	echo "Extracting Zenodo archive part 3 ..."
	rm -f part3.zip
	echo "Downloading Zenodo archive part 4 ..."
	curl https://zenodo.org/api/records/2598270/files-archive -o part4.zip
	echo "Extracting Zenodo archive part 4 ..."
	7z e part4.zip
	rm part4.zip
	echo "Extracting multipart Stabi-illustrations archive ..."
	7z x extracted_images.zip.001 -oStabi-Illustrationen
	rm -f extracted_images.zip.*
	echo "Unpacking extract tar archives ..."
	for i in Stabi-Illustrationen/*;do tar -xf $$i/`basename $$i`.tar --strip-components 3 --directory Stabi-Illustrationen 2> /dev/null;done
	echo "Removing tar archives ..."
	find Stabi-Illustrationen -name "*.tar" -exec rm -f {} \;
	echo "Downloading MS-CLIP checkpoints and configurations ..."
	curl https://ravius.sbb.berlin/MS-CLIP/MS-CLIP.tar.gz -o MS-CLIP.tar.gz
	echo "Extracting MS-CLIP archive ..."
	tar -xzf MS-CLIP.tar.gz
	echo "All done."
