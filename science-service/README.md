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
| `/predict` | POST | **Contract stub.** Returns the provenance envelope (model family, uncertainty, applicability domain, nearest-neighbor evidence, confidence grade). No model is trained yet — the body is a placeholder so the client and UI can be built against the final shape. |

Deterministic descriptor responses carry `is_estimated: false`; everything from
`/predict` carries `is_estimated: true` until real models land (ROADMAP step 3).

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
