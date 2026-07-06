/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Resolve free-text reactants (chemical names OR formulas) into conventional
 * chemical formulas the reaction engine understands. A token that already parses
 * as a formula is kept (canonicalized); otherwise it's looked up in a common-name
 * table and finally against live PubChem.
 */

import { parseFormula } from "../src/lib/reactionEngine.js";
import { smilesToFormula } from "../src/lib/chemEngine.js";
import { fetchPubChemData } from "./pubchem.js";

// Conventional formulas the reaction engine recognizes by string (acids, common
// molecules, hydroxides, oxides, salts). We index them by composition signature
// so any equivalent formula (e.g. "ClH", "HCl") canonicalizes to the standard one.
const CONVENTIONAL = [
  "H2O", "H2O2", "HCl", "HBr", "HI", "HF", "NH3", "NH4OH",
  "CO2", "CO", "SO2", "SO3", "NO", "NO2", "N2O5", "P2O5",
  "H2SO4", "H2SO3", "HNO3", "HNO2", "H3PO4", "H2CO3", "HClO3", "HClO4",
  "NaOH", "KOH", "LiOH", "Ca(OH)2", "Ba(OH)2", "Mg(OH)2", "Sr(OH)2", "Al(OH)3", "Fe(OH)3", "Cu(OH)2",
  "NaCl", "KCl", "LiCl", "NH4Cl", "CaCl2", "MgCl2", "BaCl2", "AlCl3", "FeCl3", "ZnCl2", "CuCl2", "AgCl",
  "NaHCO3", "Na2CO3", "K2CO3", "CaCO3", "MgCO3",
  "CaO", "MgO", "Na2O", "K2O", "Fe2O3", "FeO", "Al2O3", "CuO", "ZnO", "PbO", "SnO2", "MnO2", "Cr2O3",
  "Na2SO4", "K2SO4", "CaSO4", "BaSO4", "CuSO4", "MgSO4", "ZnSO4", "FeSO4", "Al2(SO4)3", "(NH4)2SO4",
  "NaNO3", "KNO3", "AgNO3", "Ca(NO3)2", "Cu(NO3)2", "Pb(NO3)2", "Al(NO3)3",
  "KClO3", "KMnO4", "K2Cr2O7",
  "CH4", "C2H6", "C3H8", "C4H10", "C2H4", "C2H2",
  "CH3OH", "C2H5OH", "CH3COOH", "CH3COONa",
  "C6H12O6", "C12H22O11",
  "O2", "H2", "N2", "Cl2", "Br2", "I2", "F2", "C", "S", "P",
  "Na", "K", "Li", "Ca", "Mg", "Al", "Zn", "Fe", "Cu", "Ag", "Pb", "Sn", "Ni", "Au",
  "NaBr", "KBr", "NaI", "KI", "PbI2", "NaF",
];

function sig(counts: Record<string, number>): string {
  return Object.keys(counts).sort().map((k) => `${k}${counts[k]}`).join("");
}

const SIGNATURE_TO_FORMULA: Record<string, string> = {};
for (const f of CONVENTIONAL) {
  try {
    SIGNATURE_TO_FORMULA[sig(parseFormula(f))] = f;
  } catch {
    /* skip */
  }
}

/** Map a formula to its conventional equivalent when the composition matches a known species. */
export function canonicalize(formula: string): string {
  try {
    return SIGNATURE_TO_FORMULA[sig(parseFormula(formula))] || formula;
  } catch {
    return formula;
  }
}

