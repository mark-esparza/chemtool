/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server bootstrap: proxy setup, middleware, feature routes, and static/dev
 * serving. Feature logic lives in the sibling modules and ./routes.
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { createServer as createViteServer } from "vite";

import designRoute from "./routes/design.js";
import pubchemRoute from "./routes/pubchem.js";
import evaluateRoute from "./routes/evaluate.js";
import reactionRoute from "./routes/reaction.js";

dotenv.config();

// Route native fetch() through an HTTP(S) proxy when one is configured, so live
// PubChem lookups work in proxied / corporate-egress environments too. No-op when
// no proxy is set (direct outbound access).
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyUrl) {
  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`[Network] Outbound requests routed through proxy: ${proxyUrl}`);
  } catch (e) {
    console.warn("[Network] Could not configure proxy dispatcher:", e instanceof Error ? e.message : e);
  }
}

const app = express();
// Hosting platforms (Render, Cloud Run, etc.) assign the port via the PORT env var.
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Feature API routes.
app.use(reactionRoute);
app.use(pubchemRoute);
app.use(designRoute);
app.use(evaluateRoute);

/** Serve the built client in production, or Vite middleware in development. */
async function configureServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Chemistry studio server booted successfully on port ${PORT}`);
  });
}

configureServer();
