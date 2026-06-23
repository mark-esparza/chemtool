# Molecule Design Assistant

A research-prototype web app that turns a natural-language design goal into a
structured brief, generates candidate molecular analogs, scores them with a
deterministic cheminformatics engine, ranks them on a multi-objective Pareto
front, and writes an explainable report.

> ⚠️ **Prototype / educational use only.** The property values (cLogP, TPSA,
> QED, SA score, "docking affinity", binding residues, etc.) are computed from
> fast **heuristics over the 2D structure graph** — they are not experimental
> measurements, quantum calculations, or real docking simulations. When the
> live PubChem lookup fails, compound data is filled in from a small built-in
> dataset or generated as a labeled placeholder. Do not use this for real
> medicinal-chemistry or safety decisions.

## Features

- **Design Studio** — prompt → Gemini design brief → analog generation →
  deterministic property evaluation → Pareto ranking → audit report. Every
  Gemini step has a local fallback, so the pipeline still runs offline / when
  the API quota is exhausted.
- **PubChem lookup** — live [PubChem PUG REST](https://pubchem.ncbi.nlm.nih.gov/)
  queries with graceful fallback. Results are flagged `is_estimated` and
  labeled in the UI when the data is AI-generated or a placeholder rather than
  real PubChem data.
- **Batch matrix** — compare several compounds side by side.
- **SMILES sandbox** — paste any SMILES and see the engine's computed
  properties.
- **3D viewer** — a custom SVG ball-and-stick / space-filling / skeletal
  renderer driven by an in-browser spring-layout solver.
- **Lab ledger** — log experiment outcomes (stored in `localStorage`) and feed
  them back into the design pipeline as closed-loop context.

## Architecture

- **Frontend:** React 19 + Vite + Tailwind v4 (`src/`).
- **Server:** a single Express app (`server.ts`) run with `tsx`. In dev it
  mounts Vite as middleware; in prod it serves the built `dist/`.
- **Chemistry engine:** `src/lib/chemEngine.ts` — a dependency-free SMILES
  parser and property calculator (MW, formula, HBD/HBA, rotatable bonds, cLogP
  and TPSA estimates, QED, SA score, structural-alert checks, Tanimoto
  similarity).
- **LLM:** Google Gemini via `@google/genai`, called server-side only.

## Run locally

**Prerequisites:** Node.js 18+.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env.local` and set your Gemini API key (see `.env.example`):
   ```
   GEMINI_API_KEY="your-key-here"
   ```
   The app still runs without a key — every Gemini step falls back to local
   logic.
3. Start the dev server:
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000.

## Scripts

| Command         | Description                                            |
| --------------- | ------------------------------------------------------ |
| `npm run dev`   | Start the Express + Vite dev server on port 3000.      |
| `npm run build` | Build the client and bundle the server to `dist/`.     |
| `npm start`     | Run the production build.                              |
| `npm run lint`  | Type-check with `tsc --noEmit`.                        |
| `npm test`      | Run the chemistry-engine unit tests.                   |

## Tests

`npm test` runs `src/lib/chemEngine.test.ts` (Node's built-in test runner via
`tsx`), covering SMILES bond-order parsing, molecular-weight calculation,
Tanimoto similarity, and graceful handling of malformed input.