// Common (often colloquial) chemical names → conventional formula. Handles the
// everyday terms students use and gives instant, offline resolution.
const COMMON_NAMES: Record<string, string> = {
  water: "H2O", "distilled water": "H2O",
  salt: "NaCl", "table salt": "NaCl", "rock salt": "NaCl", "sodium chloride": "NaCl",
  "baking soda": "NaHCO3", "bicarbonate of soda": "NaHCO3", "sodium bicarbonate": "NaHCO3",
  "washing soda": "Na2CO3", "soda ash": "Na2CO3", "sodium carbonate": "Na2CO3",
  vinegar: "CH3COOH", "acetic acid": "CH3COOH", "ethanoic acid": "CH3COOH",
  "hydrochloric acid": "HCl", "muriatic acid": "HCl", "hydrogen chloride": "HCl",
  "sulfuric acid": "H2SO4", "sulphuric acid": "H2SO4", "battery acid": "H2SO4",
  "nitric acid": "HNO3", "phosphoric acid": "H3PO4", "carbonic acid": "H2CO3",
  "sodium hydroxide": "NaOH", lye: "NaOH", "caustic soda": "NaOH",
  "potassium hydroxide": "KOH", "caustic potash": "KOH",
  ammonia: "NH3", "aqueous ammonia": "NH3", "ammonium hydroxide": "NH4OH",
  "hydrogen peroxide": "H2O2",
  quicklime: "CaO", "calcium oxide": "CaO", lime: "CaO", "burnt lime": "CaO",
  "slaked lime": "Ca(OH)2", "calcium hydroxide": "Ca(OH)2", limewater: "Ca(OH)2",
  limestone: "CaCO3", chalk: "CaCO3", marble: "CaCO3", "calcium carbonate": "CaCO3",
  glucose: "C6H12O6", dextrose: "C6H12O6", "blood sugar": "C6H12O6",
  sucrose: "C12H22O11", "table sugar": "C12H22O11", sugar: "C12H22O11", "cane sugar": "C12H22O11",
  ethanol: "C2H5OH", "ethyl alcohol": "C2H5OH", alcohol: "C2H5OH", "grain alcohol": "C2H5OH",
  methanol: "CH3OH", "wood alcohol": "CH3OH",
  methane: "CH4", "natural gas": "CH4", propane: "C3H8", butane: "C4H10", ethylene: "C2H4", acetylene: "C2H2",
  oxygen: "O2", hydrogen: "H2", nitrogen: "N2", chlorine: "Cl2", bromine: "Br2", iodine: "I2", fluorine: "F2",
  "carbon dioxide": "CO2", "carbon monoxide": "CO", carbon: "C", graphite: "C", charcoal: "C",
  sulfur: "S", sulphur: "S", phosphorus: "P",
  rust: "Fe2O3", "iron oxide": "Fe2O3", "iron(iii) oxide": "Fe2O3", "ferric oxide": "Fe2O3", hematite: "Fe2O3",
  "magnesium oxide": "MgO", "aluminium oxide": "Al2O3", "aluminum oxide": "Al2O3", alumina: "Al2O3",
  "potassium chlorate": "KClO3", "potassium permanganate": "KMnO4",
  "silver nitrate": "AgNO3", "copper sulfate": "CuSO4", "copper(ii) sulfate": "CuSO4", "blue vitriol": "CuSO4",
  "sodium nitrate": "NaNO3", "potassium nitrate": "KNO3", saltpeter: "KNO3", saltpetre: "KNO3",
  "ammonium chloride": "NH4Cl", "sal ammoniac": "NH4Cl", "barium chloride": "BaCl2",
  "sodium sulfate": "Na2SO4", "potassium chloride": "KCl", "calcium chloride": "CaCl2",
  iron: "Fe", zinc: "Zn", magnesium: "Mg", aluminium: "Al", aluminum: "Al", copper: "Cu",
  sodium: "Na", potassium: "K", calcium: "Ca", silver: "Ag", gold: "Au", lead: "Pb", tin: "Sn", nickel: "Ni",
};

/** Heuristic: does this token look like a SMILES structure rather than a formula/name? */
function looksLikeSmiles(s: string): boolean {
  if (/\s/.test(s)) return false; // names have spaces
  if (/[=#\[\]@\/\\]/.test(s)) return true; // bond / bracket-atom / chirality / cis-trans syntax
  if (/(^|[^A-Za-z])[cnops]\d?/.test(s)) return true; // aromatic lowercase atom (benzene c1ccccc1)
  return false;
}

export type ResolveSource = "smiles" | "formula" | "alias" | "pubchem" | "unresolved";

export interface ResolvedReactant {
  input: string;
  formula: string | null;
  name?: string;
  source: ResolveSource;
}

/** Resolve one reactant token (name or formula) to a conventional formula. */
export async function resolveReactant(token: string): Promise<ResolvedReactant> {
  const t = token.trim();
  if (!t) return { input: token, formula: null, source: "unresolved" };

  // A SMILES structure — convert to its molecular formula.
  if (looksLikeSmiles(t)) {
    try {
      return { input: t, formula: canonicalize(smilesToFormula(t)), name: t, source: "smiles" };
    } catch {
      /* not valid SMILES — fall through */
    }
  }

  // Already a valid formula.
  try {
    parseFormula(t);
    return { input: t, formula: canonicalize(t), source: "formula" };
  } catch {
    /* not a formula — treat as a name */
  }

  // Common-name alias (colloquial / systematic).
  const alias = COMMON_NAMES[t.toLowerCase().replace(/\s+/g, " ")];
  if (alias) return { input: t, formula: alias, name: t, source: "alias" };

  // Live PubChem name resolution.
  try {
    const data = await fetchPubChemData(t);
    if (data && data.formula) {
      const f = String(data.formula);
      try {
        parseFormula(f); // ensure the engine can parse it (real elements)
        return { input: t, formula: canonicalize(f), name: data.name || t, source: "pubchem" };
      } catch {
        /* unsupported formula */
      }
    }
  } catch {
    /* PubChem unreachable / not found — fall through */
  }

  return { input: t, formula: null, name: t, source: "unresolved" };
}

/** Resolve a list of reactant tokens in parallel. */
export function resolveReactants(tokens: string[]): Promise<ResolvedReactant[]> {
  return Promise.all(tokens.map(resolveReactant));
}
