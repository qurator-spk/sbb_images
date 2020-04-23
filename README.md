env FLASK_APP=./app.py env FLASK_ENV=development flask run

gunicorn --bind 0.0.0.0:5000 wsgi:app

