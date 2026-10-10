/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChemAtom {
  id: number;
  symbol: string;
  isAromatic: boolean;
  implicitHydrogens: number;
}

export interface ChemBond {
  atom1: number;
  atom2: number;
  order: number; // 1 = single, 2 = double, 3 = triple, 1.5 = aromatic
}

export interface ChemGraph {
  atoms: ChemAtom[];
  bonds: ChemBond[];
}

/**
 * Properties computed on-device from the parsed structure graph.
 *
 * Naming here is deliberately literal. Where a value is a coarse estimate it is
 * named as an estimate, so it is never mistaken for the published metric it
 * resembles. PubChem publishes authoritative XLogP3, TPSA and descriptor values
 * for deposited compounds; prefer those when a CID is known and treat these as
 * the fallback for structures that are not in PubChem.
 */
export interface MolecularProperties {
  smiles: string;
  formula: string;
  /** Average molecular mass, from standard atomic weights (g/mol). */
  mw: number;
  /**
   * Coarse atom-additive logP estimate. NOT Crippen cLogP or XLogP3: it sums
   * per-element increments with no fragment or neighbour corrections, so treat
   * it as an order-of-magnitude indication of lipophilicity only.
   */
  logp_estimate: number;
  /**
   * Topological polar surface area (Å²) using Ertl et al. (2000) fragment
   * contributions, simplified: nitrogen and oxygen use their standard values,
   * sulfur uses a single value rather than per-oxidation-state values, and
   * phosphorus is not counted. Accurate for ordinary N/O-containing organics.
   */
  tpsa: number;
  /** Hydrogen-bond donors: N or O carrying at least one hydrogen (Lipinski). */
  hbd: number;
  /** Hydrogen-bond acceptors: count of N and O atoms (Lipinski's N+O count). */
  hba: number;
  /** Acyclic single bonds between non-terminal heavy atoms, excluding amide C-N. */
  rotatable_bonds: number;
  aromatic_rings: number;
  /** Number of rings, from the cyclomatic number of the structure graph. */
  ring_count: number;
  /**
   * Unweighted geometric mean of six Gaussian desirability terms (mass, logP
   * estimate, HBA, HBD, TPSA, rotatable bonds), 0-1. Inspired by the shape of
   * Bickerton et al.'s QED but NOT QED: it omits QED's fitted ADS functions,
   * its aromatic-ring and alert terms, and its weighting. Use it to rank within
   * one result set, not as a published drug-likeness score.
   */
  desirability_index: number;
  /**
   * Size-and-topology complexity proxy, 1-10, from heavy-atom count, ring count
   * and flexibility. NOT the Ertl-Schuffenhauer synthetic accessibility score:
   * it has no fragment-frequency term and says nothing about synthetic routes.
   */
  complexity_index: number;
  ro5_violations: number;
  veber_violations: number;
  /**
   * Functional groups identified from the structure graph. Descriptive only:
   * this is not a PAINS, Brenk or other published alert set, and presence of a
   * group here is not a liability claim.
   */
  functional_groups: string[];
}

// Map of standard atomic masses
const ATOMIC_MASSES: Record<string, number> = {
  H: 1.008,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  F: 18.998,
  P: 30.974,
  S: 32.06,
  CL: 35.453,
  BR: 79.904,
  I: 126.904,
};

// Map of default valences for hydrogen calculation
const ATOMIC_VALENCES: Record<string, number> = {
  C: 4,
  N: 3,
  O: 2,
  F: 1,
  P: 3,
  S: 2,
  CL: 1,
  BR: 1,
  I: 1,
};

/**
 * Parses a SMILES string into a 2D Chemical Graph
 */
