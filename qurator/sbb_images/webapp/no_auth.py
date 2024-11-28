from functools import wraps
from flask_htpasswd import HtPasswdAuth
from passlib.apache import HtpasswdFile
import os


class NoAuth:
    def __init__(self, app=None):

        del app

    def required(self, func):

        @wraps(func)
        def decorated(*args, **kwargs):
            kwargs['user'] = None
            return func(*args, **kwargs)

        return decorated


class AuthReloader:
    def __init__(self, app, passwd_file):

        self._app = app
        self._passwd_file = passwd_file
        self._mtime = os.path.getmtime(self._passwd_file)
        self._auth = HtPasswdAuth(app)

    def required(self, func):
        @wraps(func)
        def decorated(*args, **kwargs):

            if self._mtime != os.path.getmtime(self._passwd_file):
                self._mtime = os.path.getmtime(self._passwd_file)

                self._auth.users = HtpasswdFile(self._app.config['FLASK_HTPASSWD_PATH'])

            is_valid, user = self._auth.authenticate()
            if not is_valid:
                return self._auth.auth_failed()
            kwargs['user'] = user
            return func(*args, **kwargs)

        return decorated
