# PTMKB

PTMKB web-serves a platform for quantitative analysis of protein residue-specific post-translational modifications (PTMs) along with their propensities in context of their neighboring residues based on dbPTM.
PTMKB analyses each input constituent protein residue from amongst 72 experimentally verified PTMs by sourcing information from dbPTM, UniProt, JPred, AlphaFoldDB, RESID, and RCSB Protein Data Bank. The webserver outputs positional PTM propensities for each residue having at least one PubMed-valid evidence identifier, along with its RESID reference, secondary structural conformation, 3D protein visualizations with DSSP, and Solvent Accessible Surface Area (SASA) calculations.
PTMKB can also be integrated using a secure RESTful API to offer PTM scoring features for available top-down and bottom-up protein search engines programmatically.
