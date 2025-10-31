# PERCEPTRON-PTMKB
PERCEPTRON-PTMKB web-serves a platform for quantitative analysis of protein residue-specific post-translational modifications (PTMs) along with their propensities in context of their neighboring residues based on dbPTM.
PERCEPTRON-PTMKB analyses each input constituent protein residue from amongst 72 experimentally verified PTMs by sourcing information from dbPTM, UniProt, JPred, AlphaFoldDB, RESID, and RCSB Protein Data Bank. The webserver outputs positional PTM propensities for each residue having at least one PubMed-valid evidence identifier, along with its RESID reference, secondary structural conformation, 3D protein visualizations with DSSP, and Solvent Accessible Surface Area (SASA) calculations.
PERCEPTRON-PTMKB can also be integrated using a secure RESTful API to offer PTM scoring features for available top-down and bottom-up protein search engines programmatically.

# Prerequisites
Please ensure the following:
- Python 3.11+ is installed on your system
- MongoDB Database Server 8.0+ is installed on your system
- The data from dbPTM is dumped on your Mongo database (see pipeline script inside the `DataProcessingPipeline` folder)

# How To Run
Navigate inside the `WebServerDeployment` folder and follow the steps to run the server:
- Set up a Python virtual environment:
  ```bash
  python -m venv env
  ```
  Activate it:
  ```bash
  source env/bin/activate # on Linux-based systems
  env\Scripts\activate # on Windows
  ```
- Install the libraries required for running PERCEPTRON-PTMKB:
  ```bash
  pip install -r requirements.txt
  ```
- Launch the server by running the command below:
  ```bash
  python -m uvicorn main:app --port 8000
  ```

The server should now be accessible at http://127.0.0.1:8000.

# Guide
For a guide on using PERCEPTRON-PTMKB, please navigate to http://127.0.0.1:8000/documentation/.
