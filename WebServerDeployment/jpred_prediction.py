import requests
import re
from collections import OrderedDict
from typing import Literal
from bs4 import BeautifulSoup
import asyncio

async def submit_job(seq: str) -> str:
    # Introducing an async delay before sending the request

    sequence_query = ">query\n{}".format(seq)

    parameters_dict = OrderedDict([("skipPDB", True),
                                   ("format", 'seq')])

    parameters_list = ["{}={}".format(k, v) for k, v in parameters_dict.items() if v]
    parameters_list.append(sequence_query)
    query = u"£€£€".join(parameters_list)

    response = requests.post(
        'http://www.compbio.dundee.ac.uk/jpred4/cgi-bin/rest/job',
        data=query.encode('utf-8'),
        headers={"Content-type": "text/txt"}
    )

    if response.status_code == 202:
        result_url = response.headers['Location']
        matched = re.search(r"(jp_.*)$", result_url)
        if matched:
            jobid = matched.group(1)
            return {'message': "Job submitted!", 'jobid': jobid}
        return {'message': "Could not submit job! Sequence is too long."}

    else:
        return {'message': "Could not submit job! URL error."}

def get_job(jobid: str) -> str:
    try:
        response = requests.get(f'http://www.compbio.dundee.ac.uk/jpred4/cgi-bin/rest/job/id/{jobid}')
    except:
        return {'response': False}
    if response.ok:
        if 'finished' not in response.text.lower() or "100%" in response.text.lower():
            return {'response': False}
        results_url = response.text.split('Results available at the following URL:')[-1].strip().split('.results')[0] + '.html'
        response = requests.get(results_url)
        return  {'response': True, 'content': response.text}  # HTML here
    return {'response': False}

def format_jpred_response(response: str) -> dict[str, dict[str, str]]:
    parsed_html = BeautifulSoup(response)
    code_chunk: str = parsed_html.find('code').text
    formatted_response = {'alignment': {}, 'prediction': {}}

    for line in code_chunk.split('\n'):
        key, value = '', ''
        if line != '':
            line = line.split(':')
            key, value = line[0].strip(), line[1].strip()
            if 'UniRef' in key or 'QUERY' in key:
                formatted_response['alignment'][key] = value
            else:
                if key == '':
                    key = 'Pos'
                formatted_response['prediction'][key] = value
    return formatted_response