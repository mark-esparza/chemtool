/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Structural analog search.
 *
 * Replaces the earlier "design pipeline", which invented analog structures by
 * concatenating fragments onto the seed's SMILES text and then described them
 * with a fixed narrative report. Nothing here is invented: candidates are real
 * PubChem compounds returned by a 2D similarity query, every descriptor is
 * either reported by PubChem or computed on-device from the parsed structure,
 * and the two are returned side by side so they can be compared.
 */

import { Router } from "express";
import { calculateProperties, calculateTanimotoDistance, MolecularProperties } from "../../src/lib/chemEngine.js";
import { fetchPubChemData } from "../pubchem.js";
import { fetchNeighborhood } from "../neighbors.js";
import { getParetoFrontMask } from "../pareto.js";
import type { AnalogFilters, AnalogCandidate, AnalogResult } from "../../src/types/index.js";

const router = Router();

/** Filter definitions: each is an upper bound on a property, applied if set. */
const FILTERS: { key: keyof AnalogFilters; prop: keyof MolecularProperties; label: string }[] = [
  { key: "mwMax", prop: "mw", label: "molecular mass" },
  { key: "logpMax", prop: "logp_estimate", label: "logP estimate" },
  { key: "tpsaMax", prop: "tpsa", label: "TPSA" },
  { key: "hbdMax", prop: "hbd", label: "H-bond donors" },
  { key: "hbaMax", prop: "hba", label: "H-bond acceptors" },
  { key: "rotMax", prop: "rotatable_bonds", label: "rotatable bonds" },
];

const numOrNull = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

router.post("/api/analogs", async (req, res) => {
  const { seed, threshold, maxRecords, filters } = req.body ?? {};
  if (!seed || typeof seed !== "string" || !seed.trim()) {
    return res.status(400).json({ error: "A seed compound is required (name, CID, or SMILES)." });
  }

  const f: AnalogFilters = {
    mwMax: numOrNull(filters?.mwMax),
    logpMax: numOrNull(filters?.logpMax),
    tpsaMax: numOrNull(filters?.tpsaMax),
    hbdMax: numOrNull(filters?.hbdMax),
    hbaMax: numOrNull(filters?.hbaMax),
    rotMax: numOrNull(filters?.rotMax),
    lipinskiOnly: !!filters?.lipinskiOnly,
  };

  try {
    // 1. Resolve the seed against PubChem so the query is anchored to a CID.
    const seedRecord = await fetchPubChemData(seed.trim());
    if (!seedRecord) {
      return res.status(404).json({ error: `PubChem has no compound matching "${seed.trim()}". Try a name, a CID, or a SMILES string.` });
    }

    let seedComputed: MolecularProperties | null = null;
    try {
      if (seedRecord.smiles) seedComputed = calculateProperties(seedRecord.smiles);
    } catch {
      seedComputed = null; // seed structure not parseable on-device; PubChem values still stand
    }

    // 2. Retrieve the structural neighborhood from PubChem.
    const neighborhood = await fetchNeighborhood(
      { cid: seedRecord.cid, smiles: seedRecord.smiles || null, name: seedRecord.name },
      { threshold: numOrNull(threshold) ?? 90, maxRecords: numOrNull(maxRecords) ?? 25 }
    );
    if (!neighborhood) {
      return res.status(404).json({ error: "The seed could not be used for a similarity search (no structure available)." });
    }

    // 3. Score each neighbor on-device and apply the filters.
    const candidates: AnalogCandidate[] = neighborhood.neighbors.map((n) => {
      let computed: MolecularProperties | null = null;
      let computeError: string | null = null;
      if (n.smiles) {
        try {
          computed = calculateProperties(n.smiles);
        } catch (e: any) {
          computeError = e?.message || "structure could not be parsed on-device";
        }
      } else {
        computeError = "PubChem returned no SMILES for this CID";
      }

      const tanimotoDistance =
        seedRecord.smiles && n.smiles ? calculateTanimotoDistance(seedRecord.smiles, n.smiles) : null;

      const failedFilters: string[] = [];
      for (const { key, prop, label } of FILTERS) {
        const limit = f[key] as number | null;
        if (limit === null) continue;
        const value = computed ? (computed[prop] as number) : null;
        if (value === null) failedFilters.push(`${label} unknown`);
        else if (value > limit) failedFilters.push(`${label} ${value} > ${limit}`);
      }
      if (f.lipinskiOnly) {
        if (!computed) failedFilters.push("Lipinski unknown");
        else if (computed.ro5_violations > 0) failedFilters.push(`${computed.ro5_violations} Lipinski violation(s)`);
      }

      return {
        cid: n.cid,
        name: n.name,
        formula: n.formula,
        smiles: n.smiles,
        pubchem: {
          mw: n.mw, xlogp: n.xlogp, tpsa: n.tpsa,
          hbd: n.hbd, hba: n.hba, rotatableBonds: n.rotatableBonds,
        },
        computed,
        computeError,
        tanimotoDistance,
        passes: failedFilters.length === 0,
        failedFilters,
        paretoOptimal: false,
        url: `https://pubchem.ncbi.nlm.nih.gov/compound/${n.cid}`,
      };
    });

    // 4. Pareto front across the active bounded properties, among passing
    //    candidates. With fewer than two objectives a Pareto front is just the
    //    minimum, so it is not reported.
    const objectives = FILTERS.filter(({ key }) => f[key] !== null);
    const paretoApplied = objectives.length >= 2;
    if (paretoApplied) {
      const eligible = candidates.filter((c) => c.passes && c.computed);
      const costs = eligible.map((c) => objectives.map(({ prop }) => c.computed![prop] as number));
      const mask = getParetoFrontMask(costs);
      eligible.forEach((c, i) => { c.paretoOptimal = mask[i]; });
    }

    // 5. Rank: passing first, then most similar to the seed.
    candidates.sort((a, b) => {
      if (a.passes !== b.passes) return a.passes ? -1 : 1;
      const da = a.tanimotoDistance ?? 1;
      const db = b.tanimotoDistance ?? 1;
      return da - db;
    });

    const result: AnalogResult = {
      seed: {
        cid: seedRecord.cid,
        name: seedRecord.name,
        formula: seedRecord.formula,
        smiles: seedRecord.smiles,
        hmdbAccession: seedRecord.hmdbAccession,
        computed: seedComputed,
        url: seedRecord.reportUrl,
      },
      query: {
        threshold: neighborhood.threshold,
        maxRecords: neighborhood.maxRecords,
        truncated: neighborhood.truncated,
        filters: f,
        paretoObjectives: paretoApplied ? objectives.map((o) => o.label) : [],
        retrievedAt: new Date().toISOString(),
      },
      candidates,
      counts: {
        retrieved: candidates.length,
        passing: candidates.filter((c) => c.passes).length,
        paretoOptimal: candidates.filter((c) => c.paretoOptimal).length,
        notScored: candidates.filter((c) => !c.computed).length,
      },
    };

    return res.json(result);
  } catch (err: any) {
    console.error("Analog search failure:", err);
    return res.status(502).json({ error: err.message || "The analog search could not be completed." });
  }
});

export default router;
