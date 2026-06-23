"""Baseline QSAR with honest uncertainty, applicability domain, and evidence.

For each supported endpoint we train a RandomForest on ECFP (Morgan) fingerprints
of a real measured dataset. Every prediction returns the full provenance
envelope:

- value        — RandomForest ensemble mean
- uncertainty  — spread across the forest's trees (a standard, honest estimate)
- applicability domain — Tanimoto similarity to the nearest training compound;
  out-of-domain predictions are graded down regardless of the point estimate
- nearest-neighbor evidence — the closest *measured* compound and its value

This is a deliberately simple baseline (ROADMAP step 3). It is honest about its
limits via the confidence grade; it never claims grade A.
"""

from __future__ import annotations

import csv
import os
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from rdkit import Chem
from rdkit.Chem import DataStructs
from rdkit.Chem.rdMolDescriptors import GetMorganFingerprintAsBitVect
from sklearn.ensemble import RandomForestRegressor

from .chemistry import InvalidSmilesError
from .schemas import (
    ApplicabilityDomain,
    ConfidenceGrade,
    EvidenceResult,
    ModelInfo,
    NearestNeighbor,
    PredictionResult,
    Uncertainty,
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
RADIUS = 2
NBITS = 2048
# Minimum Tanimoto to the nearest training compound for a prediction to count as
# "in domain". ~0.35 is a common ECFP4 read-across cutoff.
AD_THRESHOLD = 0.35


@dataclass(frozen=True)
class EndpointSpec:
    endpoint: str
    unit: str
    csv_file: str
    value_col: str
    source: str


ENDPOINTS: dict[str, EndpointSpec] = {
    "solubility_logS": EndpointSpec(
        endpoint="solubility_logS",
        unit="log(mol/L)",
        csv_file="esol_solubility.csv",
        value_col="logS_mol_per_L",
        source="Delaney ESOL (2004), measured aqueous solubility",
    ),
}


def _fingerprint(mol: Chem.Mol):
    return GetMorganFingerprintAsBitVect(mol, RADIUS, nBits=NBITS)


def _to_array(bitvect) -> np.ndarray:
    arr = np.zeros((NBITS,), dtype=np.int8)
    DataStructs.ConvertToNumpyArray(bitvect, arr)
    return arr


@dataclass
class _TrainedModel:
    rf: RandomForestRegressor
    train_fps: list  # ExplicitBitVect, for Tanimoto nearest-neighbor search
    names: list[str]
    smiles: list[str]
    values: list[float]
    spec: EndpointSpec


@lru_cache(maxsize=None)
def _model_for(endpoint: str) -> _TrainedModel:
    spec = ENDPOINTS[endpoint]
    path = os.path.join(DATA_DIR, spec.csv_file)

    names: list[str] = []
    smiles_list: list[str] = []
    values: list[float] = []
    fps: list = []
    rows: list[np.ndarray] = []

    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            smi = (row.get("smiles") or "").strip()
            mol = Chem.MolFromSmiles(smi)
            if mol is None:
                continue
            try:
                val = float(row[spec.value_col])
            except (KeyError, ValueError):
                continue
            bv = _fingerprint(mol)
            names.append((row.get("name") or "").strip())
            smiles_list.append(smi)
            values.append(val)
            fps.append(bv)
            rows.append(_to_array(bv))

    X = np.asarray(rows, dtype=np.int8)
    y = np.asarray(values, dtype=float)
    rf = RandomForestRegressor(n_estimators=200, random_state=0, n_jobs=-1)
    rf.fit(X, y)
    return _TrainedModel(rf, fps, names, smiles_list, values, spec)


def _parse(smiles: str) -> Chem.Mol:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise InvalidSmilesError(f"RDKit could not parse SMILES: {smiles!r}")
    return mol


def _grade(max_sim: float, std: float) -> ConfidenceGrade:
    if max_sim < AD_THRESHOLD:
        return ConfidenceGrade.D
    if max_sim >= 0.6 and std <= 0.75:
        return ConfidenceGrade.B
    return ConfidenceGrade.C


def supported_endpoints() -> list[str]:
    return list(ENDPOINTS)


def _nearest(model: _TrainedModel, query_bv, k: int = 1) -> list[NearestNeighbor]:
    sims = DataStructs.BulkTanimotoSimilarity(query_bv, model.train_fps)
    order = np.argsort(sims)[::-1][:k]
    out: list[NearestNeighbor] = []
    for idx in order:
        i = int(idx)
        out.append(
            NearestNeighbor(
                smiles=model.smiles[i],
                tanimoto=round(float(sims[i]), 3),
                measured_value=round(float(model.values[i]), 3),
                name=model.names[i],
                source=model.spec.source,
            )
        )
    return out


def _not_implemented(endpoint: str) -> PredictionResult:
    return PredictionResult(
        endpoint=endpoint,
        value=None,
        unit="",
        model=ModelInfo(family="not_implemented", version="0.0.0", trained_on="none"),
        uncertainty=Uncertainty(interval=None, method="n/a"),
        applicability_domain=ApplicabilityDomain(
            in_domain=False,
            nearest_neighbor=None,
            note=f"No model is trained for '{endpoint}'. "
            f"Supported endpoints: {supported_endpoints()}.",
        ),
        confidence_grade=ConfidenceGrade.D,
        is_estimated=True,
        note="Prediction model not implemented for this endpoint.",
    )


def predict(endpoint: str, smiles: str) -> PredictionResult:
    if endpoint not in ENDPOINTS:
        # Validate the molecule so callers still get a 422 on garbage input.
        _parse(smiles)
        return _not_implemented(endpoint)

    mol = _parse(smiles)
    model = _model_for(endpoint)
    bv = _fingerprint(mol)
    arr = _to_array(bv).reshape(1, -1)

    per_tree = np.array([est.predict(arr)[0] for est in model.rf.estimators_])
    value = float(per_tree.mean())
    std = float(per_tree.std())

    neighbors = _nearest(model, bv, k=1)
    nn = neighbors[0]
    max_sim = nn.tanimoto
    in_domain = max_sim >= AD_THRESHOLD

    return PredictionResult(
        endpoint=endpoint,
        value=round(value, 3),
        unit=model.spec.unit,
        model=ModelInfo(
            family="RandomForest (ECFP4, scikit-learn)",
            version="0.1.0",
            trained_on=model.spec.source,
        ),
        uncertainty=Uncertainty(
            interval=[round(value - 1.96 * std, 3), round(value + 1.96 * std, 3)],
            method="random-forest tree variance (~95% band)",
        ),
        applicability_domain=ApplicabilityDomain(
            in_domain=in_domain,
            nearest_neighbor=nn,
            note=(
                f"Nearest measured analog Tanimoto={max_sim} "
                f"({'in' if in_domain else 'OUT OF'} domain, threshold {AD_THRESHOLD})."
            ),
        ),
        confidence_grade=_grade(max_sim, std),
        is_estimated=True,
        note="Baseline RandomForest read-across; treat as a prioritization signal.",
    )


def evidence(endpoint: str, smiles: str, k: int = 3) -> EvidenceResult:
    if endpoint not in ENDPOINTS:
        _parse(smiles)
        return EvidenceResult(
            endpoint=endpoint,
            query_smiles=smiles,
            unit="",
            source="none",
            neighbors=[],
        )
    mol = _parse(smiles)
    model = _model_for(endpoint)
    return EvidenceResult(
        endpoint=endpoint,
        query_smiles=smiles,
        unit=model.spec.unit,
        source=model.spec.source,
        neighbors=_nearest(model, _fingerprint(mol), k=k),
    )
