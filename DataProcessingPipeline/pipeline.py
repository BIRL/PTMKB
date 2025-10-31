from __future__ import annotations

import zipfile
import json
import requests
import numpy as np
import pandas as pd

from pathlib import Path
from typing import Dict, List, Literal, Optional
from bs4 import BeautifulSoup
from functools import lru_cache
from requests.adapters import HTTPAdapter, Retry
from pymongo import MongoClient, ASCENDING, UpdateOne
from collections import defaultdict
from itertools import islice

BASE_URL = 'https://biomics.lab.nycu.edu.tw/dbPTM'
DATA_DIR = Path('dbptm_data')
AA = list("ACDEFGHIKLMNPQRSTVWY")
POS = [f"{i:+d}" if i != 0 else "0" for i in range(-10, 11)] # 0 is neither positive nor negative

# Set up a session for requests
def make_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(
        total=5, connect=5, read=5,
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(['GET'])
    )
    s.mount('http://', HTTPAdapter(max_retries=retries))
    s.mount('https://', HTTPAdapter(max_retries=retries))
    s.headers.update({'User-Agent': 'ptmkb/1.0'})
    return s

# Create a new session
SESSION = make_session()

# Construct subsequence around modification site
# This handles edge cases with padding around the edges of the sequence
def construct_subsequence(protein: str, site0: int, flank: int = 10) -> str:
    start = max(0, site0 - flank)
    end = min(len(protein), site0 + flank + 1)
    subseq = protein[start:end]
    if site0 < flank:
        subseq = ('-' * (flank - site0)) + subseq
    if site0 + flank >= len(protein):  # fix: >=
        subseq += '-' * ((site0 + flank + 1) - len(protein))
    return subseq

# Cache meant to reduce redundant network calls
@lru_cache(maxsize=100_000)
def resolve_sequence(accession: str) -> Optional[str]:
    if not accession or not isinstance(accession, str):
        return None

    # Initial request
    r = SESSION.get(
        f'http://www.ebi.ac.uk/proteins/api/proteins/{accession}',
        timeout=20
    )
    if r.ok:
        try:
            return r.json()['sequence']['sequence']
        except Exception:
            pass

    # Fallback and fetch reason for no sequence
    r = SESSION.get(
        f'https://rest.uniprot.org/uniprotkb/{accession}',
        headers={'Accept':'application/json'},
        timeout=20
    )
    if r.ok:
        try:
            js = r.json()
            if 'inactiveReason' not in js:
                return js['sequence']['value']

            reason = js['inactiveReason'].get('inactiveReasonType')
            if reason == 'DELETED':
                # Deleted proteins will be fetched from UniParc
                upid = js['extraAttributes']['uniParcId']
                r2 = SESSION.get(
                    f'https://rest.uniprot.org/uniparc/{upid}',
                    headers={'Accept':'application/json'},
                    timeout=20
                )
                if r2.ok:
                    return r2.json()['sequence']['value']
            elif reason == 'DEMERGED':
                # Pick out new accession number from demerged list
                new_acc = js['inactiveReason']['mergeDemergeTo'][0]
                r2 = SESSION.get(
                    f'https://rest.uniprot.org/uniprotkb/{new_acc}',
                    headers={'Accept':'application/json'},
                    timeout=20
                )
                if r2.ok:
                    return r2.json()['sequence']['value']
        except Exception:
            pass

    return None

