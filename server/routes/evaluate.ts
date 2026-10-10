/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SMILES property evaluation route.
 */

import { Router } from "express";
import { calculateProperties } from "../../src/lib/chemEngine.js";

const router = Router();

/** Evaluate deterministic molecular properties for a single SMILES string. */
router.post("/api/evaluate", (req, res) => {
  const { smiles } = req.body;
  if (!smiles || typeof smiles !== "string") {
    return res.status(400).json({ error: "SMILES parameter is required as string." });
  }
  try {
    res.json(calculateProperties(smiles));
  } catch (e: any) {
    // A structure this engine cannot parse is a bad request, not a server
    // fault, and it must never be answered with placeholder properties.
    res.status(400).json({ error: `That structure could not be parsed: ${e?.message || "invalid SMILES"}.` });
  }
});

export default router;
