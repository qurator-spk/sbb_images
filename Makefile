#
# cadaver https://qurator-data.de --proxy=proxy.sbb.spk-berlin.de:3128
#

NUM_WORKERS=20

model-selection:
	model-selection stabi-illustrations.sqlite model-selection.pkl --max-epoch=20 --n-splits=5 --decrease-epochs=20 --decrease-factor=0.5 --model-name=resnet18 --model-name=resnet34 --model-name=inception_v3 --model-name=googlenet --model-name=resnext50_32x4d --num-trained-layers=1 --num-trained-layers=2 --num-trained-layers=3
train-classifier:
	train-classifier stabi-illustrations.sqlite model-selection.pkl classifier.bin
apply-classifier:
	apply-classifier stabi-illustrations.sqlite model-selection.pkl classifier.bin full-classification.pkl
docker-search-cpu:
	docker build --build-arg http_proxy=${http_proxy}  -t qurator/webapp-sbb-search-cpu -f DockerSearch.cpu .

wasserzeichen-index:
	create-search-index wasserzeichen.sqlite wasserzeichen.ann --model-name googlenet --batch-size 256 --n-trees 50 --layer-name avgpool

wasserzeichen-saliency:
	train_test_eval_rgb --Testing True --pretrained_model /home/kai.labusch/MMK/VST/pretrained/80.7_T2T_ViT_t_14.pth --test_paths Wasserzeichen --save_model_dir /home/kai.labusch/MMK/VST/pretrained/RGB_VST.pth --save_test_path_root saliency --batch_size 128

stabi-illustrations-saliency:
	train_test_eval_rgb --Testing True --pretrained_model /home/kai.labusch/MMK/VST/pretrained/80.7_T2T_ViT_t_14.pth --test_paths Stabi-Illustrationen --save_model_dir /home/kai.labusch/MMK/VST/pretrained/RGB_VST.pth --save_test_path_root saliency --batch_size 128


# "token_trans.saliency_token_pre.sigmoid"

stabi-illustrations-saliency-index:
	create-search-index stabi-illustrations-with-detections.sqlite stabi-illustrations-with-detections-saliency.ann --model-name googlenet --use-saliency-mask  --vit-model /home/kai.labusch/MMK/VST/pretrained/80.7_T2T_ViT_t_14.pth --vst-model /home/kai.labusch/MMK/VST/pretrained/RGB_VST.pth --batch-size 64  --n-trees 50 --num-workers ${NUM_WORKERS}

stabi-illustrations-clip-index:
	create-search-index stabi-illustrations-with-detections.sqlite stabi-illustrations-with-detections-clip.ann --clip-model="ViT-B/32" --batch-size 64  --n-trees 50 --num-workers 20

stabi-illustrations-clip-index-large:
	create-search-index stabi-illustrations-with-detections.sqlite stabi-illustrations-with-detections-clip-large.ann --clip-model="ViT-L/14" --batch-size 64  --n-trees 50 --num-workers 20

wasserzeichen-vst-index:
	create-search-index wasserzeichen.sqlite wasserzeichen-vst.ann  --layer-name "token_trans.saliency_token_pre" --layer-output --vit-model /home/kai.labusch/MMK/VST/pretrained/80.7_T2T_ViT_t_14.pth --vst-model /home/kai.labusch/MMK/VST/pretrained/RGB_VST.pth --batch-size 16  --n-trees 50
