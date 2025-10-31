import mdtraj as md
from mdtraj.core.trajectory import Trajectory
from mdtraj.core.topology import Residue
import tempfile
import os
from typing import Any, Literal

aa_dict = {
    "ALA": "A",
    "CYS": "C",
    "ASP": "D",
    "GLU": "E",
    "PHE": "F",
    "GLY": "G",
    "HIS": "H",
    "ILE": "I",
    "LYS": "K",
    "LEU": "L",
    "MET": "M",
    "ASN": "N",
    "PRO": "P",
    "GLN": "Q",
    "ARG": "R",
    "SER": "S",
    "THR": "T",
    "VAL": "V",
    "TRP": "W",
    "TYR": "Y",
}

def create_file(pdb_data: bytes) -> Trajectory:
    file = tempfile.NamedTemporaryFile(suffix='.pdb', delete=False)
    file.write(pdb_data)
    traj: Trajectory = md.load(file.name)
    # Close the file then proceed - I/O operations are expensive
    file.close()
    os.unlink(file.name)
    # Only select chain A - There are multiple chains for verification
    # purposes, but we're only concerned with the first chain.
    # This produces a bug so commenting it out.
    # Not bothered to fix it currently.
    traj.atom_slice(atom_indices=traj.topology.select('chainid 0'), inplace=True)
    return traj

def get_secondary_structure(traj: Trajectory):
    try:
        return {
            'simplified': md.compute_dssp(traj)[0].tolist(),
            'detailed': md.compute_dssp(traj, simplified=False)[0].tolist()
        }
    except:
        return {
            'simplified': [],
            'detailed': []
        }

def get_solvent_accessible_surface_area(
    traj: Trajectory, mode: Literal['atom', 'residue'] = 'residue'
):
    try:
        return {
            'SASA': md.shrake_rupley(traj, mode=mode)[0].tolist()
        }
    except:
        return {
            'simplified': [],
            'detailed': []
        }


def get_protein_sequence(
    traj: Trajectory,
) -> str:
    try:
        sequence = ''
        for i in range(traj.n_residues):
            residue: Residue = traj.topology.residue(i)
            sequence += aa_dict.get(residue.name, '')
        return sequence    
    except:
        return ''
