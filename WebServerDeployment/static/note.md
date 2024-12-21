# Documentation
This simple documentation guides programmers to utilize the REST API calls embedded within this server.

## Post-Translational Modifications
As this website hosts PTMs archived in **dbPTM**, the following PTMs exist that can be searched for:
|.                                  | Available PTMs                                 |.                                   |
|----------------------------------------------|----------------------------------------------|-----------------------------------------------|
| Acetylation                                  | Biotinylation                               | Carboxyethylation                             |
| ADP-ribosylation                             | Blocked amino end                           | Carboxylation                                 |
| Amidation                                    | Butyrylation                                | Cholesterol ester                             |
| AMPylation                                   | C-linked Glycosylation                      | Citrullination                                |
| D-glucuronoylation                           | Crotonylation                               | Disulfide bond                                |
| Deamidation                                  | Decanoylation                               | Farnesylation                                 |
| Deamination                                  | Decarboxylation                             | Formation of an isopeptide bond               |
| Formylation                                  | Gamma-carboxyglutamic acid                 | Geranylgeranylation                            |
| Glutarylation                                | Glutathionylation                           | Hydroxyceramide ester                         |
| Hydroxylation                                | Iodination                                   | Lactoylation                                   |
| Lactylation                                  | Lipoylation                                 | Malonylation                                   |
| Methylation                                  | Myristoylation                              | N-carbamoylation                              |
| N-linked Glycosylation                       | N-palmitoylation                            | Neddylation                                   |
| Nitration                                    | O-linked Glycosylation                      | O-palmitoleoylation                           |
| O-palmitoylation                             | Octanoylation                               | Oxidation                                     |
| Phosphatidylethanolamine amidation          | Phosphorylation                             | Propionylation                                |
| Pyrrolidone carboxylic acid                 | Pyrrolylation                               | Pyruvate                                      |
| S-archaeol                                  | S-carbamoylation                            | S-Cyanation                                   |
| S-cysteinylation                            | S-diacylglycerol                           | S-linked Glycosylation                        |
| S-nitrosylation                              | S-palmitoylation                            | Serotonylation                                |
| Stearoylation                                | Succinylation                               | Sulfation                                     |
| Sulfhydration                                | Sulfoxidation                               | Sumoylation                                    |
| Thiocarboxylation                            | Ubiquitination                              | UMPylation                                    |

You can fetch this list by calling this URL with a GET request:

    /ptmkb/api/ptms

## Proteins
To gather information on a protein whose PTMs you wish to identify, you can make a GET request to this URL, with either the `upid` (UniProt ID) or the `upac` (UniProt Accession Number) required. Note that if both are provided, `upid` will take preference:

    /ptmkb/api/proteins

For instance, if you wish to gather information on `O14746`, you must invoke a GET request to the URL like so:

    /ptmkb/api/proteins?upac=O14746

## Fetching PTM Table
Besides the availability to download the tables through the website, you can also programmatically fetch the table for your work.

The values calculated for a protein sequence are log-odd frequencies over the entire available sequences in dbPTM. If you wish to use a table for your purposes, that can also be fetched using a GET request.

For fetching a PTM's table, make a request at the following URL:

    /ptmkb/api/data

This will fetch all tables available in our database.
The tables are kept in JSON format for usability and storage.

For a specific table, pass the name of the PTM to `selection`. As an example, for Phosphorylation, the URL would be:

    /ptmkb/api/data?selection=Phosphorylation

For C-linked Glycosylation, it would be:

    /ptmkb/api/data?selection=C-linked%20Glycosylation

A list of all possible selections are listed below for your convenience. Please keep in mind that the PTM names are **case-sensitive**! The list will be updated with more PTM types as they are readily available.