# Same method as resolve_sequence but for accessions
def resolve_accession(protein_id: str) -> Optional[str]:
    if not protein_id or not isinstance(protein_id, str):
        return None

    r = SESSION.get(
        f'http://www.ebi.ac.uk/proteins/api/proteins/{protein_id}',
        timeout=20
    )
    if r.ok:
        try:
            js = r.json()
            acc = js.get('accession') or js.get('id') or None
            if acc:
                return acc
        except Exception:
            pass

    r = SESSION.get(
        f'https://rest.uniprot.org/uniprotkb/{protein_id}',
        headers={'Accept': 'application/json'},
        timeout=20
    )
    if r.ok:
        try:
            js = r.json()
            acc = js.get('primaryAccession')
            if acc:
                return acc

            inactive = js.get('inactiveReason')
            if inactive:
                reason = inactive.get('inactiveReasonType')
                if reason == 'DEMERGED':
                    targets = inactive.get('mergeDemergeTo') or []
                    if targets:
                        new_acc = targets[0]
                        r2 = SESSION.get(
                            f'https://rest.uniprot.org/uniprotkb/{new_acc}',
                            headers={'Accept': 'application/json'},
                            timeout=20
                        )
                        if r2.ok:
                            return r2.json().get('primaryAccession')
                elif reason == 'DELETED':
                    uni_parc_id = js.get('extraAttributes', {}).get('uniParcId')
                    if uni_parc_id:
                        r2 = SESSION.get(
                            f'https://rest.uniprot.org/uniparc/{uni_parc_id}',
                            headers={'Accept': 'application/json'},
                            timeout=20
                        )
                        if r2.ok:
                            up_json = r2.json()
                            xrefs = up_json.get('uniParcCrossReferences') or []
                            if xrefs:
                                return xrefs[0].get('id')
        except Exception:
            pass

    return None

# Same method as resolve_sequence but for protein identifiers
def resolve_protein_identifier(acc_num: str) -> Optional[str]:
    if not acc_num or not isinstance(acc_num, str):
        return None

    r = SESSION.get(
        f'http://www.ebi.ac.uk/proteins/api/proteins/{acc_num}',
        timeout=20
    )
    if r.ok:
        try:
            js = r.json()
            acc = js.get('id') or js.get('accession') or None
            if acc:
                return acc
        except Exception:
            pass

    r = SESSION.get(
        f'https://rest.uniprot.org/uniprotkb/{acc_num}',
        headers={'Accept': 'application/json'},
        timeout=20
    )
    if r.ok:
        try:
            js = r.json()
            acc = js.get('uniProtkbId')
            if acc:
                return acc

            inactive = js.get('inactiveReason')
            if inactive:
                reason = inactive.get('inactiveReasonType')
                if reason == 'DEMERGED':
                    targets = inactive.get('mergeDemergeTo') or []
                    if targets:
                        new_acc = targets[0]
                        r2 = SESSION.get(
                            f'https://rest.uniprot.org/uniprotkb/{new_acc}',
                            headers={'Accept': 'application/json'},
                            timeout=20
                        )
                        if r2.ok:
                            return r2.json().get('uniProtkbId')
                elif reason == 'DELETED':
                    uni_parc_id = js.get('extraAttributes', {}).get('uniParcId')
                    if uni_parc_id:
                        r2 = SESSION.get(
                            f'https://rest.uniprot.org/uniparc/{uni_parc_id}',
                            headers={'Accept': 'application/json'},
                            timeout=20
                        )
                        if r2.ok:
                            up_json = r2.json()
                            xrefs = up_json.get('uniParcCrossReferences') or []
                            if xrefs:
                                return xrefs[0].get('id')
        except Exception:
            pass

    return None

