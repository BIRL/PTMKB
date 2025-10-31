"""
**PTMKB - Get Started**

Our script is designed to get developers started with
"""

import requests
import json
from typing import Union, Any, TypeAlias

BASE_URL = "https://perceptronptmkb.lums.edu.pk/ptmkb/api"
TIMEOUT = 30

AUTHORIZATION_TOKEN = '<your_token_here>' # Please add your token assigned to your account to proceed.

# For type hinting purposes
JSON: TypeAlias = dict[str, "JSON"] | list["JSON"] | str | int | float | bool | None 

# A fairly simple request mechanism that handles GET and POST requests for
# different endpoints, each with optional parameters provided
def request(endpoint: str, params: dict = None) -> JSON:
    """
    Make a request to the API endpoint.

    :param str endpoint:
        The service to call.
    :param dict params:
        The information to pass along with the request.

    :returns:
        The response in JSON format.
    :rtype:
        JSON
    
    Example:
    .. code-block:: python
        uniprot_accession_number = "O14746"
        params = {
            "upac", uniprot_accession_number
        }
        response = request('get-protein-details', "GET", params)
        if response:
            print(response.json())
    """
    try:
        response = requests.get(
            f"{BASE_URL}/{endpoint}",
            params=params,
            headers={
                "Authorization": f"Bearer {AUTHORIZATION_TOKEN}",
            },
            timeout=TIMEOUT
        )
        if response is None:
            return ValueError("'method' argument must either be GET or POST.")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error while making GET request to {endpoint}: {e}")
        return None

# Call the get-ptm-details URL
def get_ptm_details(resid: str):
    params = {'resid': resid}
    return request("get-ptm-details", params)

# Call the get-protein-details URL
def get_protein_details(upid: str = None, upac: str = None):
    params = {'upid': upid, 'upac': upac}
    return request("get-protein-details", params)

# Call the available-ptms URL
def get_available_ptms():
    return request("get-available-ptms")

# Call the get-positional-frequency-matrix URL
def get_positional_frequency_matrix(selection: str, residue: str, table: str):
    params = {'selection': selection, 'residue': residue, 'table': table}
    return request("get-positional-frequency-matrix", params)

# Call the calculate-propensity URL
def calculate_propensity(ptm: str, subsequence: str):
    data = {'ptm': ptm, 'subsequence': subsequence}
    return request("calculate-propensity", data)


def main():
    # Here, we go over each API call and how it is being used.
    # You can modify the variable below to choose which function to call.
    while True:
        try:
            print()
            URL = input(
                "Choose URL from the following:\n"
                "1 - \t Get PTM Details\n"
                "2 - \t Get Protein Details\n"
                "3 - \t Get available PTMs\n"
                "4 - \t Get Positional Frequency Matrix\n"
                "5 - \t Calculate Propensity\n"
                "Input: "
            )
            if 'exit' in URL:
                print("Terminating program...")
                break
            
            if URL == '1':
                # Example 1: Get PTM Details for a given RESID ID
                resid = input(
                    "Enter a valid RESID ID (default example: AA0039): "
                )
                if resid == '':
                    resid = 'AA0039'

                ptm_details = get_ptm_details(resid)
                if ptm_details:
                    print(
                        f"PTM Details for {resid}: "
                        + json.dumps(ptm_details, indent=4)
                    )
                else:
                    print(f"No details found for RESID ID: {resid}")

            elif URL == '2':
                # Example 2: Get Protein Details using UniProt ID
                upid = input(
                    "Enter a valid UniProt Identifier "
                    "(default example: 'AF9_HUMAN'): "
                )
                upac = ''
                if upid == '':
                    upac = input(
                        "Enter a valid UniProt Accession Number "
                        "(default example: 'O14746'): "
                    )
                    if upac == '':
                        upid = 'AF9_HUMAN'

                # Accession Number nomenclature is always 6 characters long,
                # hence this weird way of calling the function
                protein_details = get_protein_details(upac=upac, upid=upid)
                if protein_details:
                    print(
                        f"Protein Details: "
                        + json.dumps(protein_details, indent=4)
                    )
                else:
                    print(f"No protein details found for ID: {upid} or AC: {upac}")

            elif URL == '3':
                # Example 3: Get a list of available PTMs
                available_ptms = get_available_ptms()
                if available_ptms:
                    print(
                        f"Available PTMs: "
                        + json.dumps(available_ptms, indent=4)
                    )
                else:
                    print("Could not fetch PTMs.")

            elif URL == '4':
                # Example 4: Get Positional Frequency Matrix for a PTM
                # Reminder that the inputs are all case sensitive, especially
                # for PTMs. Please call "get-available-ptms" first to see
                # how the PTM you wish to get is called.
                ptm = input(
                    "Enter a Post-Translational Modification name "
                    "(default example: 'Phosphorylation'): "
                )
                if ptm == '':
                    ptm = 'Phosphorylation'

                residue = input(
                    "Enter a residue as the PTM site (default example: 'S'): "
                )
                if residue == '':
                    residue = 'S'

                table = input(
                    "Enter the type of matrix "
                    "(accepted values: 'freq', 'log-e',"
                    " default: 'freq'): "
                )
                if table not in ['freq', 'log-e']:
                    table = 'freq'

                matrix_data = get_positional_frequency_matrix(ptm, residue, table)
                if matrix_data:
                    print(f"Positional Frequency Matrix: {json.dumps(matrix_data, indent=4)}")
                else:
                    print("Could not fetch the positional frequency matrix.")

            elif URL == '5':
                # Example 5: Calculate Propensity for a PTM and subsequence
                # The only URL to be called with a POST request.
                
                ptm = input(
                    "Enter a Post-Translational Modification name "
                    "(default example: 'Phosphorylation'): "
                )
                if ptm == '':
                    ptm = 'Phosphorylation'

                subsequence = input(
                    "Enter a protein subsequence to find its propensity, "
                    "the possibility of the PTM occurring on the residue "
                    "(default example: WKLLPENNVLSPLPSQAMDDW) [Subsequence length "
                    "must be 13, 15, 17, 19, or 21]: "
                )
                if subsequence == '':
                    subsequence = 'WKLLPENNVLSPLPSQAMDDW'

                propensity_result = calculate_propensity(ptm, subsequence)
                if propensity_result:
                    print(f"Propensity Calculation Result: {json.dumps(propensity_result, indent=4)}")
                else:
                    print("Error calculating propensity.")
                
        except KeyboardInterrupt:
            print("\nTerminating program...")
            break

if __name__ == "__main__":
    main()