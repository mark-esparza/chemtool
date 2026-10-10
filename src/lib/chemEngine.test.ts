/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Property-engine tests. These pin the behaviours that were wrong before:
 * ring bonds counted as rotatable, SMILES-text substring matching, and a
 * parse failure answered with a placeholder molecule's properties.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateProperties, smilesToFormula } from "./chemEngine.ts";

const ASPIRIN = "CC(=O)OC1=CC=CC=C1C(=O)O";
const CYCLOHEXANE = "C1CCCCC1";
const BENZENE = "c1ccccc1";
const GLUCOSE = "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O";
const DOPAMINE = "NCCc1ccc(O)c(O)c1";

test("a structure that cannot be parsed throws rather than returning defaults", () => {
  // The previous implementation answered every failure with aspirin's values.
  for (const bad of ["XYZ", "[Zz]", "!!", ")("]) {
    assert.throws(() => calculateProperties(bad), undefined, `expected "${bad}" to throw`);
  }
});

test("formula and mass are computed from the graph", () => {
  const p = calculateProperties(ASPIRIN);
  assert.equal(p.formula, "C9H8O4");
  assert.ok(Math.abs(p.mw - 180.16) < 0.05, `mass was ${p.mw}`);
  assert.equal(smilesToFormula(GLUCOSE), "C6H12O6");
});

test("ring bonds are not counted as rotatable", () => {
  // Every C-C bond in cyclohexane and benzene lies on a ring, so neither
  // molecule has a rotatable bond. The old bridge-free count reported six.
  assert.equal(calculateProperties(CYCLOHEXANE).rotatable_bonds, 0);
  assert.equal(calculateProperties(BENZENE).rotatable_bonds, 0);
  // Dopamine's rotatable bonds are the two in its ethylamine chain.
  assert.equal(calculateProperties(DOPAMINE).rotatable_bonds, 2);
});

test("ring counts come from the cyclomatic number", () => {
  assert.equal(calculateProperties(CYCLOHEXANE).ring_count, 1);
  assert.equal(calculateProperties(CYCLOHEXANE).aromatic_rings, 0);
  assert.equal(calculateProperties(BENZENE).aromatic_rings, 1);
  assert.equal(calculateProperties("c1ccc2ccccc2c1").ring_count, 2); // naphthalene
  assert.equal(calculateProperties(GLUCOSE).ring_count, 1);
});

test("the amide C-N bond is excluded from the rotatable count", () => {
  // N-methylacetamide: the C-N bond has restricted rotation.
  assert.equal(calculateProperties("CC(=O)NC").rotatable_bonds, 0);
});

test("functional groups are read from connectivity, not from the SMILES text", () => {
  // Same molecule (acetic acid), written two ways; detection must agree.
  const a = calculateProperties("CC(=O)O").functional_groups;
  const b = calculateProperties("OC(=O)C").functional_groups;
  assert.deepEqual(a, b);
  assert.ok(a.includes("Carboxylic acid (COOH)"), a.join("|"));

  const aspirin = calculateProperties(ASPIRIN).functional_groups;
  assert.ok(aspirin.includes("Carboxylic acid (COOH)"), aspirin.join("|"));
  assert.ok(aspirin.includes("Ester (C(=O)O-C)"), aspirin.join("|"));

  // Benzene has no functional group; the old substring rule flagged every
  // aromatic compound as a catechol candidate.
  assert.deepEqual(calculateProperties(BENZENE).functional_groups, []);

  const dopamine = calculateProperties(DOPAMINE).functional_groups;
  assert.ok(dopamine.includes("Primary amine (NH₂)"), dopamine.join("|"));
  assert.ok(dopamine.includes("Phenol (aromatic OH)"), dopamine.join("|"));
});

test("TPSA follows Ertl fragment contributions", () => {
  // Glucose: five hydroxyls (20.23 each) plus one ring ether (9.23) = 110.38.
  assert.ok(Math.abs(calculateProperties(GLUCOSE).tpsa - 110.4) < 0.5);
  assert.equal(calculateProperties(BENZENE).tpsa, 0);
});

test("hydrogen-bond counts use Lipinski's N+O convention", () => {
  const p = calculateProperties(GLUCOSE);
  assert.equal(p.hba, 6); // six oxygens
  assert.equal(p.hbd, 5); // five hydroxyl hydrogens
});

test("composite indices stay in range and are deterministic", () => {
  for (const s of [ASPIRIN, GLUCOSE, DOPAMINE, BENZENE]) {
    const p = calculateProperties(s);
    assert.ok(p.desirability_index >= 0 && p.desirability_index <= 1, s);
    assert.ok(p.complexity_index >= 1 && p.complexity_index <= 10, s);
    assert.deepEqual(calculateProperties(s), p); // same input, same output
  }
});

test("Lipinski and Veber violation counts apply the published cut-offs", () => {
  assert.equal(calculateProperties(ASPIRIN).ro5_violations, 0);
  assert.equal(calculateProperties(ASPIRIN).veber_violations, 0);
  // A long flexible chain breaks Veber's rotatable-bond limit.
  assert.ok(calculateProperties("CCCCCCCCCCCCCCCCCC").veber_violations >= 1);
});

test("no pseudo-structural fields are exposed", () => {
  // Binding affinity, target protein, pocket fit and conformer energy were
  // formulas over descriptors with no structural calculation behind them.
  const p = calculateProperties(ASPIRIN) as unknown as Record<string, unknown>;
  for (const gone of [
    "docking_affinity", "target_protein", "pocket_fit_score",
    "binding_residues", "conformer_energy", "solubility_level", "toxicity_risk",
    "qed", "sa_score", "clogp", "structural_alerts",
  ]) {
    assert.equal(p[gone], undefined, `${gone} should no longer be reported`);
  }
});
