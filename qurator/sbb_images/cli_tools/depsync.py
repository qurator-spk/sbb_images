import click
import re
from pprint import pprint
import sys
import subprocess


@click.command()
@click.argument('requirements-template', type=click.Path(exists=True))
def cli(requirements_template):

    print("# requirements snapshot taken by depsync.py with python version {}".format(sys.version))

    dep_map = dict()

    requirements_snapshot = subprocess.run(["pip", "list"], capture_output=True, text=True)

    for line in requirements_snapshot.stdout.splitlines():
        m = re.match(r".*?([^\s]+)\s+([0-9,.]+)", line)

        if m:
            dep_map[m[1].lower()] = {"package": m[1], "version": m[2]}

    with open(requirements_template) as file:
        for line in file:
            m = re.match(r"^\s*$", line)
            if m:
                continue # Skip space only lines

            m = re.match(r"\s*([^\s,^=]+)\s*(@.+)*", line)

            if m and m[1].lower() in dep_map:
                p = dep_map[m[1].lower()]

                if m[2] is None:
                    print("{}=={}".format(p['package'], p['version']))
                else:
                    print("{}=={}".format(p['package'], m[2]))
            else:
                pprint(dep_map)
                raise RuntimeError("Dependency not found in snapshot: {}".format(line))


if __name__ == '__main__':
    cli()

