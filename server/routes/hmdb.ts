/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HMDB metabolite lookup route.
 */

import { Router } from "express";
import { fetchMetabolite } from "../hmdb.js";

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

export default router;
