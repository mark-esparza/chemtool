/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HMDB metabolite lookup routes: single search, and a batch profile used to
 * check which chemicals in the bank are human metabolites.
 */

import { Router } from "express";
import { fetchMetabolite } from "../hmdb.js";
import type { HmdbBatchResult } from "../../src/types/index.js";

const router = Router();

/** Look up a human metabolite by name or HMDB accession (live HMDB data). */
router.get("/api/hmdb/search", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }
  try {
    const data = await fetchMetabolite(q);
    if (!data) {
      return res.status(404).json({ error: `No metabolite found for "${q}" in HMDB. Try a common name (e.g. "glucose", "dopamine", "cholesterol") or an HMDB ID.` });
    }
    return res.json(data);
  } catch (err: any) {
    console.error("HMDB route error: ", err);
    return res.status(500).json({ error: err.message || "An error occurred querying HMDB." });
  }
});

const BATCH_CAP = 10;
const BATCH_CONCURRENCY = 3;

/** Profile several chemicals against HMDB at once (bounded concurrency to be gentle on HMDB). */
router.post("/api/hmdb/batch", async (req, res) => {
  const { queries } = req.body ?? {};
  if (!Array.isArray(queries)) {
    return res.status(400).json({ error: "Missing or invalid 'queries' array in body." });
  }
  const list = queries.map((q) => String(q).trim()).filter(Boolean).slice(0, BATCH_CAP);

  const results: HmdbBatchResult[] = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      const query = list[i];
      try {
        const data = await fetchMetabolite(query);
        results[i] = data ? { query, success: true, data } : { query, success: false, error: "Not a known human metabolite in HMDB." };
      } catch (err: any) {
        results[i] = { query, success: false, error: err.message || "HMDB lookup failed." };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, list.length) }, worker));
  return res.json({ results });
});

export default router;
