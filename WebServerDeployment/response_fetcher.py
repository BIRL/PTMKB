import requests
import traceback

def fetch_response_uniprot_trim(prot_id):
    # I'm so sorry. I haven't had time to fix this.
    # It works, though.
    return_response = dict.fromkeys(
        [
            'uniProtID',
            'uniProtAC',
            'proteinName',
            'geneName',
            'organism',
            'sequenceLength',
            'subcellularLocalizations',
            'proteinFunction',
            'proteinSequence',
            'proteinSequenceFull',
            'lastUpdate',
            'message'
        ],
        ''
    )
    try:
        response = requests.get(
            f"https://rest.uniprot.org/uniprotkb/{prot_id}",
            headers={
                'Accept': 'application/json'
            }
        )
        if response.ok:
            try:
                response: dict = response.json()
                # Handle demerged/deleted problems first.
                if 'inactiveReason' in response.keys():
                    inactive_reason = response['inactiveReason']['inactiveReasonType']

                    # For DELETED
                    if 'DELETED' in inactive_reason:
                        prot_id = response['extraAttributes']['uniParcId']
                        print("UNIPARC", prot_id)
                        response = requests.get(
                            f'https://rest.uniprot.org/uniparc/{prot_id}',
                            headers={
                                'Accept': 'application/json'
                            }
                        )
                        # This is processed a LOT differently
                        try:
                            return_response['uniProtAC'] = response['uniParcCrossReferences'][0]['id']
                        except:
                            print(traceback.format_exc())
                            return_response['uniProtAC'] = ''
                        try:
                            return_response['proteinName'] = response['uniParcCrossReferences'][0]['proteinName']
                        except:
                            print(traceback.format_exc())
                            return_response['proteinName'] = ''
                        try:
                            return_response['geneName'] = response['uniParcCrossReferences'][0]['geneName']
                        except:
                            print(traceback.format_exc())
                            return_response['geneName'] = ''
                        try:
                            return_response['organism'] = (
                                f"{response['uniParcCrossReferences'][0]['organism']['scientificName']}"
                                f" ({response['uniParcCrossReferences'][0]['organism']['commonName']})"
                            )
                        except:
                            print(traceback.format_exc())
                            return_response['organism'] = ''
                        try:
                            return_response['sequenceLength'] = response['sequence']['length']
                        except:
                            print(traceback.format_exc())
                            return_response['sequenceLength'] = ''
                        try:
                            return_response['proteinSequence'] = response['sequence']['value']
                        except:
                            print(traceback.format_exc())
                            return_response['proteinSequence'] = ''
                        try:
                            return_response['proteinSequenceFull'] = response['sequence']
                        except:
                            print(traceback.format_exc())
                            return_response['proteinSequenceFull'] = {}
                        try:
                            return_response['lastUpdate'] = response['uniParcCrossReferences'][0]['lastUpdated']
                        except:
                            print(traceback.format_exc())
                            return_response['lastUpdate'] = ''

                        # UniParc doesn't hold UniProtID and Protein function, which is a shame,
                        # because this will be the THIRD call to the UniProt API
                        response = requests.get(
                            f"https://rest.uniprot.org/uniprotkb/{return_response['uniProtAC']}",
                            headers={
                                'Accept': 'application/json'
                            }
                        )
                        response: dict = response.json()
                        # And now we resume.
                        try:
                            return_response['proteinFunction'] = ''.join(
                                i['texts'][0]['value'] for i in response['comments']
                                if 'FUNCTION' in i['commentType']
                            )
                        except:
                            print(traceback.format_exc())
                            return_response['proteinFunction'] = ''
                        try:
                            return_response['uniProtID'] = response['uniProtkbId']
                        except:
                            print(traceback.format_exc())
                            return_response['uniProtID'] = ''
                    
                    # For DEMERGED
                    elif 'DEMERGED' in inactive_reason:
                        prot_id = response['inactiveReason']['mergeDemergeTo'][0]
                        print("DEL", prot_id)
                        response = requests.get(
                            f"https://rest.uniprot.org/uniprotkb/{prot_id}",
                            headers={
                                'Accept': 'application/json'
                            }
                        )
                        # And this is also processed the same way as the original response
                        try:
                            return_response['uniProtID'] = response['uniProtkbId']
                        except:
                            print(traceback.format_exc())
                            return_response['uniProtID'] = ''
                        try:
                            return_response['uniProtAC'] = response['primaryAccession']
                        except:
                            print(traceback.format_exc())
                            return_response['uniProtAC'] = ''
                        try:
                            return_response['proteinName'] = (
                                response['proteinDescription']['recommendedName']['fullName']['value'] # Wow
                            )
                        except:
                            try:
                                return_response['proteinName'] = (
                                    response['proteinDescription']['submissionNames'][0]['fullName']['value'] # Wow
                                )
                            except:
                                print(traceback.format_exc())
                                return_response['proteinName'] = ''
                        try:
                            return_response['geneName'] = response['genes'][0]['geneName']['value']
                        except:
                            try:
                                return_response['geneName'] = ', '.join(i['value'] for i in response['genes'][0]['orfNames'])
                            except:
                                print(traceback.format_exc())
                                return_response['geneName'] = ''
                        try:
                            return_response['organism'] = response['organism']['scientificName']
                        except:
                            print(traceback.format_exc())
                            return_response['organism'] = ''
                        try:
                            return_response['organism'] += f" ({response['organism']['commonName']})"
                        except:
                            print(traceback.format_exc())
                        try:
                            return_response['sequenceLength'] = response['sequence']['length']
                        except:
                            print(traceback.format_exc())
                            return_response['sequenceLength'] = ''
                        try:
                            return_response['proteinFunction'] = ''.join(
                                i['texts'][0]['value'] for i in response['comments']
                                if 'FUNCTION' in i['commentType']
                            )
                        except:
                            print(traceback.format_exc())
                            return_response['proteinFunction'] = ''
                        try:
                            return_response['proteinSequence'] = response['sequence']['value']
                        except:
                            print(traceback.format_exc())
                            return_response['proteinSequence'] = ''
                        try:
                            return_response['proteinSequenceFull'] = response['sequence']
                        except:
                            print(traceback.format_exc())
                            return_response['proteinSequenceFull'] = ''
                        try:
                            return_response['lastUpdate'] = response['entryAudit']['lastSequenceUpdateDate']
                        except:
                            print(traceback.format_exc())
                            return_response['lastUpdate'] = ''
                    
                        # Handle subcellular localizations differently
                        subcellular_localizations = [i for i in response.get('comments', []) if 'SUBCELLULAR LOCATION' in i.get('commentType', '')]
                        subcell_response = ''
                        for subcell in subcellular_localizations:
                            subcell_response += subcell.get('molecule') + ': ' if subcell.get('molecule', None) else ''
                            locs = subcell.get('subcellularLocations', [])
                            for loc in locs:
                                subcell_response += loc.get('location', {}).get('value', '') + ' '
                            locs = subcell.get('note', {}).get('texts', [])
                            if locs:
                                subcell_response += '- '
                            for loc in locs:
                                subcell_response += loc.get('value', '') + ' '
                            subcell_response += '\n'
                        return_response['subcellularLocalizations'] = subcell_response

                # Otherwise just process as usual.
                else:
                    # Populate the dictionary with the values acquired from the API
                    try:
                        return_response['uniProtID'] = response['uniProtkbId']
                    except:
                        print(traceback.format_exc())
                        return_response['uniProtID'] = ''
                    try:
                        return_response['uniProtAC'] = response['primaryAccession']
                    except:
                        print(traceback.format_exc())
                        return_response['uniProtAC'] = ''
                    try:
                        return_response['proteinName'] = (
                            response['proteinDescription']['recommendedName']['fullName']['value'] # Wow
                        )
                    except:
                        try:
                            return_response['proteinName'] = (
                                response['proteinDescription']['submissionNames'][0]['fullName']['value'] # Wow
                            )
                        except:
                            print(traceback.format_exc())
                            return_response['proteinName'] = ''
                    try:
                        return_response['geneName'] = response['genes'][0]['geneName']['value']
                    except:
                        try:
                             return_response['geneName'] = ', '.join(i['value'] for i in response['genes'][0]['orfNames'])
                        except:
                            print(traceback.format_exc())
                            return_response['geneName'] = ''
                    try:
                        return_response['organism'] = response['organism']['scientificName']
                    except:
                        print(traceback.format_exc())
                        return_response['organism'] = ''
                    try:
                        return_response['organism'] += f" ({response['organism']['commonName']})"
                    except:
                        print(traceback.format_exc())
                    try:
                        return_response['sequenceLength'] = response['sequence']['length']
                    except:
                        print(traceback.format_exc())
                        return_response['sequenceLength'] = ''
                    try:
                        return_response['proteinFunction'] = ''.join(
                            i['texts'][0]['value'] for i in response['comments']
                            if 'FUNCTION' in i['commentType']
                        )
                    except:
                        print(traceback.format_exc())
                        return_response['proteinFunction'] = ''
                    try:
                        return_response['proteinSequence'] = response['sequence']['value']
                    except:
                        print(traceback.format_exc())
                        return_response['proteinSequence'] = ''
                    try:
                        return_response['proteinSequenceFull'] = response['sequence']
                    except:
                        print(traceback.format_exc())
                        return_response['proteinSequenceFull'] = ''
                    try:
                        return_response['lastUpdate'] = response['entryAudit']['lastSequenceUpdateDate']
                    except:
                        print(traceback.format_exc())
                        return_response['lastUpdate'] = ''
                    
                    # Handle subcellular localizations differently
                    subcellular_localizations = [i for i in response.get('comments', []) if 'SUBCELLULAR LOCATION' in i.get('commentType', '')]
                    subcell_response = ''
                    for subcell in subcellular_localizations:
                        subcell_response += subcell.get('molecule') + ': ' if subcell.get('molecule', None) else ''
                        locs = subcell.get('subcellularLocations', [])
                        for loc in locs:
                            subcell_response += loc.get('location', {}).get('value', '') + ' '
                        locs = subcell.get('note', {}).get('texts', [])
                        if locs:
                            subcell_response += '- '
                        for loc in locs:
                            subcell_response += loc.get('value', '') + ' '
                        subcell_response += '\n'
                    return_response['subcellularLocalizations'] = subcell_response
            except Exception as e:
                print(traceback.format_exc())
                return_response['message'] = f"Error: {e}"
    except Exception as e:
        print(traceback.format_exc())
        return_response['message'] = f"Error: {e}"
    return return_response