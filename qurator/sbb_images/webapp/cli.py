import htpasswd
import click
import pandas as pd
import string
import random
import re


def fix_umlauts(s):
    return s.replace("ä", "ae").replace("ü", "ue").replace("ö", "oe").replace("ß", "sz")


def rnd_passwd(len):

    return ''.join(random.choice(string.ascii_lowercase) for _ in range(len))


@click.command()
@click.argument('passwd-file', type=click.Path())
@click.argument('user-input-file', type=click.Path(exists=True))
@click.argument('user-output-file', type=click.Path(exists=False))
@click.option('--password_len', type=int, default=8)
def create_accounts(passwd_file, user_input_file, user_output_file, password_len):

    df_users = pd.read_csv(user_input_file)

    df_users = df_users[['last_name', 'first_name']]

    df_output = []
    with htpasswd.Basic(passwd_file, mode="md5") as passwd_file:
        for idx, (last_name, first_name) in df_users.iterrows():

            fname_prefix_len = 1
            while True:
                try:
                    fn = re.sub(r"\s+", "_", fix_umlauts(first_name.lower().strip()))
                    ln = re.sub(r"\s+", "_", fix_umlauts(last_name.lower().strip()))

                    username = ''.join([fn[0:0+fname_prefix_len], ln])
                    password = ''.join(random.choice(string.ascii_lowercase) for _ in range(password_len))

                    passwd_file.add(username, password)

                    break
                except htpasswd.basic.UserExists:
                    fname_prefix_len += 1

            df_output.append((first_name.strip(), last_name.strip(), username, password))

    df_output = pd.DataFrame(df_output, columns=['first_name', 'last_name', 'username', 'password'])

    df_output.to_csv(user_output_file)