export function parseSmiles(smiles: string): ChemGraph {
  const atoms: ChemAtom[] = [];
  const bonds: ChemBond[] = [];
  
  if (!smiles || smiles.trim() === "") {
    throw new Error("Empty SMILES string");
  }

  const stack: number[] = [];
  const ringClosures = new Map<string, { atomId: number; bondType: string }>();
  
  let i = 0;
  let lastAtomId: number | null = null;
  let pendingBondOrder = 1; // set by '='/'#', consumed by the next atom's bond
  const len = smiles.length;

  while (i < len) {
    const char = smiles[i];

    // Branching start
    if (char === "(") {
      if (lastAtomId !== null) {
        stack.push(lastAtomId);
      }
      i++;
      continue;
    }

    // Branching end
    if (char === ")") {
      if (stack.length === 0) {
        throw new Error("Mismatched parenthesis in SMILES");
      }
      lastAtomId = stack.pop() ?? null;
      i++;
      continue;
    }

    // Explicit bonds — persist across loop iterations until the next atom consumes them.
    if (char === "=") {
      pendingBondOrder = 2;
      i++;
      continue;
    } else if (char === "#") {
      pendingBondOrder = 3;
      i++;
      continue;
    } else if (char === "/") {
      // Stereochemistry slash, treat as single bond
      i++;
      continue;
    } else if (char === "\\") {
      // Stereochemistry backslash, treat as single bond
      i++;
      continue;
    } else if (char === ".") {
      // Unbonded fragments, dissociate lastAtomId
      lastAtomId = null;
      pendingBondOrder = 1;
      i++;
      continue;
    }

    // Parse atom bracket or standard atom
    let symbol = "";
    let isAromatic = false;
    let bracketContent = "";

    if (char === "[") {
      i++;
      let bracketEnd = smiles.indexOf("]", i);
      if (bracketEnd === -1) {
        throw new Error("Mismatched brackets in SMILES");
      }
      bracketContent = smiles.substring(i, bracketEnd);
      i = bracketEnd + 1;

      // Extract symbol from bracket (e.g. [nH], [13C], [C@H])
      const match = bracketContent.match(/[A-Z][a-z]?|[a-z]/);
      if (match) {
        symbol = match[0];
      } else {
        symbol = "C";
      }
    } else {
      // Standard elements: C, N, O, S, P, F, Cl, Br, I, c, n, o, s, p
      // Check for two-letter elements: Cl, Br
      if (i + 1 < len && (smiles.substring(i, i+2) === "Cl" || smiles.substring(i, i+2) === "Br")) {
        symbol = smiles.substring(i, i+2);
        i += 2;
      } else {
        symbol = smiles[i];
        i++;
      }
    }

    // Determine element name and aromaticity
    isAromatic = symbol === symbol.toLowerCase();
    const cleanSymbol = symbol.toUpperCase();

    // Skip invalid entries
    if (!["C", "N", "O", "S", "P", "F", "CL", "BR", "H", "I"].includes(cleanSymbol)) {
      continue;
    }

    // Create atom
    const newAtom: ChemAtom = {
      id: atoms.length,
      symbol: cleanSymbol,
      isAromatic,
      implicitHydrogens: 0,
    };
    atoms.push(newAtom);

    // If we have a preceding atom, bond to it
    if (lastAtomId !== null) {
      const order = isAromatic && atoms[lastAtomId].isAromatic ? 1.5 : pendingBondOrder;
      bonds.push({
        atom1: lastAtomId,
        atom2: newAtom.id,
        order,
      });
    }
    pendingBondOrder = 1; // consumed by this atom

    lastAtomId = newAtom.id;

    // Parse Ring closures immediately following the atom
    while (i < len) {
      let ringChar = smiles[i];
      let ringId = "";

      if (ringChar === "%") {
        // Double digit ring closures, e.g. %12
        if (i + 2 < len) {
          ringId = smiles.substring(i + 1, i + 3);
          i += 3;
        } else {
          break;
        }
      } else if (/\d/.test(ringChar)) {
        ringId = ringChar;
        i++;
      } else {
        break; // Not a ring closure
      }

      if (ringId) {
        if (ringClosures.has(ringId)) {
          const closure = ringClosures.get(ringId)!;
          // Form ring closure bond
          bonds.push({
            atom1: closure.atomId,
            atom2: newAtom.id,
            order: isAromatic && atoms[closure.atomId].isAromatic ? 1.5 : 1,
          });
          ringClosures.delete(ringId);
        } else {
          ringClosures.set(ringId, {
            atomId: newAtom.id,
            bondType: "", // Standard single/aromatic determined at closure
          });
        }
      }
    }
  }

  // Calculate implicit hydrogens for each atom
  for (const atom of atoms) {
    if (atom.symbol === "H") {
      atom.implicitHydrogens = 0;
      continue;
    }

    // Get total bond orders connected to this atom
    let connectedBondSum = 0;
    const connectedBonds = bonds.filter(b => b.atom1 === atom.id || b.atom2 === atom.id);
    for (const bond of connectedBonds) {
      connectedBondSum += bond.order;
    }

    // Resolve valency
    let baseValence = ATOMIC_VALENCES[atom.symbol] ?? 4;
    
    // Dynamic valence for P and S groups if exceeded
    if (atom.symbol === "S" && connectedBondSum > 2) {
      baseValence = connectedBondSum > 4 ? 6 : 4;
    } else if (atom.symbol === "P" && connectedBondSum > 3) {
      baseValence = 5;
    }

    const implicit = baseValence - connectedBondSum;
    atom.implicitHydrogens = implicit > 0 ? Math.floor(implicit) : 0;
  }

  return { atoms, bonds };
}

