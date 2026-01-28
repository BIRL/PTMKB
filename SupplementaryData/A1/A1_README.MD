# Supplementary Data A - Data Processing Pipeline
This pipeline downloads all experimentally verified data hosted on dbPTM and processes the TSV files within. The steps in the script are executed as follows:
- download ZIP files and extract them;
- process for each PTM in TSV:
    - load TSV file in Pandas DataFrames;
    - fill in missing Accession numbers from Uniprot;
    - fill in missing and uneven protein subsequences with appropriate subsequences from Uniprot;
    - compute frequency matrices (probability and log-odds probability) for each PTM per residue; and
- dump the processed PTM and matrices data in MongoDB under the 'ptmkb' database.

# Prerequisites for Running the Python Script

Before running the Python script, ensure that your environment meets the following requirements:

## 1. MongoDB
- **Version:** MongoDB **8.0** or higher is required.  
- Make sure MongoDB is installed and running on your system before executing the script.

## 2. Python
- **Version:** Python **3.11** or higher.  
- You can verify your Python version by running:
  ```bash
  python --version
  ```
- Set up a new virtual environment:
  ```bash
  python -m venv env
  ```
- Activate it:
  ```bash
  source env/bin/activate # for Linux-based systems
  env\Scripts\activate # for Windows systems
  ```

## 3. Python Dependencies
- Install the required Python packages listed in `A1_Requirements.txt`:
  ```bash
  pip install -r A1_Requirements.txt
  ```

# Run Pipeline
Run the pipeline with the following command:
```bash
python A1_Data_Processing_Pipeline.py
```