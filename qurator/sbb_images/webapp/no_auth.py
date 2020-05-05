from functools import wraps


class NoAuth:
    def __init__(self, app=None):

        del app

    def required(self, func):

        @wraps(func)
        def decorated(*args, **kwargs):
            kwargs['user'] = None
            return func(*args, **kwargs)

        return decorated