/**
 * Calculates deterministic properties of a SMILES chemical graph
 */
const HALOGENS = new Set(["F", "CL", "BR", "I"]);

/** Adjacency list over the structure graph. */
function adjacency(atoms: ChemAtom[], bonds: ChemBond[]): Map<number, { to: number; bond: ChemBond }[]> {
  const adj = new Map<number, { to: number; bond: ChemBond }[]>();
  for (const a of atoms) adj.set(a.id, []);
  for (const b of bonds) {
    adj.get(b.atom1)?.push({ to: b.atom2, bond: b });
    adj.get(b.atom2)?.push({ to: b.atom1, bond: b });
  }
  return adj;
}

/**
 * Bonds that lie on a ring. A bond is a ring bond exactly when it is not a
 * bridge: remove it and its two endpoints are still connected. Structures here
 * are small, so the direct test is cheaper than a full cycle basis.
 */
function ringBonds(atoms: ChemAtom[], bonds: ChemBond[]): Set<ChemBond> {
  const adj = adjacency(atoms, bonds);
  const inRing = new Set<ChemBond>();
  for (const bond of bonds) {
    const seen = new Set<number>([bond.atom1]);
    const stack = [bond.atom1];
    let reached = false;
    while (stack.length > 0 && !reached) {
      const cur = stack.pop()!;
      for (const { to, bond: via } of adj.get(cur) ?? []) {
        if (via === bond) continue; // the bond under test is removed
        if (to === bond.atom2) { reached = true; break; }
        if (!seen.has(to)) { seen.add(to); stack.push(to); }
      }
    }
    if (reached) inRing.add(bond);
  }
  return inRing;
}

/** Number of connected components of the structure graph. */
function componentCount(atoms: ChemAtom[], bonds: ChemBond[]): number {
  const adj = adjacency(atoms, bonds);
  const seen = new Set<number>();
  let components = 0;
  for (const a of atoms) {
    if (seen.has(a.id)) continue;
    components++;
    const stack = [a.id];
    seen.add(a.id);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const { to } of adj.get(cur) ?? []) {
        if (!seen.has(to)) { seen.add(to); stack.push(to); }
      }
    }
  }
  return components;
}

/**
 * Functional groups read off the structure graph. Purely descriptive: each
 * entry says what was found, with no liability or toxicity interpretation.
 * Detection is by local connectivity, so it is order-independent — unlike
 * matching substrings against the SMILES text, where the same molecule written
 * two ways gives two different answers.
 */
