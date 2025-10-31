"""Defining constants here for usage in the system."""
from pymongo import MongoClient, ASCENDING
import json

def load_tables_from_mongo(
    mongo_uri: str = "mongodb://localhost:27017",
    db_name: str = "ptmkb",
    coll_name: str = "tables",
) -> dict:
    client = MongoClient(mongo_uri)
    client["ptmkb"]["tables"].create_index([("ptm", ASCENDING)], unique=True)
    coll = client[db_name][coll_name]
    

    response = {}

    # Each document: { "ptm": "Acetylation", "data": { "freq": {...}, "log-e": {...} } }
    cursor = coll.find({}, {"_id": 0, "ptm": 1, "data.freq": 1, "data.log-e": 1})

    for doc in cursor:
        ptm = doc["ptm"]
        freq_map = doc.get("data", {}).get("freq", {}) or {}
        loge_map = doc.get("data", {}).get("log-e", {}) or {}

        # Merge AA keys from both maps
        all_aas = set(freq_map) | set(loge_map)
        response[ptm] = {
            aa: {
                "log-e": loge_map.get(aa, {}),
                "freq":   freq_map.get(aa, {}),
            }
            for aa in all_aas
        }

    return response

def load_resid_database() -> list[dict]:
    with open('./data/resid/residues.json', 'r') as f:
        return json.load(f)['Database']['Entry']

# Define constants over here
PTM_TABLES = load_tables_from_mongo()
RESID_DATABASE = load_resid_database()