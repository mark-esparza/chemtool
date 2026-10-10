# Chemtool

A browser workbench for retrieving and comparing chemical and metabolite records
from public databases. It queries PubChem and the Human Metabolome Database live,
recomputes a set of structural descriptors on-device from the parsed structure,
and shows both side by side so they can be checked against each other.

Every figure it displays is either retrieved from a named database or computed
from a documented calculation, and the in-app **Methods** page states which is
which, and what each value does not establish.

**Author:** Mark Esparza ([ORCID 0009-0000-5171-102X](https://orcid.org/0009-0000-5171-102X)) · [mark-esparza.github.io](https://mark-esparza.github.io)

## Features

- **Compounds** — resolve any compound on PubChem by name, formula, SMILES or CID
  (misspellings corrected through PubChem's autocomplete) and read its record.
  Compounds that PubChem cross-references to HMDB are flagged as human metabolites.
- **Analogs** — retrieve the 2D-similarity neighborhood of a seed compound from
  PubChem's `fastsimilarity_2d` service. Every candidate is a real deposited
  compound with its own CID. Filter the set on computed descriptors, see the
  Pareto-optimal subset when two or more bounds are set, and export the result
  with its full query provenance as CSV.
- **Metabolites** — any entry in HMDB by name or accession: biofluid, tissue and
  cellular locations, reported normal concentrations, associated conditions,
  pathways, the enzymes and transporters that act on it, and cross-references to
  PubChem, KEGG, ChEBI, DrugBank and UniProt. Pathway rows link to SMPDB, KEGG,
  BioModels and Reactome for loading into a simulator.
- **Compare** — tabulate PubChem descriptors for up to ten compounds at once.
- **Reactions** — propose products from a pattern knowledge base, solve the
  stoichiometry, and verify the balance by re-counting atoms on both sides.
- **Notebook** — a local record of queries run and conclusions drawn, exportable
  as CSV. Starts empty and is never written to automatically.

Features hand off to one another: a compound record can seed an analog search, a
metabolite can open its PubChem record or a reaction, and the chemical bank can be
checked against HMDB in bulk to see which collected chemicals the body also makes.

## What it does not do

It does not predict binding affinity, protein targets, docking poses, toxicity,
metabolic fate, synthetic routes or yields. Versions before v2 displayed values of
those kinds; they were produced by fixed formulas over simple descriptors rather
than by any structural or pharmacological calculation, and have been removed rather
than relabelled. See [CHANGELOG.md](CHANGELOG.md).

For protein–ligand work use a structure-based tool; for metabolite prediction use a
validated biotransformation engine; for reference descriptor implementations use
RDKit.

## Descriptors computed on-device

Used as a fallback for structures not in PubChem, and as a cross-check against
PubChem's own values. Naming is literal: where a value is a coarse estimate it is
named as an estimate, so it is not mistaken for the published metric it resembles.

| Value | Method | Note |
| --- | --- | --- |
| Formula, average mass | Atom counts, standard atomic weights | — |
| TPSA | Ertl et al. (2000) fragment contributions | Simplified: one sulfur value, phosphorus not counted |
| `logp_estimate` | Atom-additive per-element increments | **Not** Crippen cLogP or XLogP3; prefer PubChem's XLogP3 where a CID is known |
| HBD / HBA | Lipinski's N+O counts | — |
| Rotatable bonds | Acyclic single bonds between non-terminal heavy atoms, excluding amide C–N | Ring membership by bridge test |
| Ring counts | Cyclomatic number of the graph and of its aromatic subgraph | — |
| Lipinski / Veber violations | Published cut-offs applied to the above | Inherits the logP estimate's error |
| `desirability_index` | Unweighted geometric mean of six Gaussian desirability terms | **Not** Bickerton QED; for ordering one result set only |
| `complexity_index` | Heavy-atom count, rings and flexibility, scaled 1–10 | **Not** the Ertl–Schuffenhauer SA score; says nothing about synthesis |
| `functional_groups` | Local connectivity read off the structure graph | Descriptive; **not** PAINS, Brenk or any published alert set |

A structure that cannot be parsed raises an error. The tool never substitutes
placeholder values for a failed calculation.

## Run locally

Prerequisites: Node.js 18.18 or newer.

```sh
npm install
npm run dev     # http://localhost:3000
npm run lint    # tsc --noEmit
npm test        # node:test via tsx, no network required
```

The server needs outbound access to `pubchem.ncbi.nlm.nih.gov` and `hmdb.ca`.
HMDB responses are cached in memory for six hours. No API key is required and no
model is involved: every calculation is deterministic and runs on device.

## Deploy to Render

This repo includes a [`render.yaml`](render.yaml) blueprint. On the
[Render dashboard](https://dashboard.render.com) choose **New + → Blueprint** and
connect the repository; Render reads the blueprint automatically. It builds with
`npm ci --include=dev && npm run build` and starts with `npm start`. No secrets are
needed.

## Citation

If you use this software, please cite it using the metadata in
[CITATION.cff](CITATION.cff), and cite the underlying databases for any data it
retrieved — see the Sources section of the in-app Methods page.

## License

Apache License 2.0. See [LICENSE](LICENSE).