# Function to download dbPTM data and extract files (TSVs)
def download_and_extract() -> List[Path]:
    DATA_DIR.mkdir(exist_ok=True)
    zips = []
    resp = SESSION.get(f'{BASE_URL}/download.php', timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')
    for a in soup.find_all('a', href=True):
        href = a['href']
        if 'experiment' in href and href.endswith('.zip'):
            url = f"{BASE_URL}/{href}"
            fn = DATA_DIR / url.split('/')[-1]
            if not fn.exists():
                with SESSION.get(url, stream=True, timeout=60) as r:
                    r.raise_for_status()
                    with open(fn, 'wb') as f:
                        for chunk in r.iter_content(1<<14):
                            if chunk: f.write(chunk)
            zips.append(fn)

    # extract all of the files and append the TSV files
    tsvs = []
    for z in zips:
        with zipfile.ZipFile(z, 'r') as zf:
            zf.extractall(DATA_DIR)
            for n in zf.namelist():
                if '.' not in n:
                    tsvs.append(DATA_DIR / n)
    return tsvs

# Load up PTM data
def load_ptm_file(path: Path) -> pd.DataFrame:
    df = pd.read_csv(
        path, sep='\t', header=None,
        names=['ProID','Acc#','ModSite','PTM','EvdId','Seq'],
        dtype={'ProID':str,'Acc#':str,'ModSite':int,'PTM':str,'EvdId':str,'Seq':str},
        na_values=['','NA','NaN']
    )
    return df

# Fill in missing sequences based on accession and modification site
def fill_windows(df: pd.DataFrame) -> pd.DataFrame:
    missing = df['Seq'].isna() | (df['Seq'].str.len() != 21)
    need = df.loc[missing, 'Acc#'].dropna().unique().tolist()

    acc2seq: Dict[str, Optional[str]] = {acc: resolve_sequence(acc) for acc in need}

    out = df.copy()
    rows = out.loc[missing]
    for idx, row in rows.iterrows():
        acc = row['Acc#']
        site = int(row['ModSite'])
        seq = acc2seq.get(acc)
        subseq = construct_subsequence(seq, site-1) if seq else None
        out.at[idx, 'Seq'] = subseq

    out = out[out['Seq'].notna() & (out['Seq'].str.len() == 21)]
    out['Seq'] = out['Seq'].str.upper()
    return out

# Compute the positional frequency matrices for each modification type
def compute_pfms(
    df: pd.DataFrame,
    methods: List[Literal['freq','log-e','log2','log10']] = ['freq']
) -> Dict[str, Dict[str, Dict[str, Dict[str, float]]]]:
    df = df.copy()
    df = df[df['Seq'].notna() & (df['Seq'].str.len() == 21)]
    counts: Dict[str, Dict[str, Dict[str, int]]] = defaultdict(
        lambda: {pos: {aa: 0 for aa in AA} for pos in POS}
    )

    for seq in df['Seq'].astype(str):
        mid = seq[10]
        if mid not in AA:
            continue
        for j, ch in enumerate(seq):
            if ch in AA:
                counts[mid][POS[j]][ch] += 1

    pfms: Dict[str, Dict[str, Dict[str, Dict[str, float]]]] = {m: {} for m in methods}
    pc = 0.5
    for mid, posmap in counts.items():
        freq_map: Dict[str, Dict[str, float]] = {}
        for pos, row in posmap.items():
            total = sum(row.values())
            denom = total + pc * len(AA)
            freq_map[pos] = {aa: (row[aa] + pc) / denom for aa in AA}
        if 'freq' in methods:
            pfms['freq'][mid] = freq_map
        for method in methods:
            if method == 'freq':
                continue
            trans = {}
            if method == 'log-e':
                for pos, row in freq_map.items():
                    trans[pos] = {aa: float(np.log(v)) for aa, v in row.items()}
            elif method == 'log2':
                for pos, row in freq_map.items():
                    trans[pos] = {aa: float(np.log2(v)) for aa, v in row.items()}
            elif method == 'log10':
                for pos, row in freq_map.items():
                    trans[pos] = {aa: float(np.log10(v)) for aa, v in row.items()}
            pfms[method][mid] = trans

    return pfms

# Fill out missing accessions based on protein identifiers
def fill_missing_accessions(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    mask = out['Acc#'].isna() | (out['Acc#'].astype(str).str.strip() == "")
    pro_ids = out.loc[mask, 'ProID'].dropna().unique().tolist()

    if not pro_ids:
        return out

    acc_map = {}
    for pid in pro_ids:
        acc = resolve_accession(pid)
        if acc:
            acc_map[pid] = acc

    for pid, acc in acc_map.items():
        out.loc[mask & (out['ProID'] == pid), 'Acc#'] = acc

    return out

# Fill out missing protein identifiers based on accessions
def fill_missing_protein_identifiers(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    mask = out['ProID'].isna() | (out['ProID'].astype(str).str.strip() == "")
    acc_nums = out.loc[mask, 'Acc#'].dropna().unique().tolist()

    if not acc_nums:
        return out

    id_map = {}
    for pid in acc_nums:
        acc = resolve_protein_identifier(pid)
        if acc:
            id_map[pid] = acc

    for pid, id_ in id_map.items():
        out.loc[mask & (out['Acc#'] == pid), 'ProID'] = id_

    return out

# Function to connect to MongoDB
def connect_mongo(uri="mongodb://localhost:27017", db_name="ptmkb"):
    client = MongoClient(uri, timeoutMS=120000)
    db = client[db_name]
    tables = db['tables']
    proteins = db['proteins']
    tables.create_index([('ptm', ASCENDING)], unique=True)
    proteins.create_index([('Protein Identifier', ASCENDING), ('Accession Number', ASCENDING)], unique=True)
    proteins.create_index([('Accession Number', ASCENDING)], unique=False)
    return tables, proteins

# Chunking helper function
def chunked(iterable, n):
    it = iter(iterable)
    while True:
        batch = list(islice(it, n))
        if not batch:
            return
        yield batch

# Function to insert all datai in one go. Done with chunking to prevent memory issues.
def write_all_in_one_go(db, stage_proteins_docs, stage_tables_docs,
                        protein_chunk=50_000, table_chunk=10_000):
    p_stage  = db['proteins_stage']
    t_stage  = db['tables_stage']

    # fresh staging
    p_stage.drop()
    t_stage.drop()

    # 1) insert_many into staging (chunked)
    if stage_proteins_docs:
        for batch in chunked(stage_proteins_docs, protein_chunk):
            p_stage.insert_many(batch, ordered=False)

    if stage_tables_docs:
        for batch in chunked(stage_tables_docs, table_chunk):
            t_stage.insert_many(batch, ordered=False)

    # 2) one $merge for proteins: union PTMs across existing + new
    db.command({
        "aggregate": "proteins_stage",
        "pipeline": [
            # normalize PTMs in staged docs (make sure array exists)
            {"$project": {
                "Protein Identifier": 1,
                "Accession Number": 1,
                "PTMs": {"$ifNull": ["$PTMs", []]}
            }},
            # ensure duplicates inside the staged doc are deduped
            {"$project": {
                "Protein Identifier": 1,
                "Accession Number": 1,
                "PTMs": {"$setUnion": ["$PTMs", []]}
            }},
            {"$merge": {
                "into": "proteins",
                "on": ["Protein Identifier", "Accession Number"],
                "whenMatched": [
                    {"$set": {
                        # $$ROOT is the current target doc; $$new is the staged doc
                        "PTMs": {"$setUnion": ["$$ROOT.PTMs", "$$new.PTMs"]}
                    }}
                ],
                "whenNotMatched": "insert"
            }}
        ],
        "cursor": {}
    })

    # 3) one $merge for tables: replace data by ptm
    db.command({
        "aggregate": "tables_stage",
        "pipeline": [
            {"$project": {"ptm": 1, "data": 1}},
            {"$merge": {
                "into": "tables",
                "on": "ptm",
                "whenMatched": "replace",
                "whenNotMatched": "insert"
            }}
        ],
        "cursor": {}
    })

    # optional cleanup
    p_stage.drop()
    t_stage.drop()

STATISTICS = {}
PROTEINS = set()

# Debug function
def analyze_df(df: pd.DataFrame, name: str):
    print(f"\tInformation on {name}")
    print(f"\t\t- Total rows: {len(df)}")
    print("\t\t- Total unique proteins:", df['ProID'].nunique())
    print("\t\t- Missing protein identifiers:", df['ProID'].isna().sum())
    print("\t\t- Missing accessions:", df['Acc#'].isna().sum())
    print("\t\t- Missing/uneven sequences:", ((df['Seq'].isna()) | (df['Seq'].str.len() != 21)).sum())
    PROTEINS.update(df['Acc#'].unique())
    STATISTICS[name] = {
        'total_rows': len(df),
        'unique_proteins': df['ProID'].nunique(),
        'missing_protein_ids': int(df['ProID'].isna().sum()),
        'missing_accessions': int(df['Acc#'].isna().sum()),
        'missing_or_uneven_sequences': int(((df['Seq'].isna()) | (df['Seq'].str.len() != 21)).sum())
    }
    return df['Acc#'].isna().sum(), df['ProID'].isna().sum(), ((df['Seq'].isna()) | (df['Seq'].str.len() != 21)).sum()

# Execute the data wrangling pipeline
def run_pipeline():
    print("Downloading files...")
    tsvs = download_and_extract()

    stage_proteins = {}
    stage_tables   = {}

    print(f"Processing following files:")
    [print('\t- '+i.name.split('/')[-1]) for i in tsvs]
    for p in tsvs:
        if not p.exists():
            continue
        print(80 * "-")
        print(f"Loading {p.name.split('/')[-1]}...")
        print(80 * "-")

        df = load_ptm_file(p)
        acc_num, pro_id_num, seq_num = analyze_df(df, p.stem)
        if acc_num:
            print("\tFilling missing accessions...")
            df = fill_missing_accessions(df)
        if pro_id_num:
            print("\tFilling missing protein identifiers...")
            df = fill_missing_protein_identifiers(df)
        if seq_num:
            print("\tFilling missing sequences...")
            df = fill_windows(df)

        # accumulate proteins (dedupe in memory)
        for (proid, acc), group in df[df['Acc#'].notna()].groupby(['ProID','Acc#']):
            key = (str(proid), str(acc))
            bucket = stage_proteins.setdefault(key, set())
            for _, r in group.iterrows():
                evids = "" if pd.isna(r['EvdId']) else str(r['EvdId'])
                # normalize evidence order so set semantics work
                if evids:
                    parts = sorted([s for s in evids.split(';') if s])
                    evids = ';'.join(parts)
                bucket.add((int(r['ModSite']), str(r['PTM']), evids))

        # accumulate tables (replace per-PTM)
        ptm_name = str(df['PTM'].iloc[0]) if len(df) else p.stem
        print("\tComputing positional frequency matrices...")
        pfm = compute_pfms(df, methods=['freq','log-e'])
        stage_tables[ptm_name] = pfm

        print("+-----+\n|Done!|\n+-----+\n")

    print("Connecting to MongoDB for storage...")
    client = MongoClient("mongodb://localhost:27017", timeoutMS=120000)
    db = client["ptmkb"]

    # ensure indexes once when creating the collections
    db['tables'].create_index([('ptm', ASCENDING)], unique=True)
    db['proteins'].create_index(
        [('Protein Identifier', ASCENDING), ('Accession Number', ASCENDING)],
        unique=True
    )
    db['proteins'].create_index([('Accession Number', ASCENDING)], unique=False)

    # convert accumulators into lists of docs for staging
    stage_proteins_docs = [{
        "Protein Identifier": k[0],
        "Accession Number": k[1],
        "PTMs": [list(t) for t in sorted(v)]
    } for k, v in stage_proteins.items()]

    stage_tables_docs = [{
        "ptm": ptm,
        "data": doc
    } for ptm, doc in stage_tables.items()]

    print(f"Staging {len(stage_proteins_docs)} proteins; {len(stage_tables_docs)} tables...")
    write_all_in_one_go(db, stage_proteins_docs, stage_tables_docs)
    STATISTICS['total_unique_proteins'] = len(PROTEINS)
    with open('processing_statistics.json', 'w') as f:
        json.dump(STATISTICS, f, indent=2)
    print("All done, statistics dumped in JSON file.")

if __name__ == "__main__":
    run_pipeline()