"""Tests for the baseline QSAR predictor and nearest-neighbor evidence.

These train a RandomForest on the bundled ESOL dataset, so they are a little
slower than the descriptor tests.
"""

import pytest

from app import qsar
from app.chemistry import InvalidSmilesError
from app.schemas import ConfidenceGrade


def test_supported_endpoints_includes_solubility():
    assert "solubility_logS" in qsar.supported_endpoints()


def test_predict_solubility_envelope_shape():
    # Ethanol — fully water-miscible, high (near 0 / positive) logS expected.
    res = qsar.predict("solubility_logS", "CCO")
    assert res.endpoint == "solubility_logS"
    assert res.unit == "log(mol/L)"
    assert res.value is not None
    assert res.model.family.startswith("HistGradientBoosting")
    # Envelope is fully populated.
    assert res.uncertainty.interval is not None and len(res.uncertainty.interval) == 2
    assert res.applicability_domain.nearest_neighbor is not None
    assert 0.0 <= res.applicability_domain.nearest_neighbor.tanimoto <= 1.0
    # Ethanol is well inside a solubility dataset's domain.
    assert res.applicability_domain.in_domain is True
    # It (near-)matches a measured compound, so it is read-across, not extrapolation.
    assert res.confidence_grade != ConfidenceGrade.D


def test_predict_orders_soluble_above_insoluble():
    soluble = qsar.predict("solubility_logS", "CCO").value          # ethanol
    greasy = qsar.predict("solubility_logS", "CCCCCCCCCCCCCCCC").value  # hexadecane
    # Higher logS == more soluble. The model should rank ethanol well above a
    # long alkane even if absolute values are approximate.
    assert soluble > greasy


def test_prediction_carries_holdout_validation_metrics():
    res = qsar.predict("solubility_logS", "CCO")
    v = res.model.validation
    assert v is not None
    assert v.split == "scaffold"
    assert v.n_train > 0 and v.n_test > 0
    # ESOL is a well-behaved solubility set; a scaffold-split RF should be
    # clearly predictive (R^2 well above zero) without being suspiciously perfect.
    assert 0.3 < v.r2 < 0.95
    assert v.rmse > 0 and v.mae > 0


def test_unknown_endpoint_returns_not_implemented_envelope():
    res = qsar.predict("hERG_blockade", "CCO")
    assert res.value is None
    assert res.model.family == "not_implemented"
    assert res.confidence_grade == ConfidenceGrade.D


def test_evidence_returns_measured_neighbors():
    ev = qsar.evidence("solubility_logS", "CC(=O)OC1=CC=CC=C1C(=O)O", k=3)
    assert len(ev.neighbors) == 3
    assert ev.neighbors[0].tanimoto >= ev.neighbors[1].tanimoto  # sorted desc
    assert ev.neighbors[0].measured_value is not None
    assert "Delaney" in ev.source


def test_invalid_smiles_raises():
    with pytest.raises(InvalidSmilesError):
        qsar.predict("solubility_logS", "not-a-smiles-@@@")
