import sys

sys.dont_write_bytecode = True

from fastapi import FastAPI, Request, Body, Query, Depends, HTTPException
from fastapi.responses import ORJSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import io
import os

from mongo_users import set_token, user_exists, create_user, get_access_token, validate_password
from mongo_ptm import fetch_identifiers, search_identifier
from calculator import additive_calculator, multiplicative_calculator
from response_fetcher import fetch_response_uniprot_trim
from jpred_prediction import submit_job, get_job
from mdtraj_calculations import (
    create_file,
    get_secondary_structure,
    get_solvent_accessible_surface_area,
    get_protein_sequence
)
from constants import PTM_TABLES, RESID_DATABASE
import random

######## TOKEN STUFF ########

import time
import jwt

JWT_SECRET = 'what_are_you_looking_here_for'
JWT_ALGORITHM = 'HS256'

# Give the user a new token
def sign_jwt(user_id: str) -> dict[str, str]:
    payload = {
        '_id_': random.randint(1, 10000000000),
        "username": user_id,
        "expires": time.time() + 432000 # Valid for 5 days
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return {"access_token": token}

# Decode the token by the user
def decode_jwt(token: str) -> dict | None:
    try:
        decoded_token: dict = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        decoded_token['expired'] = False
        if decoded_token["expires"] < time.time():
            decoded_token['expired'] = True
        return decoded_token
    except:
        return None

class JWTBearer(HTTPBearer):
    def __init__(self, auto_error: bool = True):
        super(JWTBearer, self).__init__(auto_error=auto_error)

    async def __call__(self, request: Request):
        credentials: HTTPAuthorizationCredentials = await super(JWTBearer, self).__call__(request)
        if not credentials or credentials.scheme != "Bearer":
                raise HTTPException(status_code=403, detail="Invalid authentication scheme.")
        
        presented_token = credentials.credentials
        validity = decode_jwt(presented_token)
        if not validity:
            raise HTTPException(status_code=403, detail="Invalid token.")
        
        username = validity.get('username')
        if validity.get('expired'):
            # ensure the expired token is the *current* stored one
            stored = await get_access_token(username)
            if stored is None or stored != presented_token:
                raise HTTPException(status_code=403, detail="Expired token - please use your current one!")

            # rotate token and persist
            new_token = sign_jwt(username)
            await set_token(username, new_token)

            raise HTTPException(
                status_code=403,
                detail=f"Automatically reset token! Here: {new_token.get('access_token')}"
            )

        return presented_token

    def verify_jwt(self, jwtoken: str) -> bool:
        isTokenValid: bool = False

        try:
            payload = decode_jwt(jwtoken)
        except:
            payload = None
        if payload:
            isTokenValid = True

        return isTokenValid
    

######## DEFINE PAGES ONLY ACCESSIBLE THROUGH BROWSERS ########


BROWSER_USER_AGENTS = [
    "Mozilla",
    "Chrome",
    "Firefox",
    "Safari",
    "Edge",
]


def is_browser(user_agent: str) -> bool:
    return any(browser in user_agent for browser in BROWSER_USER_AGENTS)


######## LOGIN AND SIGNUP PURPOSES ########


app = FastAPI(
    docs_url=None,
    redoc_url=None,
    title="PTMKB",
    version="1.0.0",
    swagger_ui_oauth2_redirect_url=None,
    redirect_slashes=False,
)

@app.post('/ptmkb/check_existing_user', include_in_schema=False)
async def check_for_existing_user(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    info: dict = await request.json()
    username = info.get('username')
    exists = await user_exists(username)
    return ORJSONResponse({'exists': exists})

@app.post('/ptmkb/registration', include_in_schema=False)
async def register(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    try:
        info = await request.json()
        username = info.get('username')
        password = info.get('password')
        ok = await create_user(username, password, sign_jwt(username))
        return ORJSONResponse({'registered': ok})
    except:
        return ORJSONResponse({'registered': False})

@app.post('/ptmkb/reset_token', include_in_schema=False)
async def reset_token(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    try:
        info: dict = await request.json()
        username = info.get('username')
        new_token = sign_jwt(username)
        ok = await set_token(username, new_token)
        return ORJSONResponse({
            'reset': ok,
            'token': new_token.get('access_token')
        })
    except:
        return {'reset': False}

@app.post('/ptmkb/fetch_token', include_in_schema=False)
async def fetch_token(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    info: dict = await request.json()
    username = info.get('username')
    access_token = await get_access_token(username)
    return ORJSONResponse({'token': access_token})

@app.post('/ptmkb/login', include_in_schema=False)
async def attempt_login(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    info: dict = await request.json()
    username = info.get('username')
    password = info.get('password')
    if await user_exists(username):
        if await validate_password(username, password):
            token = await get_access_token(username)
            if token is None:
                new_token = sign_jwt(username)
                await set_token(username, new_token)
                token = new_token.get('access_token')
            return ORJSONResponse({'verify': True, 'message': '', 'info': {'username': username, 'token': token}})
        return ORJSONResponse({'verify': False, 'message': "Your password is invalid."})

    return ORJSONResponse({'verify': False, 'message': f"No user by the name of {username} exists."})

@app.post('/ptmkb/logout', include_in_schema=False)
async def logout(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    try:
        info: dict = await request.json()
        username = info.pop('username')
        return ORJSONResponse({'logout': True})
    except:
        return ORJSONResponse({'logout': False})


######## ########


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "your_secret_key"  
ALGORITHM = "HS256" 
ACCESS_TOKEN_EXPIRE_MINUTES = 30

templates = Jinja2Templates(directory='templates/')
app.mount('/static', StaticFiles(directory="static"), name="static")

######## CUSTOM FUNCTION FOR SORTING ########

def sort_ids(strings: list[str], substring: str):
    def similarity_score(s: str):
        if substring in s:
            try:
                return (0, s.index(substring))
            except AttributeError:
                return (0, -1)
        else:
            return (1, 0)
    return sorted(strings, key=similarity_score)

######## PAGES ########

@app.get('/favicon.ico', include_in_schema=False)
async def favicon(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return FileResponse('./icon-ptmkb.ico')

@app.get('/download_script', include_in_schema=False)
async def get_started_script(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return FileResponse('./ptmkb_get_started.py')

@app.get('/font', include_in_schema=False)
async def picture(request: Request, font: str):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return FileResponse(f'./data/fonts/{font}.ttf')


@app.get('/picture', include_in_schema=False)
async def picture(request: Request, picture: str):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return FileResponse(f'./images/{picture}')

@app.get("/", include_in_schema=False)
def home_page(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return templates.TemplateResponse(
        "index.html", context={"request": request}
    )

@app.get("/search", include_in_schema=False)
def home_page(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return templates.TemplateResponse(
        "search.html", context={"request": request}
    )

@app.get("/signup-login", include_in_schema=False)
def home_page(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return templates.TemplateResponse(
        "signin_signup.html", context={"request": request}
    )

@app.get("/propensity", include_in_schema=False)
def docs_page(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return templates.TemplateResponse(
        "propensity.html", context={"request": request}
    )

@app.get("/documentation", include_in_schema=False)
def docs_page(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return templates.TemplateResponse(
        "docs.html", context={"request": request}
    )

@app.get("/download", include_in_schema=False)
def download_page(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return templates.TemplateResponse(
        "download.html", context={"request": request}
    )

@app.get("/integration", include_in_schema=False)
def integration_page(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return templates.TemplateResponse(
        "integration.html", context={"request": request}
    )

@app.get("/about", include_in_schema=False)
def integration_page(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return templates.TemplateResponse(
        "about.html", context={"request": request}
    )

######## PAGE REQUESTS ########

@app.get('/ptmkb/protein_autofill', include_in_schema=False)
async def search(_id: str, request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    # Probably best to insert elements in a database
    ids = await fetch_identifiers(_id)
    ids = sort_ids(ids, _id)
    # Give only top 200 suggestions - otherwise burden on user
    return ORJSONResponse({'ids': ids[:200]})


# We're just going to load the HTML file here to include in the iframe.
# This information is required by an endpoint. Why I've turned it into a file,
# even I'm not sure.
# This is only read once so it doesn't waste I/O operations during use
with open('./templates/protein.html', 'r', encoding='utf-8') as f:
    HTML_PAGE = f.read()

@app.post('/ptmkb/search_result', include_in_schema=False)
async def search(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    data = await request.json()
    data['id'] = data['id'].strip()
    
    found, results = await search_identifier(data['id'])
    # Stupid check, I am aware
    try:
        results = results[0]
    except IndexError:
        ...
    if found:
        if not isinstance(results['Accession Number'], str):
            results['Accession Number'] = ''
    return ORJSONResponse({
        'found': found,
        'result': results,
        'html': HTML_PAGE
    })

@app.post('/ptmkb/structure_calculations', include_in_schema=False)
async def get_structure_calculations(request: Request, data: dict = Body(...)):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    raw_bytes = data.get('raw_pdb_data', None)
    if data is None:
        return ORJSONResponse({'message': "Please submit a PDB file in bytes."})
    traj = create_file(raw_bytes.encode('utf-8'))
    response = dict()
    ss = get_secondary_structure(traj)
    sasa = get_solvent_accessible_surface_area(traj, 'residue')
    response.update(ss)
    response.update(sasa)
    response.update({
        'sequence': get_protein_sequence(traj)
    })
    return ORJSONResponse(response)


# I look at this function and cry every single night.
# This was the best I could do given the time constraint
# and my inability to do good frontend programming at all. 
@app.post('/ptmkb/fetch_uniprot', include_in_schema=False)
async def get_uniprot_info(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    data = await request.json()
    prot_id: str = data['id']
    # The dataset's protein identifiers all have an underscore
    # That's how we differentiate from accession numbers
    # This is necessary for web scraping purposes
    # OR we can just use the REST API to fetch the necessary information
    # without worrying about the type of ID
    return_response = await fetch_response_uniprot_trim(prot_id)

    return ORJSONResponse(return_response)

def save_image(df: pd.DataFrame, format: str, ptm: str) -> bytes:
    # --- 1) Make sure columns = positions (top), rows = amino acids (side)
    cols_str = list(map(str, df.columns))
    idx_str  = list(map(str, df.index))
    # If '0' (the modification site) is found in the index but not the columns,
    # this likely means positions are on the index -> transpose for display.
    if ('0' in idx_str) and ('0' not in cols_str):
        df = df.T

    # --- 2) String-format all visible values to 2 decimals
    def fmt(x):
        if pd.isna(x):
            return ""
        if isinstance(x, (int, float, np.floating)):
            return f"{x:.2f}"
        return str(x)

    df_fmt = df.applymap(fmt)
    col_labels = [str(c) for c in df_fmt.columns]
    row_labels = [str(r) for r in df_fmt.index]

    # --- 3) Build figure and leave room for the y-axis label
    fig, ax = plt.subplots(figsize=(12, 8))
    # extra left/top space for labels so they don't overlap
    fig.subplots_adjust(left=0.18, right=0.98, top=0.88, bottom=0.12)
    ax.axis('off')

    table = ax.table(
        cellText=df_fmt.values,
        colLabels=col_labels,
        rowLabels=row_labels,
        cellLoc='center',
        loc='center'
    )

    # Optional: improve readability of text size/spacing
    table.auto_set_font_size(False)
    table.set_fontsize(8)
    table.scale(1.0, 1.2)

    # --- 4) Color headers, row labels, site column
    # locate site column (label '0' in the header row)
    site_idx = None
    for (i, j), cell in table.get_celld().items():
        if i == 0 and j >= 0 and cell.get_text().get_text() == '0':
            site_idx = j
            break

    for (i, j), cell in table.get_celld().items():
        if j == -1:  # row labels (amino acids)
            cell.set_facecolor('#D0E0E3')
        elif j >= 0:
            if i == 0:  # header row (positions)
                cell.set_facecolor('#A0C4FF')
            else:
                if site_idx is not None and j == site_idx:
                    cell.set_facecolor("#F2C998")
                else:
                    cell.set_facecolor('#E0E0E0' if i % 2 == 0 else '#FFFFFF')

    # --- 5) Titles/axis labels (placed on the figure so they don't collide)
    ax.set_title("Log-Odd values for " + ptm)
    fig.text(0.06, 0.50, "Amino Acid", rotation=90, va='center', ha='center')
    fig.text(0.50, 0.93, "Position Relative to Modification Site", ha='center', va='center')

    # --- 6) Save to bytes (no temp files)
    buf = io.BytesIO()
    plt.savefig(buf, format=format.lower(), dpi=300)
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()

def save_data(df: pd.DataFrame, format: str) -> bytes:
    if format == "CSV":
        # Simple fix for CSV
        df = df.astype(str)
        df.to_csv(f'./temp.csv')
    elif format == "JSON":
        df.to_json('./temp.json')
    with open(f'./temp.{format.lower()}', 'rb') as f:
        raw_data = f.read()
    os.remove(f'./temp.{format.lower()}')
    return raw_data

@app.post('/ptmkb/download', include_in_schema=False)
async def download(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    data: dict = await request.json()

    return_header = {
        "CSV": 'text/csv',
        "PNG": 'image/png',
        "PDF": 'application/pdf',
        "SVG": 'image/svg+xml',
        "JSON": 'application/json'
    }
    
    ptm = data.get("ptm")
    aa = data.get('aa')
    table = data.get('table')
    format = data.get("format")
    rounded = True # data.get('rounded')

    data = PTM_TABLES.get(ptm, {}).get(aa, {}).get(table, {})
    df = pd.DataFrame.from_dict(data, orient="index")
    
    if rounded and format in ["PNG", "PDF", "SVG"]: df = df.round(2)
    
    # Check format
    raw_data = save_image(df, format, ptm) if format in ["PNG", "PDF", "SVG"] else save_data(df, format)

    return Response(
        content=raw_data,
        media_type=return_header[format]
    )

# This function is a separate call
@app.post('/ptmkb/get_protein_log', include_in_schema=False)
async def get_log_value(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    data: dict = await request.json()
    data = dict(sorted(data.items(), key=lambda item: int(item[0])))
    vector = list(data.values())
    # Use the above vector to calculate additive and multiplicative scores
    a_score, m_scores = additive_calculator(vector), multiplicative_calculator(vector)
    asterisk_m_score = m_scores[1]['logLogProduct']
    return ORJSONResponse({
        'logSum': round(a_score, 3) if not isinstance(a_score, str) else a_score,
        'logLogProduct': round(asterisk_m_score, 3) if not isinstance(asterisk_m_score, str) else asterisk_m_score
    })

@app.get('/ptmkb/getAminoAcids', include_in_schema=False)
async def get_amino_acids(request: Request, ptm: str):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")

    if not ptm:
        return ORJSONResponse({
            'response': False,
            'message': "No PTM was provided."
        })

    ptm_data = PTM_TABLES.get(ptm)
    if not ptm_data:
        return ORJSONResponse({
            'response': False,
            'message': f"No such PTM: {ptm}"
        })

    data = list(ptm_data.keys())
    return ORJSONResponse({
        'response': True,
        'data': data
    })

@app.get('/ptmkb/getPTM', include_in_schema=False)
async def get_ptm_details(request: Request, resid: str = None, ptm: str = None, aa: str = None):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    # Check whether RESID ID or both PTM and Residue are given.
    # Both will be handled differently.
    entry = None
    if resid:
        resid = resid.upper()
        entry = [entry for entry in RESID_DATABASE if entry['@id'] == resid]
        # If caught entry,
        if entry:
            _id = entry[0]['@id']
            # going to send image and model files as raw data.
            with open(
                f"./data/resid/images/{_id}.GIF", 'rb'
            ) as f:
                entry[0]['Image'] = {}
                entry[0]['Image']['Data'] = f.read().decode('latin-1')
                entry[0]['Image']['Encoding'] = 'latin-1'
                entry[0]['Image']['FileType'] = '.GIF'
            with open(
                f"./data/resid/models/{_id}.PDB", 'rb'
            ) as f:
                entry[0]['Model'] = {}
                entry[0]['Model']['Data'] = f.read().decode()
                entry[0]['Model']['Encoding'] = 'utf-8'
                entry[0]['Model']['FileType'] = '.PDB'

    elif (ptm and aa):
        aa = aa.upper()
        entry = [
            entry for entry in RESID_DATABASE
            if entry.get('PTM', None) == ptm and (
                (
                    isinstance(entry.get('AminoAcid', None), str) and
                    entry.get('AminoAcid', None) == aa
                ) or
                (
                    isinstance(entry.get('AminoAcid', None), list) and
                    aa in entry.get('AminoAcid', None)
                )
            )
        ]
        if entry:
            for i in range(len(entry)):
                _id = entry[i]['@id']
                # going to send image and model files as raw data.
                with open(
                    f"./data/resid/images/{_id}.GIF", 'rb'
                ) as f:
                    entry[i]['Image'] = {}
                    entry[i]['Image']['Data'] = f.read().decode('latin-1')
                    entry[i]['Image']['Encoding'] = 'latin-1'
                    entry[i]['Image']['FileType'] = '.GIF'
                with open(
                    f"./data/resid/models/{_id}.PDB", 'rb'
                ) as f:
                    entry[i]['Model'] = {}
                    entry[i]['Model']['Data'] = f.read().decode()
                    entry[i]['Model']['Encoding'] = 'utf-8'
                    entry[i]['Model']['FileType'] = '.PDB'
    else:
        return ORJSONResponse({'message': "Please enter either a RESID ID or a PTM name along with a residue!"})

    return ORJSONResponse({'response': entry})


######## Non-API CALLS ########

@app.post('/ptmkb/unrel/submitJpred', include_in_schema=False)
async def get_jpred_prediction(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    info = await request.json()
    return await submit_job(info['sequence'])

@app.get('/ptmkb/unrel/getJpred', include_in_schema=False)
async def get_jpred_prediction_status(request: Request, jobid: str):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return await get_job(jobid)

@app.get('/ptmkb/ptms_list', include_in_schema=False)
async def get_ptms(request: Request):
    user_agent = request.headers.get('user-agent', '')
    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")

    return ORJSONResponse({'ptms': list(PTM_TABLES.keys())})

@app.get('/ptmkb/all_ptms_tables', include_in_schema=False)
def get_all_ptms_tables(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return ORJSONResponse(PTM_TABLES)

@app.get('/ptmkb/pos_matrix', include_in_schema=False)
def get_matrix(
    request: Request,
    ptm: str = Query(''),
    residue: str = Query(''),
    table: str = Query('log-e')
):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    residue = residue.upper()
    if not ptm:
        return {'message': "Please provide a Post Translational Modification as value."}
    if not residue:
        return {'message': "Please provide a residue for which you want the positional matrix."}
    if table not in ['log-e', 'freq']:
        table = 'log-e'
    
    ptm_data = PTM_TABLES.get(ptm)
    if not ptm_data:
        return {'message': f"No such PTM: {ptm}"}
    residue_data = ptm_data.get(residue)
    if not residue_data:
        return {'message': f"No data available for residue {residue} in {ptm}."}
    matrix = residue_data.get(table)
    if matrix is None:
        return {'message': f"Could not find the {table} matrix for {ptm} residue {residue}."}
    
    return ORJSONResponse(matrix)

@app.get('/ptmkb/get_protein_log_scores', include_in_schema=False)
async def calculate_propensity(
    request: Request,
    ptm: str = Query(''),
    subsequence: str = Query('')
) -> dict:
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    if ptm == '' and subsequence == '':
        return {
            'message': "Please provide both the subsequence and the PTM to use for Propensity calculation."
        }
    if ptm == '':
        return {
            'message': "Please provide the PTM to use for Propensity calculation."
        }
    if subsequence == '':
        return {
            'message': "Please provide a subsequence to use for Propensity calculation."
        }
    if not isinstance(ptm, str):
        return {
            'message': "Please ensure that the Post-Translational Modification input is a string."
        }
    if not isinstance(subsequence, str):
        return {
            'message': "Please ensure that the Subsequence input is a string."
        }
    if len(subsequence) < 13 or len(subsequence) > 21:
        return {
            'message': f"Please ensure that the length of the subsequence is at leats 13 residues long."
        }
    if len(subsequence) % 2 != 1:
        return {
            'message': f"Please ensure that the window size of the subsequence is either 13, 15, 17, 19, or 21 (current length is {len(subsequence)})."
        }

    char = subsequence[len(subsequence) // 2]

    # --- PTM existence check ---
    if ptm not in PTM_TABLES:
        return {'message': f"No such Post-Translational Modification: {ptm}"}
    if char not in PTM_TABLES[ptm]:
        return {'message': f"No propensity calculator for {ptm} residue {char}."}
    
    table: dict[str, dict[str, float | str]] = PTM_TABLES[ptm][char]['log-e']

    keys = [
        f"+{i}" if i > 0 else str(i)
        for i in range(-(len(subsequence)//2), (len(subsequence)//2)+1)
    ]

    vector = [
        table.get(key, {}).get(subsequence[idx], '-inf')
        for idx, key in enumerate(keys)
    ]

    response = {'logSum': additive_calculator(vector)}
    mult_score = multiplicative_calculator(vector)[1]
    response.update({
        'logLogProduct': mult_score.get('logLogProduct', 'NIL')
    })
    return ORJSONResponse(response)

######## API CALLS ########

@app.get('/ptmkb/api/get-ptm-details', dependencies=[Depends(JWTBearer())], responses={
    200: {
        "description": "Success",
        "content": {
            "application/json": {
                "example": {
                    'resid': {
                        "@id": 'string',
                        "PTM": 'string',
                        "AminoAcid": 'string',
                        "Header": {
                            "Code": 'string',
                            "Dates": {
                                "CreationDate": 'string',
                                "StrucRevDate": 'string',
                                "TextChngDate": 'string'
                            }
                        },
                        "Names": {
                            "Name": 'string',
                            "AlternateName": [
                                'string'
                            ],
                            "SystematicName": 'string',
                            "Xref": [
                                'string'
                            ]
                        },
                        "FormulaBlock": {
                            "Formula": 'string',
                            "Weight": [
                                {
                                    "@type": 'string',
                                    "#text": 'string'
                                }
                            ]
                        },
                        "CorrectionBlock": {
                            "@uids": 'string',
                            "Formula": 'string',
                            "Weight": [
                                {
                                    "@type": 'string',
                                    "#text": 'string'
                                }
                            ]
                        },
                        "ReferenceBlock": [
                            {
                                "Authors": {
                                    "Author": [
                                        'string'
                                    ]
                                },
                                "Citation": 'string',
                                "Title": 'string',
                                "Xref": [
                                    'string'
                                ],
                                "Note": 'string'
                            },
                        ],
                        "GeneratingEnzyme": {
                            "EnzymeName": 'string'
                        },
                        "SequenceCode": {
                            "SequenceSpec": 'string',
                            "Xref": [
                                'string'
                            ]
                        },
                        "Source": 'string',
                        "Keywords": {
                            "Keyword": 'string'
                        },
                        "Features": {
                            "Feature": {
                                "@type": 'string',
                                "@key": 'string',
                                "#text": 'string'
                            }
                        },
                        "Image": {
                            "Data": 'string',
                            "Encoding": 'string',
                            "FileType": 'string'
                        },
                        "Model": {
                            "Data": 'string',
                            "Encoding": 'string',
                            "FileType": 'string'
                        }
                    }
                }
            }
        }
    }
})
def get_post_translational_modification_details(
    request: Request,
    resid: str = Query('', description='The RESID Database ID to use.', example='AA0039')
):
    """
    Get information on a Post-Translational Modification using RESID ID.

    **Returns:**
    - Detailed information on a Post-Translational Modification. (type: *JSON*)
    """

    # Let's do some input validation first.
    resid = resid.upper().strip() # And that's about it.

    entry = [i for i in RESID_DATABASE if i.get('@id', '') == resid]

    # We also have to include raw bytes of PDB and image
    for i in range(len(entry)):
        _id = entry[i]["@id"]
        with open(
            f"./data/resid/images/{_id}.GIF", 'rb'
        ) as f1, open(
            f"./data/resid/models/{_id}.PDB", 'rb'
        ) as f2:
            entry[i]['Image'] = {
                "Data": f1.read().decode('latin-1'),
                "Encoding": "latin-1",
                "FileType": ".GIF"
            }
            entry[i]['Model'] = {
                "Data": f2.read().decode(),
                "Encoding": "utf-8",
                "FileType": ".PDB"
            }
    if entry:
        return ORJSONResponse({resid: entry[0]})
    return {'message': 'Please provide a valid RESID Database ID.'}


@app.get("/ptmkb/api/get-protein-details", dependencies=[Depends(JWTBearer())], responses={
    200: {
        "description": "Success",
        "content": {
            "application/json": {
                "example": {
                    "result": [
                        {
                            "Protein Identifier": 'string',
                            "Accession Number": 'string',
                            "PTMs": [
                                [
                                    'int',
                                    'string',
                                    'string'
                                ]
                            ]
                        }
                    ]
                }
            }
        }
    }
})
async def get_protein_details(
    upid: str = Query(None, description='UniProt Protein Identifier', example='AF9_HUMAN'),
    upac: str = Query(None, description='UniProt Accession Number', example='O14746')
):
    """
    Get the details of a protein and its Post-Translational Modifications (PTMs),
    given a UniProt Protein Identifier or Accession Number.

    *Note that if both parameters are supplied, the UniProt Protein Identifier will take precedence over the Accession Number.*

    **Returns:**
    - Detailed Post-Translational Modification details of a protein. (type: *JSON*)
    """

    if not upid and not upac:
        return {'result': '', 'message': 'Please enter a protein identifier or an accession number first!'}
    _id = upid or upac
    _id = _id.upper()
    found, results = await search_identifier(_id)
    if found:
        return ORJSONResponse({'result': results})
    return {'message': 'Could not find the queried protein!'}

@app.get("/ptmkb/api/get-available-ptms", dependencies=[Depends(JWTBearer())], responses={
    200: {
        "description": "Success",
        "content": {
            "application/json": {
                "example": {
                    "ptms": [
                        'string'
                    ]
                }
            }
        }
    }
})
async def get_available_post_translational_modifications():
    """
    Get a list of available Post-Translational Modifications (PTMs) in the database.

    **Returns:**
    - A list of available PTMs paired with a key. (type: *JSON*)
    """
    return {"ptms": list(PTM_TABLES.keys())}

@app.get("/ptmkb/api/get-positional-frequency-matrix", dependencies=[Depends(JWTBearer())], responses={
    200: {
        "description": "Success",
        "content": {
            "application/json": {
                "example": {
                    "-10": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "-9": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "-8": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "-7": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "-6": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "-5": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "-4": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "-3": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "-2": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "-1": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "0": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "+1": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "+2": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "+3": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "+4": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "+5": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "+6": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "+7": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "+8": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "+9": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    },
                    "+10": {
                        "A": 'float',
                        "C": 'float',
                        "D": 'float',
                        "E": 'float',
                        "F": 'float',
                        "G": 'float',
                        "H": 'float',
                        "I": 'float',
                        "K": 'float',
                        "L": 'float',
                        "M": 'float',
                        "N": 'float',
                        "P": 'float',
                        "Q": 'float',
                        "R": 'float',
                        "S": 'float',
                        "T": 'float',
                        "V": 'float',
                        "W": 'float',
                        "Y": 'float'
                    }
                }
            }
        },
    }
})
async def get_positional_frequency_matrix(
    ptm: str = Query('', description='The dbPTM-annotated Post-Translational Modification.', example='Phosphorylation'),
    residue: str = Query('', description='The amino acid for which the table is required.', example='S'),
    table: str = Query('log-e', description="The type of matrix required. Accepted values are 'freq' and 'log-e'.", example='freq')
):
    """
    Get the positional frequency matrix of a Post-Translational Modification (PTM),
    given the PTM, amino acid, and the matrix table type.

    If nothing is provided, all available positional matrices for all PTMs on all residues will be supplied.
    If only the PTM is provided, all available positional matrices for that PTM on all residues will be supplied.
    If the table is invalid, it defaults to 'log-e'.
    """
    # normalize inputs
    ptm = ptm.strip()
    residue = (residue or '').strip().upper()
    table = table if table in ['freq', 'log-e'] else 'log-e'

    # convenience alias
    tables = PTM_TABLES  # already in memory

    # 1) nothing provided -> everything (filtered to the requested table)
    if not ptm and not residue:
        if not tables:
            return {'message': 'No PTM tables are loaded.'}
        result = {
            ptm_name: {
                aa: aa_maps.get(table, {}) for aa, aa_maps in aa_dict.items()
            }
            for ptm_name, aa_dict in tables.items()
        }
        return ORJSONResponse(result)

    # 2) only PTM provided -> all residues for that PTM
    if ptm and not residue:
        ptm_map = tables.get(ptm)
        if not ptm_map:
            return {'message': f"Unknown PTM '{ptm}'."}
        result = {aa: aa_maps.get(table, {}) for aa, aa_maps in ptm_map.items()}
        return ORJSONResponse(result)

    # 3) PTM + residue provided -> single matrix
    if ptm and residue:
        ptm_map = tables.get(ptm)
        if not ptm_map:
            return {'message': f"Unknown PTM '{ptm}'."}
        aa_map = ptm_map.get(residue)
        if not aa_map:
            return {'message': f"No data for PTM '{ptm}' on residue '{residue}'."}
        matrix = aa_map.get(table)
        if matrix is None:
            return {'message': f"No '{table}' matrix for PTM '{ptm}' on residue '{residue}'."}
        return ORJSONResponse(matrix)

    # 4) residue without PTM (not covered by your docstring) -> guide the user
    return {'message': "Please provide a PTM (optionally with a residue) or provide nothing to retrieve all matrices."}

@app.get('/ptmkb/api/calculate-propensity', dependencies=[Depends(JWTBearer())], responses={
    200: {
        "description": "Success",
        "content": {
            "application/json": {
                "example": {
                    "logSum": 'float',
                    "logLogProduct": 'float'
                }
            }
        },
    }
})
async def calculate_propensity(
    ptm: str = Query('', description='The dbPTM-annotated Post-Translational Modification.', example='Phosphorylation'),
    subsequence: str = Query('', description='The subsequence to use for calculation. The PTM site will be automatically derived from the sequence.', example='WKLLPENNVLSPLPSQAMDDW')
) -> dict:
    """
    Calculate the Propensity of a residue for a Post-Translational Modification.

    **Returns:**
    - The Log Sum and Log Log Product scores. (type: *JSON*)
    """
    # input validation
    if ptm == '' and subsequence == '':
        return {'message': "Please provide both the subsequence and the PTM to use for Propensity calculation."}
    if ptm == '':
        return {'message': "Please provide the PTM to use for Propensity calculation."}
    if subsequence == '':
        return {'message': "Please provide a subsequence to use for Propensity calculation."}
    if not isinstance(ptm, str):
        return {'message': "Please ensure that the Post-Translational Modification input is a string."}
    if not isinstance(subsequence, str):
        return {'message': "Please ensure that the Subsequence input is a string."}
    if len(subsequence) < 13 or len(subsequence) > 21:
        return {'message': "Please ensure that the length of the subsequence is at leats 13 residues long."}
    if len(subsequence) % 2 != 1:
        return {'message': f"Please ensure that the window size of the subsequence is either 13, 15, 17, 19, or 21 (current length is {len(subsequence)})."}

    # obtaining central residue
    center_idx = len(subsequence) // 2
    char = subsequence[center_idx].upper()

    if ptm not in PTM_TABLES:
        return {'message': f"No such Post-Translational Modification by the name of {ptm} exists."}
    if char not in PTM_TABLES[ptm]:
        return {'message': f"No such propensity calculator exists for {ptm} of residue {char}."}

    table: dict[str, dict[str, float | str]] = PTM_TABLES[ptm][char].get('log-e', {})
    if not table:
        return {'message': f"No such propensity calculator exists for {ptm} of residue {char}."}

    keys = [f"+{i}" if i > 0 else str(i)
        for i in range(-center_idx, center_idx + 1)]

    # Build vector of log-e values (or '-inf' for missing symbols)
    vector = [
        table.get(key, {}).get(subsequence[idx], '-inf')
        for idx, key in enumerate(keys)
    ]

    # Scores
    response = {'logSum': additive_calculator(vector)}
    mult_score = multiplicative_calculator(vector)[1]
    response['logLogProduct'] = mult_score.get('logLogProduct', 'NIL')

    return ORJSONResponse(response)