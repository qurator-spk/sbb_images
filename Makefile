#
# cadaver https://qurator-data.de --proxy=proxy.sbb.spk-berlin.de:3128
#

NUM_WORKERS?=16
N_TREES?=100

DATA_DIR=..
IMAGE_DATA_BASE=stabi-illustrations-with-detections.sqlite
INDEX_PREFIX=$(basename $(IMAGE_DATA_BASE))-NT$(N_TREES)

###########################################################

model-selection:
	model-selection stabi-illustrations.sqlite model-selection.pkl --max-epoch=20 --n-splits=5 --decrease-epochs=20 --decrease-factor=0.5 --model-name=resnet18 --model-name=resnet34 --model-name=inception_v3 --model-name=googlenet --model-name=resnext50_32x4d --num-trained-layers=1 --num-trained-layers=2 --num-trained-layers=3
train-classifier:
	train-classifier stabi-illustrations.sqlite model-selection.pkl classifier.bin
apply-classifier:
	apply-classifier stabi-illustrations.sqlite model-selection.pkl classifier.bin full-classification.pkl

VST:
	git clone https://github.com/labusch/VST.git
MSCLIP:
	git clone https://github.com/labusch/MSCLIP.git

docker-search-cpu:	MSCLIP VST
	docker build --build-arg http_proxy=$(http_proxy)  -t qurator/webapp-sbb-search-cpu -f DockerSearch.cpu .

docker-search-iconclass-cpu:	MSCLIP VST
	docker build --build-arg http_proxy=$(http_proxy)  -t qurator/webapp-sbb-search-iconclass-cpu -f DockerSearch.cpu .

##########################################################

wasserzeichen-index:
	create-search-index wasserzeichen.sqlite wasserzeichen.ann --model-name googlenet --batch-size 256 --n-trees 50 --layer-name avgpool

wasserzeichen-saliency:
	train_test_eval_rgb --Testing True --pretrained_model /home/kai.labusch/MMK/VST/pretrained/80.7_T2T_ViT_t_14.pth --test_paths Wasserzeichen --save_model_dir /home/kai.labusch/MMK/VST/pretrained/RGB_VST.pth --save_test_path_root saliency --batch_size 128

wasserzeichen-vst-index:
	create-search-index wasserzeichen.sqlite wasserzeichen-vst.ann  --layer-name "token_trans.saliency_token_pre" --layer-output --vit-model /home/kai.labusch/MMK/VST/pretrained/80.7_T2T_ViT_t_14.pth --vst-model /home/kai.labusch/MMK/VST/pretrained/RGB_VST.pth --batch-size 16  --n-trees 50

##########################################################

stabi-illustrations-saliency:
	train_test_eval_rgb --Testing True --pretrained_model /home/kai.labusch/MMK/VST/pretrained/80.7_T2T_ViT_t_14.pth --test_paths Stabi-Illustrationen --save_model_dir /home/kai.labusch/MMK/VST/pretrained/RGB_VST.pth --save_test_path_root saliency --batch_size 128

# "token_trans.saliency_token_pre.sigmoid"

##########################################################

%-saliency.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)

	create-search-index  $< $@ --model-name googlenet --use-saliency-mask  --vit-model /home/kai.labusch/MMK/VST/pretrained/80.7_T2T_ViT_t_14.pth --vst-model /home/kai.labusch/MMK/VST/pretrained/RGB_VST.pth --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

##############

%-clip-index-VIT-B16.ann:
	create-search-index $< $@ --clip-model="ViT-B/16" --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

%-clip-index-VIT-B32.ann:   $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --clip-model="ViT-B/32" --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

%-clip-index-VIT-L14.ann:  # $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --clip-model="ViT-L/14" --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

##

%-clip-index-RN50.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --clip-model="RN50" --batch-size 16 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

%-clip-index-RN101.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --clip-model="RN101" --batch-size 16 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

%-clip-index-RN50x4.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --clip-model="RN50x4" --batch-size 16 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

%-clip-index-RN50x16.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --clip-model="RN50x16" --batch-size 16 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

%-clip-index-RN50x64.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --clip-model="RN50x64" --batch-size 16 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

##

clip-vit-indices: $(INDEX_PREFIX)-clip-index-VIT-L14.ann $(INDEX_PREFIX)-clip-index-VIT-B32.ann $(INDEX_PREFIX)-clip-index-VIT-B16.ann

