import multiprocessing as mp
import gc


def run(tasks, **kwargs):

    if 'processes' in kwargs:

        if kwargs['processes'] == 0:

            if 'initializer' in kwargs:

                if 'initargs' in kwargs:
                    kwargs['initializer'](*kwargs['initargs'])
                else:
                    kwargs['initializer']()

            for ta in tasks:
                ret = ta()

                yield ret

                del ret
                del ta

            return

    if 'method' in kwargs:

        context = mp.get_context(kwargs['method'])

        del kwargs['method']

    else:
        context = mp.get_context()

    with context.Pool(**kwargs) as pool:
        for it, result in enumerate(pool.imap(_run, tasks)):

            yield result

            del result

            if it % 1000 == 0:
                gc.collect()


def run_unordered(tasks, **kwargs):

    if 'processes' in kwargs:

        if kwargs['processes'] == 0:

            if 'initializer' in kwargs:

                if 'initargs' in kwargs:
                    kwargs['initializer'](*kwargs['initargs'])
                else:
                    kwargs['initializer']()

            for ta in tasks:
                ret = ta()

                yield ret

                del ret
                del ta

            return

    if 'method' in kwargs:

        context = mp.get_context(kwargs['method'])

        del kwargs['method']

    else:
        context = mp.get_context()

    with context.Pool(**kwargs) as pool:

        for it, result in enumerate(pool.imap_unordered(_run, tasks)):

            yield result

            del result

            if it % 1000 == 0:
                gc.collect()


def _run(t):

    ret = t()

    del t

    return ret
