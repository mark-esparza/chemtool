# Roadmap: From heuristic prototype to credible property prediction

## Where we are

The current app computes every property — MW, cLogP, TPSA, QED, SA score,
"docking affinity", binding residues, conformer energy — from fast heuristics
over a hand-rolled 2D SMILES parser. These are **estimates, not measurements**,
and the UI now labels them as such (`is_estimated` flag, "Unverified estimate"
badges, heuristic warnings on the binding panel).

That labeling work is the foundation for everything below. The goal of this
roadmap is to replace the toy math with real, reproducible prediction tools
while keeping a single rule front and center:

> **Never report one model's output as fact.** Every prediction ships with:
> prediction + model family + applicability-domain warning + nearest-neighbor
> evidence + uncertainty/confidence grade.

## The core architectural constraint

Almost every credible tool in this space is **Python** or an **external web
service**. None can be added to this Node/React app directly:

- **Python libraries:** RDKit, DeepChem, Chemprop, scikit-learn / XGBoost /
  LightGBM, TDC, Psi4, xTB, CP2K
- **Web services / dashboards:** EPA CompTox, ToxCast, ProTox 3.0,
  ADMETlab 3.0, admetSAR 3.0

So integration is really **one decision**: stand up a **Python "science
service" (FastAPI)** alongside the Express server. Node remains the UI gateway
/ BFF and calls the Python service over HTTP for all chemistry. xTB/Psi4 run
behind a job queue.

```
React ──HTTP──> Express (BFF, LLM orchestration, PubChem proxy)
                  │
                  └──HTTP──> Python science service (FastAPI)
                               ├─ RDKit: descriptors, fingerprints, alerts
                               ├─ QSAR: sklearn/XGBoost → Chemprop
                               ├─ Evidence: ChEMBL / TDC / CompTox NN search
                               └─ Queue: xTB / Psi4 (on demand)
```

## The biggest gap: RDKit comes first

Before any ML, the foundation is **RDKit** (open source, BSD). It replaces the
hand-rolled parser and heuristic descriptors with correct MW, Crippen logP,
TPSA, HBD/HBA, ring counts, Morgan fingerprints, Tanimoto, and real PAINS /
Brenk substructure filters. This deletes the entire class of parser-correctness
bugs (e.g. the dropped-double-bond bug) by removing the home-grown engine.

**Do this first — everything else builds on it.**

## Tool integration matrix

| Tool | Mechanism | Priority | Notes |
| --- | --- | --- | --- |
| **RDKit** | Python service | **P0 — foundation** | Replaces the toy engine; correct descriptors / fingerprints / alerts |
| **TDC (Therapeutics Data Commons)** | Pre-downloaded datasets | **P0 / P1** | AI-ready datasets (BBB, hERG, CYP, AMES, Caco-2, LD50…). Train our own baselines + use as nearest-neighbor evidence |
| **EPA CompTox / ToxCast** | Public APIs + bulk download (US-gov, redistributable) | **P1** | Real measured / curated hazard + bioactivity → best evidence grounding |
| **scikit-learn / XGBoost / LightGBM** | Python service on RDKit FP + TDC | **P1 — first real predictions** | Easy uncertainty (ensemble / conformal) + applicability domain (Tanimoto-to-train). Best ROI ML |
| **Chemprop v2** | Python service (PyTorch MPNN) | **P2** | Better on larger datasets; built-in uncertainty (ensembles / evidential); heavier |
| **DeepChem** | Python service | **P2 / optional** | Broad toolkit; advanced, not core |
| **xTB / GFN-xTB** | Python service, on demand | **P2** | Fast semiempirical — real conformer energy / charges to replace fabricated values |
| **Psi4** | Job queue, on demand only | **P3** | DFT / HF, seconds–minutes per molecule; rare deep dives |
| **CP2K / ORCA / Gaussian** | — | **out of scope** | Too heavy for interactive web; Gaussian / ORCA also commercial |
| **ADMETlab 3.0 / admetSAR 3.0 / ProTox 3.0** | External HTTP, cautiously | **P3 / cross-check only** | Academic web servers — verify ToS for programmatic access; expect rate limits / instability / no uptime guarantee. Prefer our own TDC-trained models for core endpoints; use these as labeled third-party cross-checks behind a feature flag, cached |

## The contract that generalizes everything

Make every prediction return the same **provenance envelope**. This is the
integrity rule turned into a schema, and a direct extension of the existing
`is_estimated` flag:

```json
{
  "endpoint": "BBB_penetration",
  "value": 0.82,
  "unit": "logBB",
  "model": { "family": "XGBoost", "version": "1.3", "trained_on": "TDC/BBB_Martins" },
  "uncertainty": { "interval": [0.55, 1.05], "method": "conformal" },
  "applicability_domain": {
    "in_domain": true,
    "nearest_neighbor": {
      "smiles": "...",
      "tanimoto": 0.71,
      "measured_value": 0.9,
      "source": "ChEMBL/CompTox"
    }
  },
  "confidence_grade": "B"
}
```

Nail this contract once and every tool above plugs into it. The UI renders it
as a confidence panel (grade badge, uncertainty interval, "closest measured
analog" evidence row, in/out-of-domain warning).

## Build sequence

1. **RDKit microservice** — swap out the heuristic engine (descriptors,
   fingerprints, Tanimoto, PAINS / Brenk). Biggest correctness win.
2. **Nearest-neighbor evidence** — index ChEMBL / TDC / CompTox by InChIKey;
   return the closest *measured* analog by fingerprint similarity. Cheap,
   high-trust grounding.
3. **Baseline QSAR** — _in progress._ A RandomForest (ECFP4, scikit-learn) is
   live for aqueous solubility (`solubility_logS`), trained on the measured
   Delaney ESOL dataset, with ensemble-variance uncertainty, Tanimoto
   applicability domain, and nearest-neighbor evidence served via `/predict` and
   `/evidence`. Still to do: more endpoints (BBB, hERG, CYP, AMES, Caco-2, LD50)
   from TDC, conformal intervals, and held-out validation metrics per endpoint.
4. **Provenance / confidence panel** in the UI — extend `is_estimated` into the
   full envelope above.
5. **Chemprop v2** for endpoints where the MPNN beats baselines.
6. **xTB on demand** — real conformer energy / charges; **Psi4** job queue for
   occasional deep dives.
7. **Optional** ADMETlab / ProTox cross-checks — clearly labeled third-party,
   cached, ToS permitting.

## Two non-negotiables

- **The LLM must stop inventing numbers.** Today Gemini fabricates "realistic"
  property values in the fallback path. Once real predictors exist, the LLM's
  job is orchestration + explanation only — never the source of a number.
- **Licensing / ToS.** RDKit, Psi4, xTB, DeepChem, Chemprop, scikit-learn,
  XGBoost, LightGBM, the TDC datasets, and EPA CompTox / ToxCast data are open
  and safe to ship / redistribute (confirm each license). The three ADMET *web
  servers* are the risk — do not scrape; verify programmatic-access terms
  first.

## Scope note

This is a multi-week effort and a stack change (a Python sidecar alongside the
existing Node app), not a patch. The labeling and correctness fixes already
landed make the prototype honest in the meantime; this roadmap is the path to
making it credible.
