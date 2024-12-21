"""Defining constants here for usage in the system."""
import glob
import json
import os

# Database loading mechanisms (since they're sufficiently small, doesn't matter how much we load)
def load_tables() -> dict[str, dict[str, dict[str, dict[str, dict[str, float]]]]]:
    ptms = [i.split("\\")[-1] for i in glob.glob(r'data\tables\*')]
    response = {ptm: [] for ptm in ptms}
    for ptm in ptms:
        # Pick out all AAs in that folder for both tables
        AAs = [i.split("\\")[-1].split('.')[0] for i in glob.glob(f'data/tables/{ptm}/log-e/*.json')]
        for aa in AAs:
            with (
                open(f"data/tables/{ptm}/log-e/{aa}.json", 'r', encoding='utf-8') as f1,
                open(f"data/tables/{ptm}/freq/{aa}.json", 'r', encoding='utf-8') as f2
            ):
                response[ptm].append(
                    {
                        aa: {
                            'log-e': json.load(f1),
                            'freq': json.load(f2)
                        }
                    }
                )
    return response

def load_resid_database() -> list[dict]:
    with open('./data/resid/residues.json', 'r') as f:
        return json.load(f)['Database']['Entry']

def load_users() -> dict[str, dict[str, str | dict]]:
    if not os.path.exists('./data/users'):
        os.mkdir('./data/users')
        with open('./data/users/users.json', 'w') as f:
            json.dump({}, f)
    with open('./data/users/users.json', 'r') as f:
        return json.load(f)

# Define constants over here
PTM_TABLES = load_tables()
RESID_DATABASE = load_resid_database()
USERS = load_users()