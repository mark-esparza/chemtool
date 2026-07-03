/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Molecule design pipeline route: compile brief, enumerate analogs, score with
 * the deterministic chemistry engine, rank on a Pareto front, and report.
 */

import { Router } from "express";
import { calculateProperties, calculateTanimotoDistance, MolecularProperties } from "../../src/lib/chemEngine.js";
import type { DesignBrief } from "../../src/types/index.js";
import { isInputSafe } from "../safety.js";
import { getParetoFrontMask } from "../pareto.js";
import { fetchPubChemData } from "../pubchem.js";
import { getLocalBriefFallback, getLocalCandidatesFallback, getLocalReportFallback } from "../designData.js";

const router = Router();

router.post("/api/design-pipeline", async (req, res) => {
  try {
    const { prompt, numSamples = 15 } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid prompt parameter." });
    }

    // Step 1: Input safety check.
    const safetyRes = isInputSafe(prompt);
    if (!safetyRes.safe) {
      return res.status(403).json({ safety_tripped: true, error: safetyRes.reason });
    }

    // Step 2: Compile the goal into a strict design brief (deterministic).
    const brief: DesignBrief = getLocalBriefFallback(prompt);

    // Step 3: Enumerate analogs around the seed scaffold (deterministic).
    const seedStructure = brief.seed_smiles || "CC(=O)OC1=CC=CC=C1C(=O)O";
    const rawCandidates = getLocalCandidatesFallback(seedStructure, numSamples);

    // Step 4: Score with the pure chemistry engine.
    const evaluatedCandidates: Array<MolecularProperties & {
      name: string;
      mutation_rationale: string;
      tanimoto_distance: number;
      is_pareto_optimal: boolean;
      total_cost: number;
      ood_flag: boolean;
    }> = [];

    for (const cand of rawCandidates) {
      if (!cand.smiles) continue;
      const props = calculateProperties(cand.smiles);
      const containsAvoidedAlerts = props.structural_alerts.some((alert) =>
        brief.must_avoid_alerts.some((avoid) => alert.toLowerCase().includes(avoid.toLowerCase()))
      );
      if (containsAvoidedAlerts) continue;

      const distance = calculateTanimotoDistance(seedStructure, cand.smiles);
      const isOOD = distance < brief.novelty.min_tanimoto_distance_from_seed || distance > brief.novelty.max;

      evaluatedCandidates.push({
        ...props,
        name: cand.name,
        mutation_rationale: cand.rationale,
        tanimoto_distance: distance,
        is_pareto_optimal: false,
        total_cost: 0,
        ood_flag: isOOD,
      });
    }

    if (evaluatedCandidates.length === 0) {
      const props = calculateProperties(seedStructure);
      evaluatedCandidates.push({
        ...props,
        name: "Direct Scaffold Reference",
        mutation_rationale: "Failsafe reference copy",
        tanimoto_distance: 0.0,
        is_pareto_optimal: true,
        total_cost: 0,
        ood_flag: false,
      });
    }

    // Step 5: Multi-objective Pareto front + cost assignment.
    const costMatrix: number[][] = [];
    for (const cand of evaluatedCandidates) {
      const row: number[] = [];
      for (const rule of brief.property_constraints) {
        const val = (cand as any)[rule.name] ?? 0;
        let cost = 0;
        if (rule.op === "<=") cost = Math.max(0, val - rule.value);
        else if (rule.op === ">=") cost = Math.max(0, rule.value - val);
        else cost = Math.abs(val - rule.value);
        row.push(cost * rule.weight);
      }
      if (row.length === 0) row.push(cand.mw, 1 - cand.qed);
      costMatrix.push(row);
    }

    const paretoMask = getParetoFrontMask(costMatrix);
    for (let i = 0; i < evaluatedCandidates.length; i++) {
      evaluatedCandidates[i].is_pareto_optimal = paretoMask[i];
      evaluatedCandidates[i].total_cost = costMatrix[i].reduce((sum, c) => sum + c, 0);
    }

    const sortedCandidates = evaluatedCandidates.sort((a, b) => {
      if (a.is_pareto_optimal && !b.is_pareto_optimal) return -1;
      if (!a.is_pareto_optimal && b.is_pareto_optimal) return 1;
      return a.total_cost - b.total_cost;
    });

    // Step 6: Audit report for the top candidate.
    const topCandidate = sortedCandidates[0];
    let explanation = "Explanation skipped: No clear top candidate identified.";
    if (topCandidate) {
      explanation = getLocalReportFallback(brief, topCandidate);
    }

    // Seed dossier (best-effort; non-fatal if PubChem is unreachable).
    let seedPubChem = null;
    try {
      seedPubChem = await fetchPubChemData(seedStructure);
    } catch {
      console.warn("Could not retrieve seed PubChem details in pipeline.");
    }

    return res.json({
      brief,
      candidates: sortedCandidates,
      explanation,
      seed_properties: calculateProperties(seedStructure),
      seed_pubchem: seedPubChem,
    });
  } catch (err: any) {
    console.error("Pipeline failure: ", err);
    return res.status(500).json({ error: err.message || "An error occurred inside the chemical design pipeline." });
  }
});

export default router;
