"""RDKit-backed chemistry: correct descriptors, fingerprints, and alerts.

This replaces the hand-rolled SMILES parser and heuristic descriptor math in the
Node app (`src/lib/chemEngine.ts`). RDKit is the reference implementation for
all of these quantities, which removes the class of parser-correctness bugs the
heuristic engine was prone to.
"""

from __future__ import annotations

from rdkit import Chem, RDLogger
from rdkit.Chem import (
    Crippen,
    Descriptors,
    Lipinski,
    QED,
    rdMolDescriptors,
)
from rdkit.Chem import DataStructs
from rdkit.Chem.rdMolDescriptors import GetMorganFingerprintAsBitVect
from rdkit.Chem.FilterCatalog import FilterCatalog, FilterCatalogParams

from .schemas import (
    Descriptors as DescriptorsSchema,
    DescriptorResult,
    SimilarityResult,
    StructuralAlert,
)

# RDKit is chatty about parse failures; we surface them ourselves.
RDLogger.DisableLog("rdApp.*")


class InvalidSmilesError(ValueError):
    """Raised when a SMILES string cannot be parsed by RDKit."""


def _parse(smiles: str) -> Chem.Mol:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise InvalidSmilesError(f"RDKit could not parse SMILES: {smiles!r}")
    return mol


# Build the alert catalog once at import time (PAINS A/B/C + Brenk).
def _build_alert_catalog() -> FilterCatalog:
    params = FilterCatalogParams()
    for cat in (
        FilterCatalogParams.FilterCatalogs.PAINS_A,
        FilterCatalogParams.FilterCatalogs.PAINS_B,
        FilterCatalogParams.FilterCatalogs.PAINS_C,
        FilterCatalogParams.FilterCatalogs.BRENK,
    ):
        params.AddCatalog(cat)
    return FilterCatalog(params)


_ALERT_CATALOG = _build_alert_catalog()


def _alerts_for(mol: Chem.Mol) -> list[StructuralAlert]:
    alerts: list[StructuralAlert] = []
    for match in _ALERT_CATALOG.GetMatches(mol):
        props = match.GetDescription() or "alert"
        # FilterCatalog entries are prefixed with their source, e.g. "Brenk_..."
        catalog = props.split("_", 1)[0].upper() if "_" in props else "ALERT"
        alerts.append(StructuralAlert(name=props, catalog=catalog, description=""))
    return alerts


def _lipinski_violations(mw: float, clogp: float, hbd: int, hba: int) -> int:
    return sum([mw > 500, clogp > 5, hbd > 5, hba > 10])


def _veber_violations(rotatable: int, tpsa: float) -> int:
    return sum([rotatable > 10, tpsa > 140])


def compute_descriptors(smiles: str) -> DescriptorResult:
    mol = _parse(smiles)

    mw = Descriptors.MolWt(mol)
    clogp = Crippen.MolLogP(mol)
    tpsa = rdMolDescriptors.CalcTPSA(mol)
    hbd = Lipinski.NumHDonors(mol)
    hba = Lipinski.NumHAcceptors(mol)
    rotatable = Lipinski.NumRotatableBonds(mol)
    aromatic_rings = rdMolDescriptors.CalcNumAromaticRings(mol)

    descriptors = DescriptorsSchema(
        formula=rdMolDescriptors.CalcMolFormula(mol),
        mw=round(mw, 2),
        clogp=round(clogp, 2),
        tpsa=round(tpsa, 1),
        hbd=hbd,
        hba=hba,
        rotatable_bonds=rotatable,
        aromatic_rings=aromatic_rings,
        fraction_csp3=round(rdMolDescriptors.CalcFractionCSP3(mol), 3),
        qed=round(QED.qed(mol), 3),
        heavy_atoms=mol.GetNumHeavyAtoms(),
        ro5_violations=_lipinski_violations(mw, clogp, hbd, hba),
        veber_violations=_veber_violations(rotatable, tpsa),
    )

    return DescriptorResult(
        smiles=smiles,
        canonical_smiles=Chem.MolToSmiles(mol),
        inchikey=Chem.MolToInchiKey(mol),
        descriptors=descriptors,
        structural_alerts=_alerts_for(mol),
    )


def tanimoto_similarity(
    smiles_a: str, smiles_b: str, radius: int = 2, n_bits: int = 2048
) -> SimilarityResult:
    mol_a = _parse(smiles_a)
    mol_b = _parse(smiles_b)
    fp_a = GetMorganFingerprintAsBitVect(mol_a, radius, nBits=n_bits)
    fp_b = GetMorganFingerprintAsBitVect(mol_b, radius, nBits=n_bits)
    sim = DataStructs.TanimotoSimilarity(fp_a, fp_b)
    return SimilarityResult(
        smiles_a=smiles_a,
        smiles_b=smiles_b,
        tanimoto=round(sim, 4),
        method=f"Morgan/ECFP r={radius}, {n_bits} bits (RDKit)",
    )
