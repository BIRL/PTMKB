import itertools
import pymongo

dbptm_data = pymongo.MongoClient(
    'mongodb://localhost:27017',
)['ptm']['proteins']

def fetch_identifiers(_id: str) -> list[str]:
    ids = [
        [doc.get('Protein Identifier'), {doc.get('Accession Number')}]
        if isinstance(doc.get('Accession Number'), str) else [doc.get('Protein Identifier')]
        for doc in
        dbptm_data.find(
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

def search_identifier(_id: str) -> tuple[bool, dict[str, str]]:
    results = list(
        dbptm_data.find(
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
    )
    found = True if results else False
    return (found, results)

def get_all_proteins() -> list[str]:
    collection = list(dbptm_data.find({}, {'_id': 0}))
    set1 = set(i.get('Protein Identifier', '') for i in collection)
    set2 = set(i.get('Accession Number', '') for i in collection)
    set1.update(set2)
    return list(set1)