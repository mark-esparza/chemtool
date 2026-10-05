# Molecule Design Assistant (chemtool)

A deterministic chemistry workbench for the browser. Simulate and balance
chemical reactions with analysis reports, design candidate analogs and score
their molecular properties, and look up any compound live on NIH PubChem.
Every calculation runs on device, so no AI model or API key is involved.

**Author:** Mark Esparza ([ORCID 0009-0000-5171-102X](https://orcid.org/0009-0000-5171-102X)) · [mark-esparza.github.io](https://mark-esparza.github.io)

## Features

- **Reactions:** predict and balance reactions, with a written analysis report
- **Molecule Designer:** generate candidate analogs and score their properties
- **Compound Search:** live PubChem lookups for any compound
- **Metabolites:** look up metabolites in the Human Metabolome Database (HMDB), including where they occur in the body, normal concentrations, associated diseases, and pathways
- **Product Breakdown:** pull a consumer product's ingredient list from the Open Food, Beauty, and Products Facts databases and resolve each ingredient to a chemical on PubChem
- **Compare:** view compounds side by side
- **Lab Notebook:** keep a record of experiments and results

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

No AI/model API key is required — reaction prediction, equation balancing,
molecular property calculation, the design pipeline, and reports all run
deterministically on-device. Compound lookups query the **live** NIH PubChem
REST API on every search, so the host running the server needs outbound network
access to `pubchem.ncbi.nlm.nih.gov`.

## Deploy to Render

This repo includes a [`render.yaml`](render.yaml) blueprint.

1. Push the repo to GitHub.
2. On the [Render dashboard](https://dashboard.render.com), choose **New + → Blueprint**
   and connect this repository. Render reads `render.yaml` automatically.
3. Deploy. No environment variables or secrets are needed.

Render builds with `npm ci --include=dev && npm run build` and starts with
`npm start` (`node dist/server.cjs`). The server binds to the `PORT` Render
provides and serves the prebuilt client from `dist/` because `NODE_ENV=production`.

To configure a Web Service manually instead of using the blueprint, use those
same build and start commands and set `NODE_ENV=production`.

## Citation

If you use this software, please cite it using the metadata in [CITATION.cff](CITATION.cff). GitHub shows a "Cite this repository" button with formatted citations.

## License

Apache License 2.0. See [LICENSE](LICENSE).
