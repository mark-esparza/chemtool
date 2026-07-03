/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PubChem search + batch compare routes.
 */

import { Router } from "express";
import { fetchPubChemData } from "../pubchem.js";

const router = Router();

/** Search and pull compound details from the live PubChem database. */
router.get("/api/pubchem/search", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }
  try {
    const data = await fetchPubChemData(q);
    if (!data) {
      return res.status(404).json({ error: `No compound found for query "${q}" on PubChem. Check chemical spelling or SMILES syntax.` });
    }
    return res.json(data);
  } catch (err: any) {
    console.error("PubChem route error: ", err);
    return res.status(500).json({ error: err.message || "An error occurred querying PubChem." });
  }
});

/** Batch search and compare multiple compounds. */
router.post("/api/pubchem/batch", async (req, res) => {
  const { queries } = req.body;
  if (!queries || !Array.isArray(queries)) {
    return res.status(400).json({ error: "Missing or invalid 'queries' parameter inside body." });
  }

  const trimmedQueries = queries.map((q) => String(q).trim()).filter(Boolean).slice(0, 10);
  if (trimmedQueries.length === 0) {
    return res.json({ results: [] });
  }

  try {
    const promises = trimmedQueries.map(async (query) => {
      try {
        const data = await fetchPubChemData(query);
        if (!data) {
          return { query, success: false, error: "Compound not found in PubChem." };
        }
        return { query, success: true, data };
      } catch (err: any) {
        return { query, success: false, error: err.message || "An unknown error occurred while compiling data." };
      }
    });

    const results = await Promise.all(promises);
    return res.json({ results });
  } catch (err: any) {
    console.error("Fatal error during PubChem batch fetching: ", err);
    return res.status(500).json({ error: err.message || "An internal error occurred resolving comparison package." });
  }
});

export default router;