function detectFunctionalGroups(atoms: ChemAtom[], bonds: ChemBond[]): string[] {
  const adj = adjacency(atoms, bonds);
  const at = (id: number) => atoms[id];
  const nbrs = (id: number) => adj.get(id) ?? [];
  const found = new Set<string>();

  for (const atom of atoms) {
    const sym = atom.symbol;
    const links = nbrs(atom.id);

    if (sym === "C") {
      const doubleO = links.filter((l) => l.bond.order === 2 && at(l.to).symbol === "O");
      const singleO = links.filter((l) => l.bond.order === 1 && at(l.to).symbol === "O");
      const singleN = links.filter((l) => l.bond.order === 1 && at(l.to).symbol === "N");
      const carbons = links.filter((l) => at(l.to).symbol === "C");
      const tripleN = links.filter((l) => l.bond.order === 3 && at(l.to).symbol === "N");

      if (tripleN.length > 0) found.add("Nitrile (C≡N)");
      if (doubleO.length === 1) {
        const hydroxyl = singleO.find((l) => at(l.to).implicitHydrogens > 0);
        const etherO = singleO.find((l) => at(l.to).implicitHydrogens === 0 && nbrs(l.to).length > 1);
        if (hydroxyl) found.add("Carboxylic acid (COOH)");
        else if (etherO) found.add("Ester (C(=O)O-C)");
        else if (singleN.length > 0) found.add("Amide (C(=O)N)");
        else if (atom.implicitHydrogens > 0) found.add("Aldehyde (CHO)");
        else if (carbons.length >= 2) found.add("Ketone (C(=O)C)");
      }
    }

    if (sym === "N") {
      const oxygens = links.filter((l) => at(l.to).symbol === "O");
      if (oxygens.length >= 2 && oxygens.some((l) => l.bond.order === 2)) found.add("Nitro (NO₂)");
      if (links.some((l) => l.bond.order === 2 && at(l.to).symbol === "N")) found.add("Azo (N=N)");
      if (links.some((l) => l.bond.order === 1 && at(l.to).symbol === "N")) found.add("Hydrazine-type (N-N)");
      if (!atom.isAromatic && atom.implicitHydrogens === 2) found.add("Primary amine (NH₂)");
    }

    if (sym === "O" && atom.implicitHydrogens > 0) {
      // Hydroxyl only when not part of a carboxylic acid.
      const onAcidCarbon = links.some((l) =>
        at(l.to).symbol === "C" && nbrs(l.to).some((m) => m.bond.order === 2 && at(m.to).symbol === "O")
      );
      if (!onAcidCarbon) found.add(atom.isAromatic || links.some((l) => at(l.to).isAromatic) ? "Phenol (aromatic OH)" : "Hydroxyl (OH)");
    }

    if (sym === "S") {
      const oxygens = links.filter((l) => l.bond.order === 2 && at(l.to).symbol === "O");
      const nitrogens = links.filter((l) => at(l.to).symbol === "N");
      if (oxygens.length >= 2 && nitrogens.length > 0) found.add("Sulfonamide (SO₂N)");
      else if (oxygens.length >= 2) found.add("Sulfone / sulfonyl (SO₂)");
      else if (atom.implicitHydrogens > 0) found.add("Thiol (SH)");
      if (links.some((l) => l.bond.order === 2 && at(l.to).symbol === "C")) found.add("Thiocarbonyl (C=S)");
    }

    if (HALOGENS.has(sym)) {
      const pretty = sym.charAt(0) + sym.slice(1).toLowerCase();
      found.add(`Halogen substituent (${pretty})`);
    }
  }

  return [...found].sort();
}

/**
 * Compute properties from a SMILES string.
 *
 * Throws when the structure cannot be parsed. It deliberately does not fall
 * back to placeholder values: a caller that cannot tell a failure from a real
 * measurement would report invented numbers as data.
 */
