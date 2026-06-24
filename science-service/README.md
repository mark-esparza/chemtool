# Science Service (P0)

RDKit-backed chemistry microservice for the Molecule Design Assistant. This is
**build step P0** from [`../ROADMAP.md`](../ROADMAP.md): it replaces the
hand-rolled SMILES parser / heuristic descriptors in the Node app with RDKit,
and establishes the prediction **provenance envelope** contract.

## What it provides

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | Liveness probe |
| `/descriptors` | POST | Correct RDKit descriptors (MW, Crippen logP, TPSA, HBD/HBA, rotatable bonds, aromatic rings, QED, Lipinski/Veber violations) + canonical SMILES + InChIKey + PAINS/Brenk alerts |
| `/similarity` | POST | Morgan/ECFP Tanimoto similarity between two molecules |
| `/endpoints` | GET | Lists endpoints that have a trained QSAR model |
| `/predict` | POST | QSAR prediction in the provenance envelope (value, model family, uncertainty, applicability domain, nearest-neighbor evidence, confidence grade). Trained endpoints return real values; unknown endpoints return a well-formed "not implemented" envelope |
| `/evidence` | POST | Nearest measured analogs for a molecule from an endpoint's reference dataset (real measured values + Tanimoto) |

Deterministic descriptor responses carry `is_estimated: false`; predictions
carry `is_estimated: true` and a confidence grade.

## Models & data

| Endpoint | Model | Reference dataset |
| --- | --- | --- |
| `solubility_logS` | HistGradientBoosting on ECFP4 (Morgan, 2048-bit) **+ RDKit physicochemical descriptors**, scikit-learn | Delaney **ESOL** (2004), 1128 compounds, measured aqueous log-solubility — `data/esol_solubility.csv` |

Each prediction reports:
- **value** — gradient-boosting point estimate
- **uncertainty** — **split-conformal** interval (~90% marginal coverage),
  calibrated on a held-out residual quantile
- **applicability domain** — Tanimoto to the nearest training compound; below
  0.35 the prediction is flagged out-of-domain and graded down
- **nearest-neighbor evidence** — the closest *measured* compound and its value
- **held-out validation** — R²/RMSE/MAE on a **scaffold split** (harder and more
  honest than a random split, which leaks analogs across the boundary), reported
  in `model.validation` on every prediction

Model and features were chosen by benchmarking combinations on the same scaffold
split: GBM + ECFP + descriptors scores **~0.79 R² (RMSE ≈ 0.92 log units)**,
versus ~0.31 for plain RF on raw fingerprints — physicochemical descriptors
generalize across scaffolds far better than substructure bits for solubility.

Confidence grading reflects this honestly: a query that (near-)matches a
measured compound is graded by read-across; otherwise the grade is bounded by
the model's held-out R². It is a usable prioritization signal, not a substitute
for measurement, and never claims grade A. The model trains lazily on first
request and is cached in memory.

## Run locally

```bash
cd science-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then:

```bash
curl localhost:8000/health
curl -s localhost:8000/descriptors -H 'content-type: application/json' \
  -d '{"smiles":"CC(=O)OC1=CC=CC=C1C(=O)O"}' | python3 -m json.tool
```

Interactive docs: http://localhost:8000/docs

## Tests

```bash
pip install pytest
pytest
```

## Integration with the Node app

The Express server proxies to this service at `SCIENCE_SERVICE_URL`
(default `http://localhost:8000`) via `/api/science/*`. If the service is not
running, the Node app continues to work using its built-in heuristic engine and
the proxy returns `503`. See `../server.ts`.

## Next steps (from ROADMAP)

1. Point the Node pipeline's property evaluation at `/descriptors` and retire
   the heuristic `chemEngine.ts` math.
2. Add nearest-neighbor evidence search (ChEMBL / TDC / EPA CompTox).
3. Train baseline QSAR models (XGBoost/LightGBM on Morgan FP + TDC datasets) and
   fill in `/predict` with real values + conformal uncertainty.