clip-rn-indices: $(INDEX_PREFIX)-clip-index-RN50.ann $(INDEX_PREFIX)-clip-index-RN101.ann $(INDEX_PREFIX)-clip-index-RN50x4.ann $(INDEX_PREFIX)-clip-index-RN50x16.ann $(INDEX_PREFIX)-clip-index-RN50x64.ann

clip-indices: clip-vit-indices clip-rn-indices

##################################################################

%-msclip-index-b16-yfcc.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --ms-clip-model=/home/kai.labusch/MMK/MSCLIP/experiments/model/b16-yfcc-msclips.yaml --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

%-msclip-index-b32-laion.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --ms-clip-model=/home/kai.labusch/MMK/MSCLIP/experiments/model/b32-laion-msclips.yaml --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

%-msclip-index-b32-yfcc.ann: $(DATA_DIR)/$(IMAGE_DATA_BASE)
	create-search-index $< $@ --ms-clip-model=/home/kai.labusch/MMK/MSCLIP/experiments/model/b32-yfcc-msclips.yaml --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

msclip-indices: $(INDEX_PREFIX)-msclip-index-b32-yfcc.ann $(INDEX_PREFIX)-msclip-index-b16-yfcc.ann $(INDEX_PREFIX)-msclip-index-b32-laion.ann

##################################################################

EPOCHS=10
ACCU_STEPS=1
START_LR=10e-4
TEST_INTERVAL=500
LR_SCHEDULER=CosineAnnealingWarmRestarts
SAMPLER=IconClassTreeSampler
DEBUG=
TRFLAGS=


FPARAMS=epochs$(EPOCHS)_as$(ACCU_STEPS)_start-lr$(START_LR)_lr-sched$(LR_SCHEDULER)-sampler$(SAMPLER)

MSCLIP_PATH=/home/kai.labusch/MMK/MSCLIP
ICONCLASS_PATH=/home/kai.labusch/MMK/iconclass

iconclass-traintestsplit:
	iconclass-traintestsplit  $(ICONCLASS_PATH)/testset/data.json ./train.json ./test.json --train-fraction=0.9

iconclass-b16-yfcc-msclips: export ICONCLASS_DB_LOCATION = $(ICONCLASS_PATH)/data/iconclass.sqlite
iconclass-b16-yfcc-msclips:
	iconclass-train --test-data-json=./test.json --sampler=$(SAMPLER) --test-interval=$(TEST_INTERVAL) --batch-size=64 --num-workers=$(NUM_WORKERS) --epochs=$(EPOCHS) --accu-steps=$(ACCU_STEPS) --start-lr=$(START_LR) --lr-scheduler=$(LR_SCHEDULER) $(MSCLIP_PATH)/experiments/model/b16-yfcc-msclips.yaml $(MSCLIP_PATH)/msclip/dataset/languages/bpe_simple_vocab_16e6.txt.gz ./train.json $(ICONCLASS_PATH)/testset ./iconclass-b16-yfcc-msclips_$(FPARAMS).pth ./iconclass-b16-yfcc-msclips_$(FPARAMS).pkl $(DEBUG) $(TRFLAGS)

iconlass-database:
	create-database iconclass-testset iconclass-test.sqlite --subset-json=notebooks/experiment10/test.json
	iconclass-add-table iconclass-testset/data.json iconclass-test.sqlite
	create-database iconclass-testset iconclass-train.sqlite --subset-json=notebooks/experiment10/train.json
	iconclass-add-table iconclass-testset/data.json iconclass-train.sqlite

iconclass-msclip-retrained-search-index-test:
	create-search-index iconclass-test.sqlite iconclass-test-msclip-retrained-search-index.ann --ms-clip-model=notebooks/experiment10/b16-yfcc-msclips.yaml --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

iconclass-msclip-retrained-search-index-train:
	create-search-index iconclass-train.sqlite iconclass-train-msclip-retrained-search-index.ann --ms-clip-model=notebooks/experiment10/b16-yfcc-msclips.yaml --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)


iconclass-msclip-search-index-test:
	create-search-index iconclass-test.sqlite iconclass-test-msclip-search-index.ann --ms-clip-model=$(MSCLIP_PATH)/experiments/model/b16-yfcc-msclips.yaml --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)

iconclass-msclip-search-index-train:
	create-search-index iconclass-train.sqlite iconclass-train-msclip-search-index.ann --ms-clip-model=$(MSCLIP_PATH)/experiments/model/b16-yfcc-msclips.yaml --batch-size 64 --n-trees $(N_TREES) --num-workers $(NUM_WORKERS)
