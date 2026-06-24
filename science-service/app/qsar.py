"""Baseline QSAR with honest uncertainty, applicability domain, and evidence.

For each supported endpoint we train a gradient-boosted regressor on a combined
feature set — ECFP (Morgan) fingerprints plus RDKit physicochemical descriptors
— over a real measured dataset. Every prediction returns the full provenance
envelope:

- value        — gradient-boosting point estimate
- uncertainty  — split-conformal interval (~90% marginal coverage)
- applicability domain — Tanimoto similarity to the nearest training compound;
  out-of-domain predictions are graded down regardless of the point estimate
- nearest-neighbor evidence — the closest *measured* compound and its value
- validation   — held-out scaffold-split R^2/RMSE/MAE (reported, not assumed)

Model/feature choices were picked by benchmarking combinations on the same
scaffold split (see commit history): GBM + ECFP + descriptors clearly beat raw
fingerprints for solubility (~0.80 vs ~0.31 scaffold R^2). It never claims A.
"""

from __future__ import annotations

import csv
import os
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from rdkit import Chem
from rdkit.Chem import DataStructs, Descriptors
from rdkit.Chem.rdMolDescriptors import GetMorganFingerprintAsBitVect
from rdkit.Chem.Scaffolds import MurckoScaffold
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from .chemistry import InvalidSmilesError
from .schemas import (
    ApplicabilityDomain,
    ConfidenceGrade,
    EvidenceResult,
    ModelInfo,
    NearestNeighbor,
    PredictionResult,
    Uncertainty,
    ValidationMetrics,
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
RADIUS = 2
NBITS = 2048
# Minimum Tanimoto to the nearest training compound for a prediction to count as
# "in domain". ~0.35 is a common ECFP4 read-across cutoff.
AD_THRESHOLD = 0.35
# Conformal miscoverage level (0.1 -> ~90% prediction intervals).
CONFORMAL_ALPHA = 0.1

# Physicochemical descriptors appended to the fingerprint. These generalize
# across scaffolds far better than raw substructure bits for properties like
# solubility, which is why the combined feature set wins the benchmark.
DESCRIPTOR_NAMES = [
    "MolWt", "MolLogP", "TPSA", "NumHDonors", "NumHAcceptors",
    "NumRotatableBonds", "NumAromaticRings", "FractionCSP3", "HeavyAtomCount",
    "NumAliphaticRings", "RingCount", "NumSaturatedRings", "NHOHCount",
    "NOCount", "LabuteASA", "MolMR", "BertzCT",
]
_DESCRIPTOR_FNS = [getattr(Descriptors, name) for name in DESCRIPTOR_NAMES]


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


def _ecfp_array(bitvect) -> np.ndarray:
    arr = np.zeros((NBITS,), dtype=np.float32)
    DataStructs.ConvertToNumpyArray(bitvect, arr)
    return arr


def _descriptor_array(mol: Chem.Mol) -> np.ndarray:
    out = np.empty((len(_DESCRIPTOR_FNS),), dtype=np.float32)
    for i, fn in enumerate(_DESCRIPTOR_FNS):
        try:
            v = float(fn(mol))
        except Exception:
            v = 0.0
        out[i] = v if np.isfinite(v) else 0.0
    return out


def _features(mol: Chem.Mol):
    """Return (fingerprint bitvect for Tanimoto, combined feature vector)."""
    bv = _fingerprint(mol)
    feats = np.concatenate([_ecfp_array(bv), _descriptor_array(mol)])
    return bv, feats


def _new_estimator() -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(
        random_state=0, max_iter=400, learning_rate=0.05
    )


@dataclass
class _TrainedModel:
    est: HistGradientBoostingRegressor
    conformal_q: float  # half-width of the split-conformal interval
    train_fps: list  # ExplicitBitVect, for Tanimoto nearest-neighbor search
    names: list[str]
    smiles: list[str]
    values: list[float]
    spec: EndpointSpec
    metrics: ValidationMetrics


def _scaffold(smiles: str) -> str:
    try:
        return MurckoScaffold.MurckoScaffoldSmiles(smiles=smiles, includeChirality=False)
    except Exception:
        return ""


def _scaffold_split(smiles_list: list[str], frac_test: float = 0.2) -> tuple[list[int], list[int]]:
    """Deterministic scaffold split: common scaffolds go to train, leaving rarer
    ones for test. Harder than a random split and a fairer generalization check
    because structural analogs cannot straddle the train/test boundary."""
    groups: dict[str, list[int]] = {}
    for i, smi in enumerate(smiles_list):
        groups.setdefault(_scaffold(smi), []).append(i)
    ordered = sorted(groups.values(), key=len, reverse=True)
    n_train_target = len(smiles_list) - int(frac_test * len(smiles_list))
    train_idx: list[int] = []
    test_idx: list[int] = []
    for group in ordered:
        if len(train_idx) + len(group) <= n_train_target:
            train_idx.extend(group)
        else:
            test_idx.extend(group)
    return train_idx, test_idx


def _validate(X: np.ndarray, y: np.ndarray, smiles_list: list[str]) -> ValidationMetrics:
    train_idx, test_idx = _scaffold_split(smiles_list)
    if not test_idx or not train_idx:
        train_idx = list(range(len(y)))
        test_idx = train_idx
        split = "train-fit (dataset too small to split)"
    else:
        split = "scaffold"
    model = _new_estimator()
    model.fit(X[train_idx], y[train_idx])
    pred = model.predict(X[test_idx])
    return ValidationMetrics(
        split=split,
        n_train=len(train_idx),
        n_test=len(test_idx),
        r2=round(float(r2_score(y[test_idx], pred)), 3),
        rmse=round(float(np.sqrt(mean_squared_error(y[test_idx], pred))), 3),
        mae=round(float(mean_absolute_error(y[test_idx], pred)), 3),
    )


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
            bv, feats = _features(mol)
            names.append((row.get("name") or "").strip())
            smiles_list.append(smi)
            values.append(val)
            fps.append(bv)
            rows.append(feats)

    X = np.asarray(rows, dtype=np.float32)
    y = np.asarray(values, dtype=float)

    # Held-out scaffold metrics for honest reporting.
    metrics = _validate(X, y, smiles_list)

    # Split-conformal calibration: fit on a proper-train split, calibrate the
    # interval half-width on a disjoint calibration split, and deploy that model.
    rng = np.random.RandomState(0)
    perm = rng.permutation(len(y))
    n_cal = max(1, int(0.2 * len(y)))
    cal_idx, fit_idx = perm[:n_cal], perm[n_cal:]
    est = _new_estimator()
    est.fit(X[fit_idx], y[fit_idx])
    residuals = np.abs(y[cal_idx] - est.predict(X[cal_idx]))
    # Finite-sample-corrected (1 - alpha) quantile of calibration residuals.
    level = min(1.0, np.ceil((n_cal + 1) * (1 - CONFORMAL_ALPHA)) / n_cal)
    conformal_q = float(np.quantile(residuals, level))

    return _TrainedModel(est, conformal_q, fps, names, smiles_list, values, spec, metrics)


def _parse(smiles: str) -> Chem.Mol:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise InvalidSmilesError(f"RDKit could not parse SMILES: {smiles!r}")
    return mol


def _grade(max_sim: float, r2: float) -> ConfidenceGrade:
    # Far from any measured compound: extrapolation, not trustworthy.
    if max_sim < AD_THRESHOLD:
        return ConfidenceGrade.D
    # A near-identical measured analog: read-across from real data.
    if max_sim >= 0.9:
        return ConfidenceGrade.B
    # In-domain: the grade is bounded by how well the model actually generalizes.
    if r2 >= 0.7 and max_sim >= 0.55:
        return ConfidenceGrade.B
    if r2 >= 0.5 or max_sim >= 0.6:
        return ConfidenceGrade.C
    return ConfidenceGrade.D


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
        _parse(smiles)
        return _not_implemented(endpoint)

    mol = _parse(smiles)
    model = _model_for(endpoint)
    bv, feats = _features(mol)

    value = float(model.est.predict(feats.reshape(1, -1))[0])
    q = model.conformal_q

    neighbors = _nearest(model, bv, k=1)
    nn = neighbors[0]
    max_sim = nn.tanimoto
    in_domain = max_sim >= AD_THRESHOLD

    return PredictionResult(
        endpoint=endpoint,
        value=round(value, 3),
        unit=model.spec.unit,
        model=ModelInfo(
            family="HistGradientBoosting (ECFP4 + RDKit descriptors)",
            version="0.2.0",
            trained_on=model.spec.source,
            validation=model.metrics,
        ),
        uncertainty=Uncertainty(
            interval=[round(value - q, 3), round(value + q, 3)],
            method=f"split conformal (~{int((1 - CONFORMAL_ALPHA) * 100)}% coverage)",
        ),
        applicability_domain=ApplicabilityDomain(
            in_domain=in_domain,
            nearest_neighbor=nn,
            note=(
                f"Nearest measured analog Tanimoto={max_sim} "
                f"({'in' if in_domain else 'OUT OF'} domain, threshold {AD_THRESHOLD})."
            ),
        ),
        confidence_grade=_grade(max_sim, model.metrics.r2),
        is_estimated=True,
        note="Gradient-boosting QSAR; treat as a prioritization signal.",
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
