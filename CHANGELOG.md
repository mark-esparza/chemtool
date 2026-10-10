# Changelog

## v2.0.0 — unreleased

A corrective release. Several v1 outputs looked like measurements but were not
supported by any calculation; they have been removed rather than relabelled, and
the interface was rebuilt around retrieval from named databases.

**If you used v1 outputs in any analysis, re-check them against this list.**

### Removed: values with no method behind them

These were computed by fixed formulas over simple descriptors. They carried
physical units and specific entity names, which made them read as results.

- **`docking_affinity`** — a binding energy in kcal/mol derived from logP, ring
  count and rotatable bonds, clamped to −11.5…−3.5. No structure, no protein and
  no docking were involved.
- **`target_protein`** and **`binding_residues`** — a protein name (e.g. "COX-2",
  "Dopamine D2 Receptor") and a residue contact list assigned by matching
  substrings of the SMILES *text*. No target prediction of any kind was performed.
- **`pocket_fit_score`** — a percentage derived from the drug-likeness index. No
  pocket was identified or evaluated.
- **`conformer_energy`** — a strain energy in kcal/mol from atom and bond counts.
  No conformer was generated.
- **`solubility_level`** and **`toxicity_risk`** — categorical labels thresholded
  off the logP estimate and the alert count.
- **The design pipeline's analysis report** — fixed narrative text asserting that
  retrosynthetic planning, PubChem and ChEMBL similarity-cluster queries and
  toxicophore screens had been run, with a pre-clinical assay plan and numeric
  success criteria. None of those procedures existed in the code.
- **Reaction condition optimisation** — temperature, concentration and catalyst
  controls that produced a yield/efficacy percentage from a fixed formula. No
  kinetics or thermodynamics were modelled.
- **The seeded notebook entry** — a fabricated assay result (`IC50 = 240 nM`,
  "validated in vitro") shipped as the notebook's default content.

### Fixed: incorrect calculations

- **Parse failures returned aspirin's properties.** Any structure the parser could
  not read was silently reported with formula `C9H8O4`, mass 180.15, logP 1.2 and
  so on. Parse failures now raise an error and are surfaced as such; no
  placeholder values are ever substituted.
- **Rotatable bonds counted ring bonds.** Cyclohexane reported six rotatable
  bonds. Ring membership is now determined by a bridge test, and the amide C–N
  exclusion — previously dead code (`const isAmideOrEster = false`) — works.
- **Structural alerts matched substrings of the SMILES string.** The same
  molecule written two ways gave different answers; some patterns could never
  match because the string had been lower-cased first, while
  `lowerSmiles.includes("c1ccccc1")` matched nearly every aromatic compound.
  Replaced by functional-group detection on the parsed graph.
- **Aromatic nitrogen used the aliphatic TPSA contribution.** Now uses Ertl's
  aromatic value.

### Renamed: metrics that borrowed a published name

The calculations are unchanged; the names were misattributions.

- `qed` → **`desirability_index`**. It is an unweighted geometric mean of six
  Gaussian terms, not Bickerton et al.'s QED (no fitted ADS functions, no
  weighting, no aromatic-ring or alert terms).
- `sa_score` → **`complexity_index`**. It is a size and flexibility proxy, not the
  Ertl–Schuffenhauer synthetic accessibility score, and implies nothing about
  synthetic routes.
- `clogp` → **`logp_estimate`**. It is an atom-additive estimate, not Crippen
  cLogP or XLogP3. Where a PubChem CID is known the interface now shows PubChem's
  XLogP3 beside it.
- `structural_alerts` → **`functional_groups`**, with the PAINS/Brenk attribution
  dropped. Presence of a group is not a liability claim.

### Added

- **Analog search** replaces the design pipeline. v1 generated "analogs" by
  concatenating fragments onto the seed's SMILES text (`seed + "(F)"`,
  `"O=" + seed`, `seed.replace("O", "S")`), which produces structures that are
  frequently invalid and never verified to exist. v2 retrieves the seed's 2D
  similarity neighborhood from PubChem, so every candidate is a deposited
  compound with a CID that can be looked up and cited.
- **PubChem values shown beside on-device values** for every candidate, with
  material disagreements flagged, so the approximations can be checked against a
  reference.
- **Query provenance** — seed CID, similarity threshold, record cap and retrieval
  timestamp are shown in-app and written into the CSV header.
- **Methods page** stating, for every value, how it is produced and what it does
  not establish.
- Explicit descriptor filters with a Pareto-optimal subset, reported only when two
  or more bounds are set.
- Richer HMDB records: enzymes and transporters with gene and UniProt identifiers,
  cellular locations, chemical classification, and KEGG/ChEBI/DrugBank
  cross-references. Legacy 5-digit HMDB accessions are accepted, and an HMDB
  bot-check page is now treated as an outage rather than parsed as data.
- Unit tests (`npm test`) covering the property engine, HMDB parsing and
  resolution, and the API routes. Run in CI alongside the type check.

### Removed: out of scope

- **Product Breakdown** — consumer-product ingredient lookup via Open Food /
  Beauty / Products Facts and openFDA drug labels. Not relevant to the research
  aims of the tool.

### Interface

Rebuilt as a plain document-style page in the idiom of early scientific web tools:
system fonts of that era, bordered data tables, horizontal rules and ordinary form
controls. Tailwind, the icon set and the web-font imports were dropped in favour
of one hand-written stylesheet, removing five runtime and build dependencies.
Data tables carry `scope="col"` so assistive technology announces their headers.

## v1.0.0 — 2026

Initial release archived on Zenodo ([10.5281/zenodo.23167242](https://doi.org/10.5281/zenodo.23167242)).
