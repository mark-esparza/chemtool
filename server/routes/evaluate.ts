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
    const props = calculateProperties(smiles);
    res.json(props);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Invalid SMILES structure." });
  }
});

export default router;
