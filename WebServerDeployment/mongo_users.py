# mongo_users.py
import pymongo
import hashlib

client = pymongo.AsyncMongoClient(
    'mongodb://localhost:27017',
)

USERS = client['ptmkb']['users']

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