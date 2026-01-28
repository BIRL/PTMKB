import pandas as pd
import pymongo
import requests
import numpy as np
import os
from great_tables import GT, style, loc

if not os.path.exists("figures"):
    os.makedirs("figures")

# Accession numbers of sampled proteins
PHOSPHO_PROTEINS = ["P04637", "P00533", "P46527", "P40763", "P31749", "P49841", "P28482", "P05412", "P06493", "P35568"]
PHOSPHO_AMINO_ACIDS = ['S', 'T', 'Y']

# Get function name for table reference
def get_function(response: dict):
    return [i for i in response.get("comments", []) if i.get('commentType') == 'FUNCTION'][0].get('texts', [{}])[0].get('value').split('.')[0].split('(')[0].split(';')[0].strip()

# Get gene for table reference
def get_gene(response: dict):
    return (
        [i for i in response.get("genes", [{}])][0].get("geneName", {}).get("value", '')
        + ' ('
        + response.get("organism", {}).get("scientificName", '-')
        + ')'
    )

# If the sequence contains '-inf' values, we want to extract the longest contiguous segment centered around 0
# This is limited to 13 values for phosphorylation (carried out in additive_calculator)
def get_longest_centered_array(values: list[float | int | str], tol: float = 1e-5) -> list[float]:
    cleaned = [float(v) if v not in ('-inf', 'inf') else v for v in values]
    
    numeric_values = [v for v in cleaned if not isinstance(v, str)]
    if not numeric_values:
        raise ValueError("No numeric values found.")
    
    closest_idx = min(range(len(cleaned)), key=lambda i: abs(cleaned[i]) if not isinstance(cleaned[i], str) else float('inf'))
    
    left, right = closest_idx, closest_idx
    while left > 0 and cleaned[left - 1] != '-inf':
        left -= 1
    while right < len(cleaned) - 1 and cleaned[right + 1] != '-inf':
        right += 1
    
    return cleaned[left:right + 1]

# Calculate log sum for a given vector
def additive_calculator(vector: list[float | int | str]) -> float:
    additive_score = 0.0
    vector = get_longest_centered_array(vector)
    if len(vector) < 13:
        additive_score = '-INF'
    else:
        for value in vector:
            if isinstance(value, float | int):
                additive_score += value
    return additive_score

client = pymongo.MongoClient("mongodb://127.0.0.1:27017/")
col = client['ptmkb']['proteins']

RESULTS = []

# Helper function to load positional frequency matrices from MongoDB
# Ensure that you have the 'tables' collection populated in the 'ptmkb' database
# If not, please execute A1_Data_Processing_Pipeline.py first
def load_tables_from_mongo(
    mongo_uri: str = "mongodb://localhost:27017",
    db_name: str = "ptmkb",
    coll_name: str = "tables",
) -> dict:
    client = pymongo.MongoClient(mongo_uri)
    client["ptmkb"]["tables"].create_index([("ptm", pymongo.ASCENDING)], unique=True)
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

# Make a subsequence centered around the modification site
# Padding for edge cases
def construct_subsequence(protein: str, site0: int, flank: int = 10) -> str:
    start = max(0, site0 - flank)
    end = min(len(protein), site0 + flank + 1)
    subseq = protein[start:end]
    if site0 < flank:
        subseq = ('-' * (flank - site0)) + subseq
    if site0 + flank >= len(protein):  # fix: >=
        subseq += '-' * ((site0 + flank + 1) - len(protein))
    return subseq

