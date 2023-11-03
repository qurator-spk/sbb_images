import pandas as pd

from .parallel import run as prun

from fnmatch import fnmatch as _fnmatch


class FnMatchTask:

    def __init__(self, df_files, search_pattern, start, count):

        self.df_files = df_files
        self.search_pattern = search_pattern
        self.start = start
        self.count = count

    def __call__(self, *args, **kwargs):

        found = []
        for _, row in self.df_files.iterrows():

            if _fnmatch(row.file, self.search_pattern):
                found.append((row.rowid, row.file))

            if len(found) >= self.start + self.count:
                break

        return found


def fnmatch(df_files, search_pattern, start, count, batch_size=1000):

    def get_fnmatch_tasks():

        for pos in range(0, len(df_files), batch_size):

            yield FnMatchTask(df_files.iloc[pos:pos+batch_size], search_pattern, start, count)

    found = []

    for idx, batch_found in enumerate(prun(get_fnmatch_tasks(), processes=16, method='forkserver')):

        found += batch_found

        if len(found) >= start + count:
            break

    found = found[start:start+count]

    df_found = pd.DataFrame(found, columns=['rowid', 'file'])

    df_found = df_found.sort_values(by='file')

    return df_found.rowid.tolist()
