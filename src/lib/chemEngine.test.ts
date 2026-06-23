/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for the deterministic chemistry engine.
 * Run with: npm test  (node --import tsx --test)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSmiles,
  calculateProperties,
  calculateTanimotoSimilarity,
  calculateTanimotoDistance,
} from "./chemEngine.js";

// Helper: assert a number is within `tol` of the expected value.
function approx(actual: number, expected: number, tol: number, label: string) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: expected ~${expected} (±${tol}), got ${actual}`,
  );
}

// ---------------------------------------------------------------------------
// Bond-order parsing (regression guard for the dropped double/triple bonds)
// ---------------------------------------------------------------------------

test("explicit double bonds are recorded with order 2", () => {
  const g = parseSmiles("C=C");
  assert.equal(g.bonds.length, 1);
  assert.equal(g.bonds[0].order, 2);
});

test("explicit triple bonds are recorded with order 3", () => {
  const g = parseSmiles("C#C");
  assert.equal(g.bonds.length, 1);
  assert.equal(g.bonds[0].order, 3);
});

test("a double bond reduces implicit hydrogens on both atoms", () => {
  const ethane = parseSmiles("CC");
  const ethylene = parseSmiles("C=C");
  // Ethane carbons each carry 3 H; ethylene carbons each carry 2 H.
  assert.equal(ethane.atoms[0].implicitHydrogens, 3);
  assert.equal(ethylene.atoms[0].implicitHydrogens, 2);
});

// ---------------------------------------------------------------------------
// Molecular weight / formula on molecules that depend on bond order
// ---------------------------------------------------------------------------

test("ethane C2H6 molecular weight", () => {
  const p = calculateProperties("CC");
  assert.equal(p.formula, "C2H6");
  approx(p.mw, 30.07, 0.1, "ethane MW");
});

test("ethylene C2H4 molecular weight (depends on double bond)", () => {
  const p = calculateProperties("C=C");
  assert.equal(p.formula, "C2H4");
  approx(p.mw, 28.05, 0.1, "ethylene MW");
});

test("acetylene C2H2 molecular weight (depends on triple bond)", () => {
  const p = calculateProperties("C#C");
  assert.equal(p.formula, "C2H2");
  approx(p.mw, 26.04, 0.1, "acetylene MW");
});

test("carbon dioxide O=C=O has no implicit hydrogens", () => {
  const p = calculateProperties("O=C=O");
  assert.equal(p.formula, "CO2");
  approx(p.mw, 44.01, 0.1, "CO2 MW");
});

// ---------------------------------------------------------------------------
// Real drug scaffolds: sanity ranges (heuristic engine, so tolerances are wide)
// ---------------------------------------------------------------------------

test("aspirin parses to a plausible, drug-like molecule", () => {
  const p = calculateProperties("CC(=O)OC1=CC=CC=C1C(=O)O");
  // Real aspirin: C9H8O4, MW 180.16. Allow slack for the heuristic H model.
  approx(p.mw, 180.16, 6, "aspirin MW");
  assert.equal(p.ro5_violations, 0, "aspirin should pass Lipinski");
  assert.ok(p.hba >= 3, "aspirin has several H-bond acceptors");
});

test("caffeine produces finite, well-formed properties", () => {
  const p = calculateProperties("CN1C=NC2=C1C(=O)N(C(=O)N2C)C");
  for (const key of ["mw", "clogp", "tpsa", "qed", "sa_score"] as const) {
    assert.ok(Number.isFinite(p[key]), `${key} should be finite`);
  }
  assert.ok(p.hba > 0, "caffeine has H-bond acceptors");
});

// ---------------------------------------------------------------------------
// Tanimoto similarity / distance
// ---------------------------------------------------------------------------

test("identical molecules have similarity 1 and distance 0", () => {
  const smiles = "CC(=O)OC1=CC=CC=C1C(=O)O";
  assert.equal(calculateTanimotoSimilarity(smiles, smiles), 1.0);
  assert.equal(calculateTanimotoDistance(smiles, smiles), 0.0);
});

test("similarity is bounded in [0, 1] for dissimilar molecules", () => {
  const sim = calculateTanimotoSimilarity("CC", "c1ccccc1C(=O)O");
  assert.ok(sim >= 0 && sim <= 1, `similarity out of range: ${sim}`);
});

// ---------------------------------------------------------------------------
// Robustness: bad input falls back instead of throwing
// ---------------------------------------------------------------------------

test("empty SMILES throws from the parser", () => {
  assert.throws(() => parseSmiles(""));
});

test("calculateProperties never throws, even on garbage input", () => {
  const p = calculateProperties("not-a-real-smiles-@@@");
  assert.ok(Number.isFinite(p.mw), "fallback MW should be finite");
});
