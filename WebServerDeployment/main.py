import sys

sys.dont_write_bytecode = True

from fastapi import FastAPI, Request, Body, Query, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
import glob
import pandas as pd
import matplotlib.pyplot as plt
import os
import json
import hashlib
import threading

# Enabling a MutEx here for file lock (safety purposes - I know, bad code)
lock = threading.Lock()

#### Comment whichever you want to use for the time being
#### Only use one at a time though
# from mongo_ptm import fetch_identifiers, search_identifier
from local_ptm import fetch_identifiers, search_identifier, get_all_proteins
from calculator import additive_calculator, multiplicative_calculator
from response_fetcher import fetch_response_uniprot_trim
from jpred_prediction import submit_job, get_job
from mdtraj_calculations import (
    create_file,
    get_secondary_structure,
    get_solvent_accessible_surface_area,
    get_protein_sequence
)
from constants import PTM_TABLES, RESID_DATABASE, USERS
import random

######## TOKEN STUFF ########

import time
import jwt

JWT_SECRET = 'what_are_you_looking_here_for'
JWT_ALGORITHM = 'HS256'

SESSIONS = {}

# Return response as a JSON
def token_response(token: str):
    return {
        'access_token': token
    }

# Give the user a new token
def sign_jwt(user_id: str) -> dict[str, str]:
    payload = {
        '_id_': random.randint(1, 10000000000),
        "username": user_id,
        "expires": time.time() + 432000 # Valid for 5 days
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return token_response(token)

# Decode the token by the user
def decode_jwt(token: str) -> dict:
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
        if credentials:
            if not credentials.scheme == "Bearer":
                raise HTTPException(status_code=403, detail="Invalid authentication scheme.")
            validity = decode_jwt(credentials.credentials)
            if not validity:
                raise HTTPException(status_code=403, detail="Invalid token.")
            if validity.get('expired'):
                # Also, have to check if key already exists in USERS
                if token not in USERS[username]['token']['access_token']:
                    raise HTTPException(status_code=403, detail=f"Expired token - please use your current one!")
                # Don't raise, just reset the token
                username = validity.get('username')
                token = sign_jwt(username)
                USERS[username]['token'] = token
                with lock:
                    with open('../data/users/users.json', 'w') as f:
                        json.dump(USERS, f)
                raise HTTPException(status_code=403, detail=f"Automatically reset token! Here: {token.get('access_token')}")
            return credentials.credentials
        else:
            raise HTTPException(status_code=403, detail="Invalid authorization code.")

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
    exists = True if username in USERS.keys() else False
    return {'exists': exists}

@app.post('/ptmkb/registration', include_in_schema=False)
async def register(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    try:
        info = await request.json()
        username = info.get('username')
        password = info.get('password')
        USERS[username] = {
            'password': hashlib.sha256(password.encode('utf-8')).hexdigest(),
            'token': sign_jwt(username)
        }
        with lock:
            with open('../data/users/users.json', 'w') as f:
                json.dump(USERS, f)
        return {'registered': True}
    except:
        return {'registered': False}

@app.post('/ptmkb/reset_token', include_in_schema=False)
async def reset_token(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    try:
        info: dict = await request.json()
        username = info.get('username')
        token = sign_jwt(username)
        USERS[username]['token'] = token
        with lock:
            with open('../data/users/users.json', 'w') as f:
                json.dump(USERS, f)
        return {
            'reset': True,
            'token': token.get('access_token')
        }
    except:
        return {'reset': False,}

@app.post('/ptmkb/fetch_token', include_in_schema=False)
async def fetch_token(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    info: dict = await request.json()
    username = info.get('username')
    return {
        'token': USERS.get(username, {}).get('token', {}).get('access_token', None)
    }

@app.post('/ptmkb/login', include_in_schema=False)
async def attempt_login(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    info: dict = await request.json()
    username = info.get('username')
    if USERS.get(username, None):
        existing_password = USERS.get(username, {}).get('password')
        if existing_password == hashlib.sha256(
            info.get('password').encode('utf-8')
        ).hexdigest():
            # User is validated.
            token = USERS.get(username, {}).get('token', {}).get('access_token', None)
            if token is None:
                token = sign_jwt(username)
                USERS[username]['token'] = token
            return {
                'verify': True,
                'message': '',
                'info': {
                    'username': username,
                    'token': token,
                }
            }
        # Password is invalid.
        return {
            'verify': False,
            'message': "Your password is invalid."
        }
    # User doesn't exist.
    return {
        'verify': False,
        'message': f"No user by the name of {username} exists."
    }

@app.post('/ptmkb/logout', include_in_schema=False)
async def logout(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    try:
        info: dict = await request.json()
        username = info.pop('username')
        SESSIONS.pop(username, None)
        return {'logout': True}
    except:
        return {'logout': False}



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
    ids = fetch_identifiers(_id)
    ids = sort_ids(ids, _id)
    # Give only top 200 suggestions - otherwise burden on user
    return {'ids': ids[:200]}

@app.post('/ptmkb/search_result', include_in_schema=False)
async def search(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    data = await request.json()
    data['id'] = data['id'].strip()
    
    found, results = search_identifier(data['id'])
    # Stupid check, I am aware - need to fix this somehow
    try:
        results = results[0]
    except IndexError:
        ...
    # We're just going to load the HTML file here to include in the iframe.
    with open('./templates/protein.html', 'r', encoding='utf-8') as f:
        html_page = f.read()
    if found:
        if not isinstance(results['Accession Number'], str):
            results['Accession Number'] = ''
    return {
        'found': found,
        'result': results,
        'html': html_page
    }

@app.post('/ptmkb/structure_calculations', include_in_schema=False)
async def get_structure_calculations(request: Request, data: dict = Body(...)):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    raw_bytes = data.get('raw_pdb_data', None)
    if data is None:
        return {'message': "Please submit a PDB file in bytes."}
    traj = create_file(raw_bytes.encode('utf-8'))
    response = dict()
    ss = get_secondary_structure(traj)
    sasa = get_solvent_accessible_surface_area(traj, 'residue')
    response.update(ss)
    response.update(sasa)
    response.update({
        'sequence': get_protein_sequence(traj)
    })
    return response


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
    return_response = fetch_response_uniprot_trim(prot_id)

    return return_response

def save_image(df: pd.DataFrame, format: str, ptm: str) -> bytes:
    _, ax = plt.subplots(figsize=(12, 8))

    ax.axis('off')

    table = ax.table(cellText=df.values, colLabels=df.columns, rowLabels=df.index, cellLoc='center', loc='center')

    # Color the columns
    site_idx = 0
    for (i, j), cell in table.get_celld().items():
        if j >= 0 and i == 0 and cell.get_text().get_text() == '0':
            site_idx = j
            break
    
    for (i, j), cell in table.get_celld().items():
        if j == -1:
            cell.set_facecolor('#D0E0E3')
        elif j >= 0:
            if i == 0:
                cell.set_facecolor('#A0C4FF')
            else:
                if j == site_idx:
                    cell.set_facecolor("#F2C998")
                else:
                    cell.set_facecolor('#E0E0E0' if i % 2 == 0 else '#FFFFFF')

    ax.set_title("Log-Odd values for " + ptm)
    plt.text(-0.035, 0.37, "Amino Acid at Position", rotation=90)
    plt.text(0.365, 0.8, "Position Relative to Modification Site")

    plt.savefig(
        f"./temp.{format}",
        dpi=300
    )
    with open(f'./temp.{format}', 'rb') as f:
        raw_data = f.read()
    os.remove(f'./temp.{format}')

    return raw_data

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

    df = pd.read_json(f"./data/tables/{ptm}/{table}/{aa}.json")
    
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
    m_score = m_scores[1]['multiplicative_score']
    asterisk_m_score = m_scores[1]['logLogProduct']
    return {
        'logSum': round(a_score, 3) if not isinstance(a_score, str) else a_score,
        'logLogProduct': round(asterisk_m_score, 3) if not isinstance(asterisk_m_score, str) else asterisk_m_score
    }

@app.get('/ptmkb/getAminoAcids', include_in_schema=False)
def get_amino_acids(request: Request, ptm: str):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    if not ptm:
        return {
            'response': False,
            'message': "No PTM was provided."
        }
    data = [i.split("\\")[-1].split('.')[0] for i in glob.glob(f'./data/tables/{ptm}/log-e/*.json')]
    return {
        'response': True,
        'data': data
    }

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
        return {'message': "Please enter either a RESID ID or a PTM name along with a residue!"}

    return {'response': entry}


######## Non-API CALLS ########

@app.post('/ptmkb/unrel/submitJpred', include_in_schema=False)
async def get_jpred_prediction(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    info = await request.json()
    return await submit_job(info['sequence'])

@app.get('/ptmkb/unrel/getJpred', include_in_schema=False)
def get_jpred_prediction(request: Request, jobid: str):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")
    
    return get_job(jobid)

@app.get('/ptmkb/ptms_list', include_in_schema=False)
def get_ptms(request: Request):
    user_agent = request.headers.get('user-agent', '')

    if not is_browser(user_agent):
        raise HTTPException(status_code=403, detail="Access restricted to browsers only")

    options = [i.split("\\")[-1] for i in glob.glob(r'data\tables\*')]
    return {'ptms': options}

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
    if not os.path.exists(f'./data/tables/{ptm}/{table}/{residue}.json'):
        return {'message': f"Could not find the positional matrix of {ptm} for {residue}."}
    return [i for i in PTM_TABLES.get(ptm) if i.get(residue, None) is not None][0].get(residue).get(table)

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
    if not os.path.exists(f'./data/tables/{ptm}'):
        return {
            'message': f"No such Post-Translational Modification by the name of {ptm} exists."
        }
    if not os.path.exists(f'./data/tables/{ptm}/log-e/{char}.json'):
        return {
            'message': f"No such propensity calculator exists for {ptm} of residue {char}."
        }
    
    with open(f'./data/tables/{ptm}/log-e/{char}.json', 'r') as f:
        table: dict[str, dict[str, int|str]] = json.load(f)

    KEYS = []

    for i in range(-(len(subsequence) // 2), (len(subsequence) // 2) + 1):
        key = f"+{i}" if i > 0 else str(i)
        KEYS.append(key)

    vector = []
    for index, key in enumerate(KEYS):
        vector.append(
            table.get(key, {})
            .get(subsequence[index], '-inf')
        )
    response = {
        'logSum': additive_calculator(vector)
    }
    mult_score = multiplicative_calculator(vector)[1]
    response.update({
        'logLogProduct': mult_score.get('logLogProduct', 'NIL')
    })
    return response

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
    if entry:
        return {resid: entry[0]}
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
def get_protein_details(
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
    found, results = search_identifier(_id)
    if found:
        return {'result': results}
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

    options = [i.split("\\")[-1] for i in glob.glob(r'data\tables\*')]
    return {'ptms': options}

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
    table: str = Query('log-e', description='The type of matrix required. Accepted values are \'freq\' and \'log-e\'.', example='freq')
):
    """
    Get the positional frequency matrix of a Post-Translational Modification (PTM),
    given the PTM, amino acid, and the matrix table type.

    If nothing is provided, all available positional matrices for all PTMs on all residues will be supplied.

    If only the PTM is provided, all available positional matrices for that PTM on all residues will be supplied.

    If the table is not provided or is any value other than 'freq' or 'log-e', it will default to 'log-e' and subsequently return the natural log matrix for the specified PTM on the specified residue.

    **Returns:**
    - The Positional Frequency Matrix of the Post-Translational Modification for the specified amino acid. (type: *JSON*)
    """
    residue = residue.upper() # Input validation.
    if not ptm:
        return {'message': "Please provide a Post Translational Modification as value."}
    if not residue:
        return {'message': "Please provide a residue for which you want the positional matrix."}
    if table not in ['log-e', 'freq']:
        table = 'log-e'
    if not os.path.exists(f'./data/tables/{ptm}/{table}/{residue}.json'):
        return {'message': f"Could not find the positional matrix of {ptm} for {residue}."}
    return [i for i in PTM_TABLES.get(ptm) if i.get(residue, None) is not None][0].get(residue).get(table)

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
    print("HERE", ptm, subsequence)
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
    if not os.path.exists(f'./data/tables/{ptm}'):
        return {
            'message': f"No such Post-Translational Modification by the name of {ptm} exists."
        }
    if not os.path.exists(f'./data/tables/{ptm}/log-e/{char}.json'):
        return {
            'message': f"No such propensity calculator exists for {ptm} of residue {char}."
        }
    
    # With all input validation done, proceed with the calculation.
    with open(f'./data/tables/{ptm}/log-e/{char}.json', 'r') as f:
        table: dict[str, dict[str, int|str]] = json.load(f)

    KEYS = []

    for i in range(-(len(subsequence) // 2), (len(subsequence) // 2) + 1):
        key = f"+{i}" if i > 0 else str(i)
        KEYS.append(key)

    vector = []
    for index, key in enumerate(KEYS):
        vector.append(
            table.get(key, {})
            .get(subsequence[index], '-inf')
        )
    response = {
        'logSum': additive_calculator(vector)
    }
    mult_score = multiplicative_calculator(vector)[1]
    response.update({
        'logLogProduct': mult_score.get('logLogProduct', 'NIL')
    })
    # A minor change here to account for non-showing of raw multiplicative scores
    # because the value is too large to be used for anything substantial
    return response