if not os.path.exists("df.pkl"):
    TABLES = load_tables_from_mongo()

    # Use Uniprot REST API to fetch sequences and process on it
    for protein in PHOSPHO_PROTEINS:
        print("Handling", protein)
        protein_info = col.find_one({'Accession Number': protein}, {'_id': 0})
        request = requests.get(f"https://rest.uniprot.org/uniprotkb/{protein}")
        response = request.json()
        sequence = response.get('sequence', {}).get("value", "")
        print("Sequence found:", sequence)
        for index, residue in enumerate(sequence):
            if residue not in PHOSPHO_AMINO_ACIDS:
                continue
            
            subsequence = construct_subsequence(sequence, index)
            print(f"\tSubsequence found at pos {index+1}:", subsequence)

            center_idx = len(subsequence) // 2
            char = subsequence[center_idx].upper()
            # Ranges from -10 to +10, centered at 0
            keys = [f"+{i}" if i > 0 else str(i)
                for i in range(-center_idx, center_idx + 1)]
            table = TABLES.get("Phosphorylation", {}).get(residue, {}).get('log-e', {})
            vector = [
                table.get(key, {}).get(subsequence[idx], float('-inf'))
                for idx, key in enumerate(keys)
            ]

            log_sum = additive_calculator(vector)
            if isinstance(log_sum, str) and log_sum.upper() in {"-INF", "-INFINITY", "NEGATIVE_INFINITY"}:
                log_sum = float('-inf')

            # Compile result
            result = {
                "RANK": len(RESULTS) + 1,
                "PROTEIN": protein,
                "FUNCTION": get_function(response),
                "GENE": get_gene(response),
                "AA": residue,
                "LOGSUM": float(log_sum),
                "PTM": "Phosphorylation",
                "SITE": index+1,
                "SUBSEQUENCE": subsequence,
                "SEQUENCE": sequence,
                "EVIDENCES": ''
            }
            
            # If record in clean PTM data exists, appende evidences
            if any([(index + 1) == int(ptm[0]) and ptm[1] == 'Phosphorylation' for ptm in protein_info['PTMs']]):
                ptm = next(ptm for ptm in protein_info['PTMs'] if (index + 1) == int(ptm[0]) and ptm[1] == 'Phosphorylation')
                result["EVIDENCES"] = ', '.join([pubmed_id for pubmed_id in ptm[2].split(';')][:3])
            
            RESULTS.append(result)

    # Insert record in DataFrame
    df = pd.DataFrame(RESULTS, columns=[
        "RANK","PROTEIN","FUNCTION","GENE","AA","LOGSUM","PTM","SITE","SEQUENCE","EVIDENCES"
    ])

    df.to_pickle('df.pkl')
else:
    # To prevent re-computation, load existing DataFrame
    print("Reading existing DF")
    df = pd.read_pickle('df.pkl')

# Function designed to make table using great-tables
def top10_logsum_table_gtbl(df, protein="P04637", ptm="Phosphorylation", gene_name="", function_desc="", save_path=None):
    mask = (df["PROTEIN"] == protein) & (df["PTM"] == ptm)
    df_filtered = df.loc[mask].copy()
    if df_filtered.empty:
        raise ValueError(f"No rows found for {protein} / {ptm}")

    df_filtered["LOGSUM"] = df_filtered["LOGSUM"].replace(-999.0, np.nan)
    df_filtered = df_filtered.dropna(subset=["LOGSUM"])

    df_sorted = df_filtered.sort_values("LOGSUM", ascending=False).head(10).copy()
    df_sorted.insert(0, "Rank", range(1, len(df_sorted) + 1))

    columns_to_keep = ["Rank", "FUNCTION", "GENE", "SITE", "AA", "LOGSUM", "EVIDENCES"]
    for col in columns_to_keep:
        if col not in df_sorted.columns:
            df_sorted[col] = None
    df_table: pd.DataFrame = df_sorted[columns_to_keep].rename(columns={"SITE": "Position", "AA": "Site"})
    df_table["LOGSUM"] = df_table["LOGSUM"].map(lambda x: f"{x:.3f}")

    title = f"Top 10 LOGSUM scores for {protein}"
    if gene_name:
        title += f" | Gene: {gene_name}"
    if function_desc:
        title += f" | Function: {function_desc}"

    gt = (
        GT(df_table.drop(columns=['FUNCTION', 'GENE']))
        .tab_header(
            title=f"Top 10 LOGSUM scores for {protein} — {df_table['GENE'].values.tolist()[0]}",
            subtitle="Role: " + df_table['FUNCTION'].values.tolist()[0],
        )
        .tab_style(
            style=[style.borders(sides=["all"], color="gray", weight="2px", style="solid"), style.css('padding-top: -2px; padding-bottom: -2px;')],
            locations=loc.body(columns=["Rank", "Position", "Site", "LOGSUM", "EVIDENCES"])
        )
        .tab_source_note(
            source_note=f"Sequence fetched from Uniprot (https://uniprot.org/uniprot/{protein})"
        )
        .tab_options(
            table_width='600px',
        )
        .cols_align(
            align='center',
        )
        .cols_align(
            align='right',
            columns=['Rank']
        )
        .cols_align(
            align='left',
            columns=['EVIDENCES']
        )
    )

    # Print table to stdout or save to file
    if save_path:
        gt.save(f"{save_path}.png", scale=4.0)
        print(f"Table saved to {save_path}")
    else:
        print(gt)

    return df_table

# Compute and save tables for each protein
for protein in PHOSPHO_PROTEINS:
    top10_logsum_table_gtbl(df, protein=protein, save_path=f"figures/{protein}")