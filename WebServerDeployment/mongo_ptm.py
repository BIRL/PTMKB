import itertools
import pymongo

client = pymongo.AsyncMongoClient(
    'mongodb://localhost:27017',
)

PTM = client['ptmkb']['proteins']

# Functions below related to PTM

async def fetch_identifiers(_id: str) -> list[str]:
    ids = [
        [doc.get('Protein Identifier'), {doc.get('Accession Number')}]
        if isinstance(doc.get('Accession Number'), str) else [doc.get('Protein Identifier')]
        async for doc in
        PTM.find(
            {
                '$or': [
                    {
                        'Protein Identifier': {
                            '$regex': f'^{_id}',
                            '$options': 'i'
                        }
                    },
                    {
                        'Accession Number': {
                            '$regex': f'^{_id}',
                            '$options': 'i'
                        }
                    }
                ]
            },
            {
                'Protein Identifier': 1,
                'Accession Number': 1,
                '_id': 0
            }
        )
    ]
    ids = list(itertools.chain.from_iterable(ids))
    ids = [i.pop() if isinstance(i, set) else i for i in ids]
    return ids

async def search_identifier(_id: str) -> tuple[bool, dict[str, str]]:
    results = [
        i async for i in
        PTM.find(
            {
                '$or': [
                    {'Protein Identifier': _id},
                    {'Accession Number': _id}
                ]
            },
            {
                '_id': 0
            }
        )
    ]
    found = True if results else False
    return (found, results)

async def get_all_proteins() -> list[str]:
    collection = [i async for i in await PTM.find({}, {'_id': 0})]
    set1 = set(i.get('Protein Identifier', '') for i in collection)
    set2 = set(i.get('Accession Number', '') for i in collection)
    set1.update(set2)
    return list(set1)