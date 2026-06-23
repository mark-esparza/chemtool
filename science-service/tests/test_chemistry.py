"""Smoke tests for the RDKit chemistry layer.

Run with: pytest  (from the science-service/ directory)
"""

import math

import pytest

from app import chemistry
from app.chemistry import InvalidSmilesError


def test_descriptors_aspirin():
    res = chemistry.compute_descriptors("CC(=O)OC1=CC=CC=C1C(=O)O")
    d = res.descriptors
    assert d.formula == "C9H8O4"
    assert math.isclose(d.mw, 180.16, abs_tol=0.1)
    assert res.inchikey.startswith("BSYNRYMUTXBXSQ")  # aspirin InChIKey
    assert d.ro5_violations == 0


def test_descriptors_caffeine_aromatic_rings():
    res = chemistry.compute_descriptors("CN1C=NC2=C1C(=O)N(C(=O)N2C)C")
    assert res.descriptors.formula == "C8H10N4O2"
    assert res.descriptors.aromatic_rings >= 1
    assert res.descriptors.hba > 0


def test_double_bond_affects_formula():
    # Ethane vs ethylene: the bond order must change the hydrogen count.
    ethane = chemistry.compute_descriptors("CC").descriptors
    ethylene = chemistry.compute_descriptors("C=C").descriptors
    assert ethane.formula == "C2H6"
    assert ethylene.formula == "C2H4"


def test_tanimoto_identity_and_range():
    aspirin = "CC(=O)OC1=CC=CC=C1C(=O)O"
    assert chemistry.tanimoto_similarity(aspirin, aspirin).tanimoto == 1.0
    sim = chemistry.tanimoto_similarity("CC", "c1ccccc1C(=O)O").tanimoto
    assert 0.0 <= sim <= 1.0


def test_invalid_smiles_raises():
    with pytest.raises(InvalidSmilesError):
        chemistry.compute_descriptors("not-a-real-smiles-@@@")
