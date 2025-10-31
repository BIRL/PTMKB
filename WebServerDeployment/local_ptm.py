import json
from typing import Literal

with open('../data/dbptm/dbptm.json', 'r') as f:
    dbptm_data: list[dict[str, str]] = json.load(f)

def fetch_identifiers(_id: str) -> list[str]:
    _id = _id.upper()
    ids_upid = [
        i['Protein Identifier'] for i in dbptm_data
        if str(i['Protein Identifier']).startswith(_id)
    ]
    ids_upac = [
        i['Accession Number'] for i in dbptm_data
        if str(i['Accession Number']).startswith(_id)
    ]
    ids_upid.extend(ids_upac)
    return ids_upid

def search_identifier(_id: str) -> tuple[bool, dict[str, str]]:
    _id = _id.upper()
    ids_upid = [
        i for i in dbptm_data
        if str(i['Protein Identifier']) == _id
    ]
    ids_upac = [
        i for i in dbptm_data
        if str(i['Accession Number']) == _id
    ]
    ids_upid.extend(ids_upac)
    found = True if ids_upid else False
    return (found, ids_upid)

def get_all_proteins() -> list[str]:
    return list(
        (
            str(i.get('Protein Identifier', '')),
            str(i.get('Accession Number', ''))
        )
        for i in dbptm_data
    )