export function calculateProperties(smiles: string): MolecularProperties {
  const graph = parseSmiles(smiles);
  const atoms = graph.atoms;
  const bonds = graph.bonds;
  if (atoms.length === 0) throw new Error("No atoms parsed from SMILES");

  // --- Formula and mass -----------------------------------------------------
  const atomCounts: Record<string, number> = { H: 0 };
  let mw = 0;
  for (const atom of atoms) {
    atomCounts[atom.symbol] = (atomCounts[atom.symbol] ?? 0) + 1;
    atomCounts.H += atom.implicitHydrogens;
    mw += ATOMIC_MASSES[atom.symbol] ?? 12.011;
  }
  mw += atomCounts.H * ATOMIC_MASSES.H;

  const listElements = Object.keys(atomCounts).filter((k) => atomCounts[k] > 0);
  listElements.sort((a, b) => {
    if (a === "C") return -1;
    if (b === "C") return 1;
    if (a === "H") return -1;
    if (b === "H") return 1;
    return a.localeCompare(b);
  });
  const formula = listElements.map((el) => (atomCounts[el] === 1 ? el : `${el}${atomCounts[el]}`)).join("");

  // --- Hydrogen bonding (Lipinski's simple N+O counts) ----------------------
  let hba = 0;
  let hbd = 0;
  for (const atom of atoms) {
    if (atom.symbol !== "N" && atom.symbol !== "O") continue;
    hba++;
    if (atom.implicitHydrogens > 0) hbd++;
  }

  // --- Rings ----------------------------------------------------------------
  // Cyclomatic number: edges - vertices + components.
  const ring_count = Math.max(0, bonds.length - atoms.length + componentCount(atoms, bonds));
  const aromaticAtomIds = atoms.filter((a) => a.isAromatic).map((a) => a.id);
  let aromatic_rings = 0;
  if (aromaticAtomIds.length >= 3) {
    const aromaticAtomSet = new Set(aromaticAtomIds);
    const aromaticBonds = bonds.filter((b) => aromaticAtomSet.has(b.atom1) && aromaticAtomSet.has(b.atom2));
    const aromaticAtoms = atoms.filter((a) => aromaticAtomSet.has(a.id));
    const cyclomatic = aromaticBonds.length - aromaticAtoms.length + componentCount(aromaticAtoms, aromaticBonds);
    aromatic_rings = Math.max(0, cyclomatic);
  }

  // --- Rotatable bonds ------------------------------------------------------
  // Acyclic single bonds between two non-terminal heavy atoms, excluding the
  // amide C-N bond (restricted rotation). Ring bonds are excluded explicitly:
  // counting them would make every cycloalkane look flexible.
  const inRing = ringBonds(atoms, bonds);
  const adj = adjacency(atoms, bonds);
  const degree = (id: number) => (adj.get(id) ?? []).length;
  const isAmideBond = (a: ChemAtom, b: ChemAtom): boolean => {
    const [c, n] = a.symbol === "C" ? [a, b] : [b, a];
    if (c.symbol !== "C" || n.symbol !== "N") return false;
    return (adj.get(c.id) ?? []).some((l) => l.bond.order === 2 && atoms[l.to].symbol === "O");
  };

  let rotatable_bonds = 0;
  for (const bond of bonds) {
    if (bond.order !== 1 || inRing.has(bond)) continue;
    const a1 = atoms[bond.atom1];
    const a2 = atoms[bond.atom2];
    if (degree(a1.id) <= 1 || degree(a2.id) <= 1) continue;
    if (HALOGENS.has(a1.symbol) || HALOGENS.has(a2.symbol)) continue;
    if (isAmideBond(a1, a2)) continue;
    rotatable_bonds++;
  }

  // --- logP estimate and TPSA ----------------------------------------------
  // TPSA uses Ertl et al. (2000) fragment contributions; the logP figure is a
  // coarse atom-additive estimate and is named accordingly.
  let logp_estimate = 0.5;
  let tpsa = 0.0;
  for (const atom of atoms) {
    const sym = atom.symbol;
    if (sym === "C") {
      logp_estimate += atom.isAromatic ? 0.36 : 0.4;
    } else if (sym === "O") {
      if (atom.implicitHydrogens >= 1) {
        tpsa += 20.23;
        logp_estimate -= 0.6;
      } else {
        tpsa += 9.23;
        logp_estimate -= 0.2;
      }
    } else if (sym === "N") {
      if (atom.implicitHydrogens === 2) {
        tpsa += 26.02;
        logp_estimate -= 1.1;
      } else if (atom.implicitHydrogens === 1) {
        tpsa += 12.03;
        logp_estimate -= 0.8;
      } else {
        tpsa += atom.isAromatic ? 12.89 : 3.24;
        logp_estimate -= 0.5;
      }
    } else if (sym === "F") logp_estimate += 0.14;
    else if (sym === "CL") logp_estimate += 0.55;
    else if (sym === "BR") logp_estimate += 0.82;
    else if (sym === "I") logp_estimate += 1.12;
    else if (sym === "S") {
      logp_estimate += 0.15;
      tpsa += 25.3;
    }
  }

  // --- Rule-based flags -----------------------------------------------------
  const ro5_violations = sumB([mw > 500, logp_estimate > 5, hbd > 5, hba > 10]);
  const veber_violations = sumB([rotatable_bonds > 10, tpsa > 140]);

  // --- Composite indices (ranking aids, not published scores) ---------------
  const desirability = (val: number, mean: number, sd: number) => Math.exp(-0.5 * Math.pow((val - mean) / sd, 2));
  const desirability_index = Math.pow(
    desirability(mw, 280, 120) *
      desirability(logp_estimate, 2.5, 1.8) *
      desirability(hba, 4.5, 2.5) *
      desirability(hbd, 1.8, 1.5) *
      desirability(tpsa, 75, 45) *
      desirability(rotatable_bonds, 4, 3),
    1 / 6
  );

  const heavyAtoms = atoms.length;
  const complexity_index = Math.min(
    10,
    Math.max(1, 1 + heavyAtoms / 8 + ring_count * 0.3 + rotatable_bonds * 0.1)
  );

  return {
    smiles,
    formula,
    mw: parseFloat(mw.toFixed(2)),
    logp_estimate: parseFloat(logp_estimate.toFixed(2)),
    tpsa: parseFloat(tpsa.toFixed(1)),
    hbd,
    hba,
    rotatable_bonds,
    aromatic_rings,
    ring_count,
    desirability_index: parseFloat(desirability_index.toFixed(3)),
    complexity_index: parseFloat(complexity_index.toFixed(2)),
    ro5_violations,
    veber_violations,
    functional_groups: detectFunctionalGroups(atoms, bonds),
  };
}

