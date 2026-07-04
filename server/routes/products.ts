/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Product ingredient-breakdown route.
 */

import { Router } from "express";
import { fetchProductBreakdown } from "../products.js";

const router = Router();

/** Break a consumer product down into its ingredient list (live Open Facts data). */
router.get("/api/product/search", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }
  try {
    const data = await fetchProductBreakdown(q);
    if (!data) {
      return res.status(404).json({ error: `No product with an ingredient list found for "${q}". Try a brand or product name (e.g. "Coca-Cola", "Nutella", "Colgate").` });
    }
    return res.json(data);
  } catch (err: any) {
    console.error("Product route error: ", err);
    return res.status(500).json({ error: err.message || "An error occurred querying the product databases." });
  }
});

export default router;
