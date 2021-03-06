model-selection:
	model-selection stabi-illustrations.sqlite model-selection.pkl --max-epoch=20 --n-splits=5 --decrease-epochs=20 --decrease-factor=0.5 --model-name=resnet18 --model-name=resnet34 --model-name=inception_v3 --model-name=googlenet --model-name=resnext50_32x4d --num-trained-layers=1 --num-trained-layers=2 --num-trained-layers=3
train-classifier:
	train-classifier stabi-illustrations.sqlite model-selection.pkl classifier.bin
apply-classifier:
	apply-classifier stabi-illustrations.sqlite model-selection.pkl classifier.bin full-classification.pkl