function sumB(arr: boolean[]): number {
  return arr.reduce((acc, current) => acc + (current ? 1 : 0), 0);
}

/**
 * Molecular formula (Hill system, with implicit hydrogens) for a SMILES string.
 * Throws if the SMILES yields no atoms — lets callers distinguish real structures.
 */
export function smilesToFormula(smiles: string): string {
  const { atoms } = parseSmiles(smiles);
  if (atoms.length === 0) throw new Error("No atoms parsed from SMILES");
  const counts: Record<string, number> = { H: 0 };
  for (const a of atoms) {
    counts[a.symbol] = (counts[a.symbol] ?? 0) + 1;
    counts.H += a.implicitHydrogens;
  }
  const elements = Object.keys(counts).filter((k) => counts[k] > 0);
  elements.sort((a, b) => {
    if (a === "C") return -1;
    if (b === "C") return 1;
    if (a === "H") return -1;
    if (b === "H") return 1;
    return a.localeCompare(b);
  });
  return elements.map((el) => (counts[el] === 1 ? el : `${el}${counts[el]}`)).join("");
}

/**
 * Calculates topological fingerprints for a SMILES string to compute Jaccard/Tanimoto similarity.
 * We generate molecular chunks/sub-paths from atoms and bonds.
 */
export function getMolecularFingerprint(smiles: string): Set<string> {
  const fragments = new Set<string>();
  try {
    const graph = parseSmiles(smiles);
    const atoms = graph.atoms;
    const bonds = graph.bonds;

    // 1. Single atom fragments
    for (const a of atoms) {
      fragments.add(a.symbol + (a.isAromatic ? "-aro" : ""));
    }

    // 2. Bond-level fragments (length 1)
    for (const b of bonds) {
      const a1 = atoms[b.atom1];
      const a2 = atoms[b.atom2];
      const name = [a1.symbol, a2.symbol].sort().join("-" + b.order + "-");
      fragments.add(name);
    }

    // 3. Atom-neighborhood paths (length 2)
    for (const a of atoms) {
      const connected = bonds.filter(b => b.atom1 === a.id || b.atom2 === a.id);
      const degree = connected.length;
      fragments.add(`${a.symbol}-deg${degree}`);
      
      // Neighbor pairs around this atom
      for (let x = 0; x < connected.length; x++) {
        for (let y = x + 1; y < connected.length; y++) {
          const b1 = connected[x];
          const b2 = connected[y];
          const n1 = b1.atom1 === a.id ? atoms[b1.atom2] : atoms[b1.atom1];
          const n2 = b2.atom1 === a.id ? atoms[b2.atom2] : atoms[b2.atom1];
          const name = [n1.symbol, n2.symbol].sort().join(`-[${a.symbol}]-`);
          fragments.add(name);
        }
      }
    }
  } catch (e) {
    // Treat as simple character n-grams fallback if SMILES is unparseable
    for (let c = 0; c < smiles.length - 2; c++) {
      fragments.add(smiles.substring(c, c+3));
    }
  }
  return fragments;
}

/**
 * Calculates Tanimoto Similarity between two molecules based on fragment overlap.
 * Result ranges from 0.0 (entirely dissimilar) to 1.0 (identical structural features).
 */
export function calculateTanimotoSimilarity(smiles1: string, smiles2: string): number {
  if (smiles1 === smiles2) return 1.0;
  
  const fp1 = getMolecularFingerprint(smiles1);
  const fp2 = getMolecularFingerprint(smiles2);

  if (fp1.size === 0 || fp2.size === 0) return 0.0;

  let intersectionSize = 0;
  for (const item of fp1) {
    if (fp2.has(item)) {
      intersectionSize++;
    }
  }

  const unionSize = fp1.size + fp2.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * Calculates Tanimoto Distance (1.0 - Similarity)
 */
export function calculateTanimotoDistance(smiles1: string, smiles2: string): number {
  return parseFloat((1.0 - calculateTanimotoSimilarity(smiles1, smiles2)).toFixed(3));
}
