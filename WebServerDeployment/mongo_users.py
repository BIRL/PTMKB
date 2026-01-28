# mongo_users.py
import pymongo
import hashlib
from typing import Literal
from datetime import datetime, timezone

client = pymongo.AsyncMongoClient(
    'mongodb://localhost:27017',
)

USERS = client['ptmkb']['users']
HISTORIES = client['ptmkb']['histories']

# Below is user related

def _hash(s: str) -> str:
    return hashlib.sha256(s.encode('utf-8')).hexdigest()

async def user_exists(username: str) -> bool:
    return await USERS.count_documents({'username': username}, limit=1) == 1

async def create_user(username: str, password_plain: str, token_dict: dict) -> bool:
    try:
        await USERS.insert_one({
            'username': username,
            'password': _hash(password_plain),
            'token': token_dict
        })
        return True
    except Exception:
        return False

async def validate_password(username: str, password_plain: str) -> bool:
    doc = await USERS.find_one({'username': username}, {'password': 1, '_id': 0})
    return bool(doc) and doc['password'] == _hash(password_plain)

async def get_access_token(username: str) -> str | None:
    doc: dict[str, dict] = await USERS.find_one({'username': username}, {'token.access_token': 1, '_id': 0})
    return (doc or {}).get('token', {}).get('access_token')

async def set_token(username: str, token_dict: dict) -> bool:
    res = await USERS.update_one({'username': username}, {'$set': {'token': token_dict}})
    return res.matched_count == 1

# Below is history-related (search history through web browser AND API if needed)

async def log_search_history(token_data: dict, mode: Literal['Web', 'API'], item: str, results: dict) -> bool:
    res = await HISTORIES.insert_one(
        {
            "username": token_data.get('username'),
            "protein": item,
            "date": datetime.now(timezone.utc),
            "mode": mode,
            "results": results
        }
    )
    return res.acknowledged

async def retrieve_history(username: str):
    res = [i async for i in HISTORIES.find(
        { "username": username },
        { '_id': 0 }
    )]
    return list(res)