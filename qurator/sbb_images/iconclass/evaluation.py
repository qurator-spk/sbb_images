import click

import requests
from requests.auth import HTTPBasicAuth
from pprint import pprint
from tqdm import tqdm


@click.command()
@click.argument("url", type=str)
@click.option('--query-data-conf', type=str, default=None)
@click.option('--search-configuration', type=str, default=None)
@click.option('--show-configuration', is_flag=True)
@click.option('--user', type=str, default=None)
@click.option('--password', type=str, default=None)
def evaluate(url, query_data_conf, search_configuration, show_configuration, user, password):

    auth = None
    if user is not None and password is not None:
        auth = HTTPBasicAuth(username=user, password=password)

    if show_configuration:

        resp = requests.get(url + "/configuration", auth=auth)

        pprint(resp.json())

        return

    queries = None
    if query_data_conf is not None:

        resp = requests.get(url + "/imageids/" + query_data_conf, auth=auth)

        queries = resp.json()

        print("Number of queries: {}".format(len(queries)))

    if search_configuration is None:
        return

    for query in tqdm(queries):

        #print(query)

        resp = requests.get(url + "/similar-by-image/" + search_configuration,
                            params={"search_id": str(query),
                                    "search_id_from":  query_data_conf}, auth=auth)

        print(resp)


