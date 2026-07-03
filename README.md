<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c037d949-48ad-4cd6-b44e-62f7ef18e391

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
