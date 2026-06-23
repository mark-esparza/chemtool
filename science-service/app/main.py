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

from . import chemistry
from .schemas import (
    ApplicabilityDomain,
    ConfidenceGrade,
    DescriptorResult,
    ModelInfo,
    PredictRequest,
    PredictionResult,
    SimilarityRequest,
    SimilarityResult,
    SmilesRequest,
    Uncertainty,
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


@app.post("/predict", response_model=PredictionResult)
def predict(req: PredictRequest) -> PredictionResult:
    """Contract stub for QSAR/ADMET endpoints.

    Validates the molecule with RDKit, then returns the provenance envelope with
    a placeholder model so downstream code can integrate against the final shape.
    Replace the body with a real trained model per ROADMAP build step 3.
    """
    try:
        chemistry.compute_descriptors(req.smiles)  # validate SMILES
    except chemistry.InvalidSmilesError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return PredictionResult(
        endpoint=req.endpoint,
        value=None,
        unit="",
        model=ModelInfo(family="not_implemented", version="0.0.0", trained_on="none"),
        uncertainty=Uncertainty(interval=None, method="n/a"),
        applicability_domain=ApplicabilityDomain(
            in_domain=False,
            nearest_neighbor=None,
            note="No model trained yet for this endpoint.",
        ),
        confidence_grade=ConfidenceGrade.D,
        is_estimated=True,
        note="Prediction model not implemented; this is the contract shape only.",
    )
