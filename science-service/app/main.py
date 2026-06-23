"""FastAPI entrypoint for the science service.

P0 scope: RDKit-backed descriptors, fingerprint similarity, and structural
alerts, plus the prediction-endpoint *contract* (the provenance envelope). The
QSAR/ADMET models themselves are not trained yet — `/predict` returns a
well-formed envelope with a "not_implemented" model so the client integration
and UI can be built against the final shape now. See ROADMAP.md.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import chemistry, qsar
from .schemas import (
    DescriptorResult,
    EvidenceRequest,
    EvidenceResult,
    PredictRequest,
    PredictionResult,
    SimilarityRequest,
    SimilarityResult,
    SmilesRequest,
)

app = FastAPI(
    title="Molecule Design Assistant — Science Service",
    version="0.1.0",
    description="RDKit descriptors, fingerprints, alerts, and the prediction "
    "provenance contract.",
)

# The Node BFF is the only intended caller, but keep CORS permissive for local
# development. Tighten the allowed origins before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "science-service", "version": app.version}


@app.post("/descriptors", response_model=DescriptorResult)
def descriptors(req: SmilesRequest) -> DescriptorResult:
    try:
        return chemistry.compute_descriptors(req.smiles)
    except chemistry.InvalidSmilesError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.post("/similarity", response_model=SimilarityResult)
def similarity(req: SimilarityRequest) -> SimilarityResult:
    try:
        return chemistry.tanimoto_similarity(
            req.smiles_a, req.smiles_b, radius=req.radius, n_bits=req.n_bits
        )
    except chemistry.InvalidSmilesError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.get("/endpoints")
def endpoints() -> dict:
    """List endpoints with a trained QSAR model."""
    return {"endpoints": qsar.supported_endpoints()}


@app.post("/predict", response_model=PredictionResult)
def predict(req: PredictRequest) -> PredictionResult:
    """QSAR/ADMET prediction wrapped in the provenance envelope.

    Endpoints with a trained model (see /endpoints) return a real RandomForest
    read-across value with uncertainty, applicability domain, and nearest-neighbor
    evidence. Unknown endpoints return a well-formed "not implemented" envelope.
    """
    try:
        return qsar.predict(req.endpoint, req.smiles)
    except chemistry.InvalidSmilesError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.post("/evidence", response_model=EvidenceResult)
def evidence(req: EvidenceRequest) -> EvidenceResult:
    """Nearest measured analogs for a molecule from an endpoint's reference set."""
    try:
        return qsar.evidence(req.endpoint, req.smiles, k=req.k)
    except chemistry.InvalidSmilesError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
