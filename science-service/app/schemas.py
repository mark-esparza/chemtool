"""Pydantic schemas for the science service.

The central design idea is the *provenance envelope* (`PredictionResult`): every
predicted value travels with its model family, uncertainty, applicability-domain
status, and nearest-neighbor evidence, so the client never has to treat a bare
number as fact. Deterministic RDKit descriptors use the lighter
`DescriptorResult`, which still carries a `source`/`is_estimated` provenance
marker for consistency with the rest of the app.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Requests
# --------------------------------------------------------------------------- #
class SmilesRequest(BaseModel):
    smiles: str = Field(..., description="A single SMILES string", min_length=1)


class SimilarityRequest(BaseModel):
    smiles_a: str = Field(..., min_length=1)
    smiles_b: str = Field(..., min_length=1)
    radius: int = Field(2, ge=1, le=4, description="Morgan fingerprint radius")
    n_bits: int = Field(2048, ge=512, le=8192)


class PredictRequest(BaseModel):
    smiles: str = Field(..., min_length=1)
    endpoint: str = Field(..., description="ADMET/QSAR endpoint id, e.g. 'BBB_penetration'")


# --------------------------------------------------------------------------- #
# Deterministic descriptors (RDKit)
# --------------------------------------------------------------------------- #
class Descriptors(BaseModel):
    formula: str
    mw: float
    clogp: float = Field(..., description="Crippen logP")
    tpsa: float
    hbd: int
    hba: int
    rotatable_bonds: int
    aromatic_rings: int
    fraction_csp3: float
    qed: float
    heavy_atoms: int
    ro5_violations: int
    veber_violations: int


class DescriptorResult(BaseModel):
    smiles: str
    canonical_smiles: str
    inchikey: str
    descriptors: Descriptors
    structural_alerts: list["StructuralAlert"] = Field(default_factory=list)
    # Provenance: these are deterministic RDKit computations, not measurements.
    source: str = "RDKit (deterministic descriptors)"
    is_estimated: bool = False


class StructuralAlert(BaseModel):
    name: str
    catalog: str = Field(..., description="Catalog the rule came from, e.g. PAINS_A, Brenk")
    description: str = ""


class SimilarityResult(BaseModel):
    smiles_a: str
    smiles_b: str
    tanimoto: float
    method: str = "Morgan/ECFP (RDKit)"


# --------------------------------------------------------------------------- #
# Provenance envelope for predictions
# --------------------------------------------------------------------------- #
class ConfidenceGrade(str, Enum):
    A = "A"  # in-domain, low uncertainty, strong nearest-neighbor support
    B = "B"
    C = "C"
    D = "D"  # out-of-domain or high uncertainty — treat with caution


class ModelInfo(BaseModel):
    family: str = Field(..., description="e.g. XGBoost, Chemprop-MPNN, RandomForest")
    version: str
    trained_on: str = Field(..., description="Dataset id, e.g. TDC/BBB_Martins")


class Uncertainty(BaseModel):
    interval: Optional[list[float]] = Field(
        None, description="[low, high] prediction interval in the value's unit"
    )
    method: str = Field(..., description="e.g. conformal, ensemble-std, evidential")


class NearestNeighbor(BaseModel):
    smiles: str
    tanimoto: float
    measured_value: Optional[float] = None
    source: str = Field(..., description="Provenance of the measured value, e.g. ChEMBL/CompTox")


class ApplicabilityDomain(BaseModel):
    in_domain: bool
    nearest_neighbor: Optional[NearestNeighbor] = None
    note: str = ""


class PredictionResult(BaseModel):
    """The provenance envelope. No predicted value is ever returned bare."""

    endpoint: str
    value: Optional[float] = None
    unit: str = ""
    model: ModelInfo
    uncertainty: Uncertainty
    applicability_domain: ApplicabilityDomain
    confidence_grade: ConfidenceGrade
    is_estimated: bool = True
    note: str = ""


# Resolve forward references (DescriptorResult references StructuralAlert above).
DescriptorResult.model_rebuild()
