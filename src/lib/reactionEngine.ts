/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic chemical reaction engine.
 *
 * Zero-dependency tools for a general chemistry simulator that works for ANY
 * chemical element (full periodic table). Provides formula parsing, molar-mass
 * computation, an exact rational-arithmetic equation balancer, reaction
 * classification heuristics, and a curated knowledge base of common reactions
 * used as an offline product-prediction fallback.
 */

// ---------------------------------------------------------------------------
// Periodic table: symbol -> { name, atomicNumber, mass }
// Standard atomic weights (IUPAC conventional values). Covers all 118 elements
// so the simulator can reason about any element a student throws at it.
// ---------------------------------------------------------------------------
export interface ElementInfo {
  name: string;
  number: number;
  mass: number;
}

export const PERIODIC_TABLE: Record<string, ElementInfo> = {
  H: { name: "Hydrogen", number: 1, mass: 1.008 },
  He: { name: "Helium", number: 2, mass: 4.0026 },
  Li: { name: "Lithium", number: 3, mass: 6.94 },
  Be: { name: "Beryllium", number: 4, mass: 9.0122 },
  B: { name: "Boron", number: 5, mass: 10.81 },
  C: { name: "Carbon", number: 6, mass: 12.011 },
  N: { name: "Nitrogen", number: 7, mass: 14.007 },
  O: { name: "Oxygen", number: 8, mass: 15.999 },
  F: { name: "Fluorine", number: 9, mass: 18.998 },
  Ne: { name: "Neon", number: 10, mass: 20.18 },
  Na: { name: "Sodium", number: 11, mass: 22.99 },
  Mg: { name: "Magnesium", number: 12, mass: 24.305 },
  Al: { name: "Aluminium", number: 13, mass: 26.982 },
  Si: { name: "Silicon", number: 14, mass: 28.085 },
  P: { name: "Phosphorus", number: 15, mass: 30.974 },
  S: { name: "Sulfur", number: 16, mass: 32.06 },
  Cl: { name: "Chlorine", number: 17, mass: 35.45 },
  Ar: { name: "Argon", number: 18, mass: 39.948 },
  K: { name: "Potassium", number: 19, mass: 39.098 },
  Ca: { name: "Calcium", number: 20, mass: 40.078 },
  Sc: { name: "Scandium", number: 21, mass: 44.956 },
  Ti: { name: "Titanium", number: 22, mass: 47.867 },
  V: { name: "Vanadium", number: 23, mass: 50.942 },
  Cr: { name: "Chromium", number: 24, mass: 51.996 },
  Mn: { name: "Manganese", number: 25, mass: 54.938 },
  Fe: { name: "Iron", number: 26, mass: 55.845 },
  Co: { name: "Cobalt", number: 27, mass: 58.933 },
  Ni: { name: "Nickel", number: 28, mass: 58.693 },
  Cu: { name: "Copper", number: 29, mass: 63.546 },
  Zn: { name: "Zinc", number: 30, mass: 65.38 },
  Ga: { name: "Gallium", number: 31, mass: 69.723 },
  Ge: { name: "Germanium", number: 32, mass: 72.63 },
  As: { name: "Arsenic", number: 33, mass: 74.922 },
  Se: { name: "Selenium", number: 34, mass: 78.971 },
  Br: { name: "Bromine", number: 35, mass: 79.904 },
  Kr: { name: "Krypton", number: 36, mass: 83.798 },
  Rb: { name: "Rubidium", number: 37, mass: 85.468 },
  Sr: { name: "Strontium", number: 38, mass: 87.62 },
  Y: { name: "Yttrium", number: 39, mass: 88.906 },
  Zr: { name: "Zirconium", number: 40, mass: 91.224 },
  Nb: { name: "Niobium", number: 41, mass: 92.906 },
  Mo: { name: "Molybdenum", number: 42, mass: 95.95 },
  Tc: { name: "Technetium", number: 43, mass: 98 },
  Ru: { name: "Ruthenium", number: 44, mass: 101.07 },
  Rh: { name: "Rhodium", number: 45, mass: 102.91 },
  Pd: { name: "Palladium", number: 46, mass: 106.42 },
  Ag: { name: "Silver", number: 47, mass: 107.87 },
  Cd: { name: "Cadmium", number: 48, mass: 112.41 },
  In: { name: "Indium", number: 49, mass: 114.82 },
  Sn: { name: "Tin", number: 50, mass: 118.71 },
  Sb: { name: "Antimony", number: 51, mass: 121.76 },
  Te: { name: "Tellurium", number: 52, mass: 127.6 },
  I: { name: "Iodine", number: 53, mass: 126.9 },
  Xe: { name: "Xenon", number: 54, mass: 131.29 },
  Cs: { name: "Caesium", number: 55, mass: 132.91 },
  Ba: { name: "Barium", number: 56, mass: 137.33 },
  La: { name: "Lanthanum", number: 57, mass: 138.91 },
  Ce: { name: "Cerium", number: 58, mass: 140.12 },
  Pr: { name: "Praseodymium", number: 59, mass: 140.91 },
  Nd: { name: "Neodymium", number: 60, mass: 144.24 },
  Pm: { name: "Promethium", number: 61, mass: 145 },
  Sm: { name: "Samarium", number: 62, mass: 150.36 },
  Eu: { name: "Europium", number: 63, mass: 151.96 },
  Gd: { name: "Gadolinium", number: 64, mass: 157.25 },
  Tb: { name: "Terbium", number: 65, mass: 158.93 },
  Dy: { name: "Dysprosium", number: 66, mass: 162.5 },
  Ho: { name: "Holmium", number: 67, mass: 164.93 },
  Er: { name: "Erbium", number: 68, mass: 167.26 },
  Tm: { name: "Thulium", number: 69, mass: 168.93 },
  Yb: { name: "Ytterbium", number: 70, mass: 173.05 },
  Lu: { name: "Lutetium", number: 71, mass: 174.97 },
  Hf: { name: "Hafnium", number: 72, mass: 178.49 },
  Ta: { name: "Tantalum", number: 73, mass: 180.95 },
  W: { name: "Tungsten", number: 74, mass: 183.84 },
  Re: { name: "Rhenium", number: 75, mass: 186.21 },
  Os: { name: "Osmium", number: 76, mass: 190.23 },
  Ir: { name: "Iridium", number: 77, mass: 192.22 },
  Pt: { name: "Platinum", number: 78, mass: 195.08 },
  Au: { name: "Gold", number: 79, mass: 196.97 },
  Hg: { name: "Mercury", number: 80, mass: 200.59 },
  Tl: { name: "Thallium", number: 81, mass: 204.38 },
  Pb: { name: "Lead", number: 82, mass: 207.2 },
  Bi: { name: "Bismuth", number: 83, mass: 208.98 },
  Po: { name: "Polonium", number: 84, mass: 209 },
  At: { name: "Astatine", number: 85, mass: 210 },
  Rn: { name: "Radon", number: 86, mass: 222 },
  Fr: { name: "Francium", number: 87, mass: 223 },
  Ra: { name: "Radium", number: 88, mass: 226 },
  Ac: { name: "Actinium", number: 89, mass: 227 },
  Th: { name: "Thorium", number: 90, mass: 232.04 },
  Pa: { name: "Protactinium", number: 91, mass: 231.04 },
  U: { name: "Uranium", number: 92, mass: 238.03 },
  Np: { name: "Neptunium", number: 93, mass: 237 },
  Pu: { name: "Plutonium", number: 94, mass: 244 },
  Am: { name: "Americium", number: 95, mass: 243 },
  Cm: { name: "Curium", number: 96, mass: 247 },
  Bk: { name: "Berkelium", number: 97, mass: 247 },
  Cf: { name: "Californium", number: 98, mass: 251 },
  Es: { name: "Einsteinium", number: 99, mass: 252 },
  Fm: { name: "Fermium", number: 100, mass: 257 },
  Md: { name: "Mendelevium", number: 101, mass: 258 },
  No: { name: "Nobelium", number: 102, mass: 259 },
  Lr: { name: "Lawrencium", number: 103, mass: 262 },
  Rf: { name: "Rutherfordium", number: 104, mass: 267 },
  Db: { name: "Dubnium", number: 105, mass: 268 },
  Sg: { name: "Seaborgium", number: 106, mass: 269 },
  Bh: { name: "Bohrium", number: 107, mass: 270 },
  Hs: { name: "Hassium", number: 108, mass: 269 },
  Mt: { name: "Meitnerium", number: 109, mass: 278 },
  Ds: { name: "Darmstadtium", number: 110, mass: 281 },
  Rg: { name: "Roentgenium", number: 111, mass: 282 },
  Cn: { name: "Copernicium", number: 112, mass: 285 },
  Nh: { name: "Nihonium", number: 113, mass: 286 },
  Fl: { name: "Flerovium", number: 114, mass: 289 },
  Mc: { name: "Moscovium", number: 115, mass: 290 },
  Lv: { name: "Livermorium", number: 116, mass: 293 },
  Ts: { name: "Tennessine", number: 117, mass: 294 },
  Og: { name: "Oganesson", number: 118, mass: 294 },
};

// ---------------------------------------------------------------------------
// Formula parsing
// ---------------------------------------------------------------------------
export type ElementCounts = Record<string, number>;

/**
 * Parse a chemical formula into element counts.
 * Supports nested parentheses/brackets, subscript multipliers, and hydrate dots
 * (e.g. "CuSO4.5H2O" or "CuSO4·5H2O"). Leading stoichiometric coefficients on a
 * fragment (e.g. "5H2O") are honored.
 *
 * Throws on unknown element symbols so callers can reject nonsense formulas.
 */
export function parseFormula(formula: string): ElementCounts {
  const cleaned = formula.trim().replace(/·/g, ".").replace(/\s+/g, "");
  if (!cleaned) throw new Error("Empty formula");

  // Split on hydrate/adduct dots at the top level and sum the fragments.
  const counts: ElementCounts = {};
  const fragments = cleaned.split(".");
  for (const frag of fragments) {
    if (!frag) continue;
    // Honor a leading integer multiplier on the whole fragment (e.g. 5H2O).
    const lead = frag.match(/^(\d+)(.*)$/);
    let multiplier = 1;
    let body = frag;
    if (lead && lead[2] && /[A-Za-z(\[]/.test(lead[2][0])) {
      multiplier = parseInt(lead[1], 10);
      body = lead[2];
    }
    const fragCounts = parseFragment(body);
    for (const [el, n] of Object.entries(fragCounts)) {
      counts[el] = (counts[el] || 0) + n * multiplier;
    }
  }
  return counts;
}

function parseFragment(str: string): ElementCounts {
  const counts: ElementCounts = {};
  const stack: ElementCounts[] = [counts];
  let i = 0;
  const n = str.length;

  while (i < n) {
    const ch = str[i];

    if (ch === "(" || ch === "[" || ch === "{") {
      stack.push({});
      i++;
      continue;
    }

    if (ch === ")" || ch === "]" || ch === "}") {
      i++;
      // Read multiplier after the closing bracket.
      let numStr = "";
      while (i < n && /\d/.test(str[i])) numStr += str[i++];
      const mult = numStr ? parseInt(numStr, 10) : 1;
      const group = stack.pop();
      if (!group || stack.length === 0) {
        throw new Error("Mismatched brackets in formula");
      }
      const top = stack[stack.length - 1];
      for (const [el, c] of Object.entries(group)) {
        top[el] = (top[el] || 0) + c * mult;
      }
      continue;
    }

    // Charge markers and stray symbols are ignored for mass-balance purposes.
    if (ch === "+" || ch === "-" || ch === "^") {
      i++;
      while (i < n && /\d/.test(str[i])) i++;
      continue;
    }

    // Element symbol: uppercase letter then optional lowercase letter(s).
    const symMatch = str.slice(i).match(/^[A-Z][a-z]{0,2}/);
    if (!symMatch) {
      throw new Error(`Unexpected character '${ch}' in formula`);
    }
    let symbol = symMatch[0];
    // Prefer the longest valid known symbol (handles e.g. "Co" vs "C" + "o").
    while (symbol.length > 1 && !PERIODIC_TABLE[symbol]) {
      symbol = symbol.slice(0, -1);
    }
    if (!PERIODIC_TABLE[symbol]) {
      throw new Error(`Unknown element symbol '${symMatch[0]}'`);
    }
    i += symbol.length;

    let numStr = "";
    while (i < n && /\d/.test(str[i])) numStr += str[i++];
    const cnt = numStr ? parseInt(numStr, 10) : 1;

    const top = stack[stack.length - 1];
    top[symbol] = (top[symbol] || 0) + cnt;
  }

  if (stack.length !== 1) {
    throw new Error("Mismatched brackets in formula");
  }
  return counts;
}

/** Compute molar mass (g/mol) of a formula. */
export function molarMass(formula: string): number {
  const counts = parseFormula(formula);
  let mass = 0;
  for (const [el, n] of Object.entries(counts)) {
    mass += PERIODIC_TABLE[el].mass * n;
  }
  return parseFloat(mass.toFixed(3));
}

// ---------------------------------------------------------------------------
// Exact rational arithmetic (BigInt fractions) for equation balancing
// ---------------------------------------------------------------------------
function bgcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

class Frac {
  n: bigint;
  d: bigint;
  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new Error("Division by zero");
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = bgcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }
  static from(x: number): Frac {
    return new Frac(BigInt(Math.round(x)));
  }
  add(o: Frac): Frac {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Frac): Frac {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Frac): Frac {
    return new Frac(this.n * o.n, this.d * o.d);
  }
  div(o: Frac): Frac {
    return new Frac(this.n * o.d, this.d * o.n);
  }
  isZero(): boolean {
    return this.n === 0n;
  }
}

export interface BalanceResult {
  balanced: boolean;
  coefficients: number[]; // aligned with [...reactants, ...products]
  reason?: string;
}

/**
 * Balance a chemical equation using exact linear algebra.
 *
 * Builds an element-conservation matrix (reactants positive, products negative),
 * computes the reduced row echelon form over the rationals, and extracts the
 * smallest positive integer coefficient vector from the null space.
 *
 * Returns balanced:false when no non-trivial positive solution exists (the
 * proposed reaction cannot be mass-balanced as written) or when the null space
 * is under-determined (ambiguous — more than one degree of freedom).
 */
export function balanceEquation(
  reactants: string[],
  products: string[]
): BalanceResult {
  const species = [...reactants, ...products];
  if (species.length < 2) {
    return { balanced: false, coefficients: [], reason: "Need at least two species." };
  }

  let parsed: ElementCounts[];
  try {
    parsed = species.map((s) => parseFormula(s));
  } catch (e: any) {
    return { balanced: false, coefficients: [], reason: e?.message || "Formula parse error" };
  }

  // Element index.
  const elements = Array.from(new Set(parsed.flatMap((p) => Object.keys(p))));
  const nSpecies = species.length;
  const nReact = reactants.length;

  // Matrix rows = elements, cols = species. Product columns negated.
  const M: Frac[][] = elements.map((el) =>
    parsed.map((p, j) => {
      const v = p[el] || 0;
      return new Frac(BigInt(j < nReact ? v : -v));
    })
  );

  // Gaussian elimination to reduced row echelon form.
  const rows = M.length;
  const cols = nSpecies;
  const pivotCols: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    // Find pivot in column c at or below row r.
    let pivot = -1;
    for (let i = r; i < rows; i++) {
      if (!M[i][c].isZero()) {
        pivot = i;
        break;
      }
    }
    if (pivot === -1) continue;
    [M[r], M[pivot]] = [M[pivot], M[r]];
    // Normalize pivot row.
    const pv = M[r][c];
    for (let j = 0; j < cols; j++) M[r][j] = M[r][j].div(pv);
    // Eliminate this column from all other rows.
    for (let i = 0; i < rows; i++) {
      if (i === r) continue;
      const factor = M[i][c];
      if (factor.isZero()) continue;
      for (let j = 0; j < cols; j++) {
        M[i][j] = M[i][j].sub(factor.mul(M[r][j]));
      }
    }
    pivotCols.push(c);
    r++;
  }

  const rank = pivotCols.length;
  const freeCols = [];
  for (let c = 0; c < cols; c++) {
    if (!pivotCols.includes(c)) freeCols.push(c);
  }

  if (freeCols.length === 0) {
    return { balanced: false, coefficients: [], reason: "No non-trivial solution — equation cannot be balanced as written." };
  }
  if (freeCols.length > 1) {
    return {
      balanced: false,
      coefficients: [],
      reason: "Under-determined (multiple independent solutions) — specify products more precisely.",
    };
  }

  // One free variable: set it to 1, back-solve the pivots.
  const free = freeCols[0];
  const sol: Frac[] = new Array(cols).fill(null).map(() => new Frac(0n));
  sol[free] = new Frac(1n);
  for (let i = 0; i < rank; i++) {
    const pc = pivotCols[i];
    // pivot value = -sum(coeff of free * value) — from RREF row i.
    sol[pc] = M[i][free].mul(new Frac(-1n));
  }

  // Scale to integers: multiply by LCM of denominators.
  let lcm = 1n;
  for (const f of sol) lcm = (lcm / bgcd(lcm, f.d)) * f.d;
  const ints = sol.map((f) => (f.n * lcm) / f.d);

  // Normalize sign so coefficients are positive; divide by GCD.
  let allNeg = ints.every((v) => v <= 0n);
  let scaled = allNeg ? ints.map((v) => -v) : ints;
  let g = 0n;
  for (const v of scaled) g = bgcd(g, v);
  if (g === 0n) g = 1n;
  scaled = scaled.map((v) => v / g);

  // Validity: every coefficient must be a positive integer.
  if (scaled.some((v) => v <= 0n)) {
    return {
      balanced: false,
      coefficients: [],
      reason: "No physical solution with all-positive coefficients — products may be incorrect.",
    };
  }

  return { balanced: true, coefficients: scaled.map((v) => Number(v)) };
}

/** Verify element conservation given species and integer coefficients. */
export function verifyBalance(
  reactants: string[],
  products: string[],
  coefficients: number[]
): boolean {
  const species = [...reactants, ...products];
  if (coefficients.length !== species.length) return false;
  const nReact = reactants.length;
  const totals: ElementCounts = {};
  try {
    species.forEach((s, j) => {
      const counts = parseFormula(s);
      const sign = j < nReact ? 1 : -1;
      for (const [el, n] of Object.entries(counts)) {
        totals[el] = (totals[el] || 0) + sign * coefficients[j] * n;
      }
    });
  } catch {
    return false;
  }
  return Object.values(totals).every((v) => Math.abs(v) < 1e-9);
}

// ---------------------------------------------------------------------------
// Reaction classification
// ---------------------------------------------------------------------------
export type ReactionType =
  | "Combustion"
  | "Synthesis (Combination)"
  | "Decomposition"
  | "Single Displacement"
  | "Double Displacement (Metathesis)"
  | "Acid–Base Neutralization"
  | "Precipitation"
  | "Redox"
  | "Unclassified";

const COMMON_ACIDS = ["HCl", "H2SO4", "HNO3", "H3PO4", "HBr", "HI", "CH3COOH", "HF", "H2CO3"];
const COMMON_BASES = ["NaOH", "KOH", "Ca(OH)2", "NH3", "Mg(OH)2", "Ba(OH)2", "LiOH", "NH4OH"];

/**
 * Heuristically classify a reaction from its (already-parsed) species.
 * Returns the most specific applicable label.
 */
export function classifyReaction(reactants: string[], products: string[]): ReactionType {
  const R = reactants.map((s) => s.replace(/\s/g, ""));
  const P = products.map((s) => s.replace(/\s/g, ""));

  const hasO2 = R.includes("O2");
  const producesCO2 = P.includes("CO2");
  const producesH2O = P.includes("H2O");
  const hasCarbon = R.some((r) => {
    try {
      return "C" in parseFormula(r);
    } catch {
      return false;
    }
  });

  // Combustion: fuel + O2 -> CO2 (+ H2O), or any element/compound + O2 -> oxide.
  if (hasO2 && producesCO2 && hasCarbon) return "Combustion";
  if (hasO2 && (producesCO2 || producesH2O)) return "Combustion";

  const acidPresent = R.some((r) => COMMON_ACIDS.includes(r));
  const basePresent = R.some((r) => COMMON_BASES.includes(r));
  if (acidPresent && basePresent && producesH2O) return "Acid–Base Neutralization";

  // Synthesis: multiple reactants -> single product.
  if (R.length >= 2 && P.length === 1) return "Synthesis (Combination)";
  // Decomposition: single reactant -> multiple products.
  if (R.length === 1 && P.length >= 2) return "Decomposition";

  const isElement = (s: string) => {
    try {
      const c = parseFormula(s);
      return Object.keys(c).length === 1;
    } catch {
      return false;
    }
  };
  const reactHasElement = R.some(isElement);

  // Single displacement: an element + a compound -> a new element + a new compound.
  if (R.length === 2 && P.length === 2 && reactHasElement && P.some(isElement)) {
    return "Single Displacement";
  }

  // Double displacement: two compounds swap partners.
  if (R.length === 2 && P.length === 2 && !reactHasElement) {
    if (acidPresent || basePresent) return "Acid–Base Neutralization";
    return "Double Displacement (Metathesis)";
  }

  // Redox fallback if oxygen or a lone element is exchanged.
  if (reactHasElement || hasO2) return "Redox";

  return "Unclassified";
}

// ---------------------------------------------------------------------------
// Energetics heuristic (very rough enthalpy-of-reaction estimate)
// ---------------------------------------------------------------------------
export interface Energetics {
  character: "Exothermic" | "Endothermic" | "Approximately thermoneutral";
  estimatedDeltaH: number; // kJ/mol, sign convention: negative = exothermic
  note: string;
}

/**
 * Provide a qualitative energetics call based on reaction type. This is an
 * educational heuristic, not a thermodynamic calculation from formation
 * enthalpies (which would require a full ΔHf table).
 */
export function estimateEnergetics(type: ReactionType): Energetics {
  switch (type) {
    case "Combustion":
      return { character: "Exothermic", estimatedDeltaH: -890, note: "Combustion reactions release large amounts of heat and light." };
    case "Acid–Base Neutralization":
      return { character: "Exothermic", estimatedDeltaH: -57, note: "Strong acid–base neutralization releases ≈ 57 kJ per mole of water formed." };
    case "Synthesis (Combination)":
      return { character: "Exothermic", estimatedDeltaH: -200, note: "Bond formation in combination reactions is typically net exothermic." };
    case "Decomposition":
      return { character: "Endothermic", estimatedDeltaH: 180, note: "Breaking a compound into pieces usually requires an energy input (heat, light, or electricity)." };
    case "Single Displacement":
      return { character: "Exothermic", estimatedDeltaH: -120, note: "A more reactive element displacing a less reactive one is generally favorable." };
    case "Precipitation":
    case "Double Displacement (Metathesis)":
      return { character: "Approximately thermoneutral", estimatedDeltaH: -20, note: "Metathesis reactions are driven by precipitate, gas, or water formation rather than large heat release." };
    case "Redox":
      return { character: "Exothermic", estimatedDeltaH: -150, note: "Electron-transfer reactions with a strong driving force are commonly exothermic." };
    default:
      return { character: "Approximately thermoneutral", estimatedDeltaH: 0, note: "Insufficient information to estimate the reaction enthalpy." };
  }
}

// ---------------------------------------------------------------------------
// Local reaction knowledge base (offline product prediction fallback)
// ---------------------------------------------------------------------------
export interface KnownReaction {
  reactants: string[];
  products: string[];
  states?: string[]; // aligned to [...reactants, ...products]
  type: ReactionType;
  observations: string;
  conditions?: string;
}

/**
 * Curated set of canonical reactions frequently seen in a general-chemistry
 * course. Keys are order-independent sorted reactant sets.
 */
const KNOWN_REACTIONS: KnownReaction[] = [
  {
    reactants: ["H2", "O2"],
    products: ["H2O"],
    states: ["g", "g", "l"],
    type: "Synthesis (Combination)",
    observations: "Hydrogen burns in oxygen with a pale blue flame, releasing energy and forming water vapour.",
    conditions: "Spark / ignition",
  },
  {
    reactants: ["CH4", "O2"],
    products: ["CO2", "H2O"],
    states: ["g", "g", "g", "g"],
    type: "Combustion",
    observations: "Methane burns with a blue flame producing carbon dioxide and water; strongly exothermic.",
    conditions: "Ignition, excess O2",
  },
  {
    reactants: ["C", "O2"],
    products: ["CO2"],
    states: ["s", "g", "g"],
    type: "Combustion",
    observations: "Carbon glows and burns in oxygen forming carbon dioxide gas.",
    conditions: "Heat",
  },
  {
    reactants: ["Na", "Cl2"],
    products: ["NaCl"],
    states: ["s", "g", "s"],
    type: "Synthesis (Combination)",
    observations: "Sodium reacts vigorously with chlorine gas, emitting bright yellow light and forming white sodium chloride.",
  },
  {
    reactants: ["HCl", "NaOH"],
    products: ["NaCl", "H2O"],
    states: ["aq", "aq", "aq", "l"],
    type: "Acid–Base Neutralization",
    observations: "A colourless neutralization; the mixture warms slightly as salt and water form.",
  },
  {
    reactants: ["H2SO4", "NaOH"],
    products: ["Na2SO4", "H2O"],
    states: ["aq", "aq", "aq", "l"],
    type: "Acid–Base Neutralization",
    observations: "Sulfuric acid is neutralized by sodium hydroxide, releasing heat and forming sodium sulfate.",
  },
  {
    reactants: ["Zn", "HCl"],
    products: ["ZnCl2", "H2"],
    states: ["s", "aq", "aq", "g"],
    type: "Single Displacement",
    observations: "Zinc dissolves in hydrochloric acid, bubbling as hydrogen gas is released.",
  },
  {
    reactants: ["Mg", "O2"],
    products: ["MgO"],
    states: ["s", "g", "s"],
    type: "Combustion",
    observations: "Magnesium burns with an intense white light forming a white magnesium oxide ash.",
    conditions: "Ignition",
  },
  {
    reactants: ["Fe", "O2"],
    products: ["Fe2O3"],
    states: ["s", "g", "s"],
    type: "Synthesis (Combination)",
    observations: "Iron oxidizes to form reddish-brown iron(III) oxide (rust).",
  },
  {
    reactants: ["CaCO3"],
    products: ["CaO", "CO2"],
    states: ["s", "s", "g"],
    type: "Decomposition",
    observations: "Calcium carbonate decomposes on strong heating, releasing carbon dioxide and leaving quicklime.",
    conditions: "Strong heat (~825 °C)",
  },
  {
    reactants: ["H2O2"],
    products: ["H2O", "O2"],
    states: ["aq", "l", "g"],
    type: "Decomposition",
    observations: "Hydrogen peroxide decomposes into water and oxygen; a catalyst (MnO2) accelerates vigorous fizzing.",
    conditions: "Catalyst (MnO2)",
  },
  {
    reactants: ["AgNO3", "NaCl"],
    products: ["AgCl", "NaNO3"],
    states: ["aq", "aq", "s", "aq"],
    type: "Precipitation",
    observations: "A white curdy precipitate of silver chloride forms immediately.",
  },
  {
    reactants: ["BaCl2", "Na2SO4"],
    products: ["BaSO4", "NaCl"],
    states: ["aq", "aq", "s", "aq"],
    type: "Precipitation",
    observations: "A dense white precipitate of barium sulfate forms.",
  },
  {
    reactants: ["Cu", "AgNO3"],
    products: ["Cu(NO3)2", "Ag"],
    states: ["s", "aq", "aq", "s"],
    type: "Single Displacement",
    observations: "Copper displaces silver; shiny silver crystals grow and the solution turns blue.",
  },
  {
    reactants: ["N2", "H2"],
    products: ["NH3"],
    states: ["g", "g", "g"],
    type: "Synthesis (Combination)",
    observations: "Nitrogen and hydrogen combine to form ammonia (Haber process).",
    conditions: "High pressure, ~450 °C, Fe catalyst",
  },
  {
    reactants: ["C3H8", "O2"],
    products: ["CO2", "H2O"],
    states: ["g", "g", "g", "g"],
    type: "Combustion",
    observations: "Propane burns cleanly in excess oxygen with a hot blue flame.",
    conditions: "Ignition",
  },
  {
    reactants: ["C2H5OH", "O2"],
    products: ["CO2", "H2O"],
    states: ["l", "g", "g", "g"],
    type: "Combustion",
    observations: "Ethanol burns with a pale blue flame producing carbon dioxide and water.",
    conditions: "Ignition",
  },
  {
    reactants: ["NaHCO3", "CH3COOH"],
    products: ["CH3COONa", "H2O", "CO2"],
    states: ["s", "aq", "aq", "l", "g"],
    type: "Double Displacement (Metathesis)",
    observations: "Baking soda and vinegar fizz vigorously as carbon dioxide gas is released.",
  },
  {
    reactants: ["CaO", "H2O"],
    products: ["Ca(OH)2"],
    states: ["s", "l", "aq"],
    type: "Synthesis (Combination)",
    observations: "Quicklime reacts exothermically with water (slaking), forming calcium hydroxide and steam.",
  },
  {
    reactants: ["Na", "H2O"],
    products: ["NaOH", "H2"],
    states: ["s", "l", "aq", "g"],
    type: "Single Displacement",
    observations: "Sodium skates across the water surface, fizzing and sometimes igniting the hydrogen released.",
  },
];

/** Normalize a formula for order-independent matching. */
function normFormula(f: string): string {
  return f.replace(/\s/g, "");
}

/**
 * Look up a known reaction by its reactant set (order independent). Returns the
 * predicted products, states, type, and observation string, or null if unknown.
 */
export function lookupKnownReaction(reactants: string[]): KnownReaction | null {
  const target = reactants.map(normFormula).sort();
  for (const rxn of KNOWN_REACTIONS) {
    const known = rxn.reactants.map(normFormula).sort();
    if (known.length !== target.length) continue;
    if (known.every((v, i) => v === target[i])) {
      return rxn;
    }
  }
  return null;
}

// ===========================================================================
// Deterministic product predictor
//
// Rule-based prediction of reaction products for arbitrary reactant sets using
// pure chemistry — ion charges, an activity series, solubility rules, and
// reaction-class logic. No external model is consulted; stoichiometry is then
// resolved exactly by balanceEquation().
// ===========================================================================

// Possible oxidation states of common cations (used when decomposing an
// existing formula — the correct charge is the one that reproduces the formula).
const CATION_CHARGES: Record<string, number[]> = {
  Li: [1], Na: [1], K: [1], Rb: [1], Cs: [1], Ag: [1],
  Be: [2], Mg: [2], Ca: [2], Sr: [2], Ba: [2], Zn: [2], Cd: [2], Ni: [2],
  Co: [2, 3], Fe: [2, 3], Cu: [1, 2], Sn: [2, 4], Pb: [2, 4], Mn: [2, 4],
  Hg: [1, 2], Al: [3], Cr: [2, 3], Bi: [3],
};

// Default cation charge when building a brand-new compound from an element.
const DEFAULT_CATION_CHARGE: Record<string, number> = {
  Li: 1, Na: 1, K: 1, Rb: 1, Cs: 1, Ag: 1,
  Be: 2, Mg: 2, Ca: 2, Sr: 2, Ba: 2, Zn: 2, Cd: 2, Ni: 2, Co: 2, Fe: 2,
  Cu: 2, Sn: 2, Pb: 2, Mn: 2, Hg: 2, Al: 3, Cr: 3, Bi: 3,
};

// Preferred oxide of a metal formed on direct combination with O2.
const SPECIAL_METAL_OXIDE: Record<string, string> = {
  Fe: "Fe2O3", Cu: "CuO", Cr: "Cr2O3", Mn: "MnO2", Sn: "SnO2", Pb: "PbO", Al: "Al2O3",
};

// Oxide formed by a nonmetal element burning in O2.
const NONMETAL_OXIDE: Record<string, string> = { C: "CO2", S: "SO2", P: "P2O5" };

// Anions: formula -> charge (polyatomic first, then monatomic).
const ANION_CHARGES: Record<string, number> = {
  OH: -1, NO3: -1, NO2: -1, CH3COO: -1, HCO3: -1, ClO3: -1, ClO4: -1, ClO: -1,
  MnO4: -1, CN: -1, SCN: -1, HSO4: -1,
  SO4: -2, SO3: -2, CO3: -2, CrO4: -2, Cr2O7: -2, C2O4: -2, HPO4: -2,
  PO4: -3, PO3: -3,
  F: -1, Cl: -1, Br: -1, I: -1, O: -2, S: -2, N: -3,
};

// Acids: formula -> conjugate anion + number of ionizable H.
const ACIDS: Record<string, { anion: string; h: number }> = {
  HCl: { anion: "Cl", h: 1 }, HBr: { anion: "Br", h: 1 }, HI: { anion: "I", h: 1 },
  HF: { anion: "F", h: 1 }, HNO3: { anion: "NO3", h: 1 }, HNO2: { anion: "NO2", h: 1 },
  H2SO4: { anion: "SO4", h: 2 }, H2SO3: { anion: "SO3", h: 2 },
  H2CO3: { anion: "CO3", h: 2 }, H3PO4: { anion: "PO4", h: 3 },
  CH3COOH: { anion: "CH3COO", h: 1 }, HClO3: { anion: "ClO3", h: 1 },
  HClO4: { anion: "ClO4", h: 1 }, HCN: { anion: "CN", h: 1 },
};

// Nonmetal oxide + water -> oxoacid.
const OXIDE_TO_ACID: Record<string, string> = {
  CO2: "H2CO3", SO2: "H2SO3", SO3: "H2SO4", N2O5: "HNO3", P2O5: "H3PO4", P4O10: "H3PO4",
};

// Metal activity series (most -> least reactive); "H" marks the hydrogen line.
const ACTIVITY_SERIES = [
  "Li", "K", "Ba", "Sr", "Ca", "Na", "Mg", "Al", "Mn", "Zn", "Cr", "Fe", "Cd",
  "Co", "Ni", "Sn", "Pb", "H", "Cu", "Hg", "Ag", "Pt", "Au",
];

// Metals reactive enough to displace hydrogen from cold water.
const WATER_REACTIVE_METALS = ["Li", "Na", "K", "Rb", "Cs", "Ca", "Sr", "Ba"];

// Halogen displacement order (most -> least reactive).
const HALOGEN_ORDER = ["F", "Cl", "Br", "I"];

const DIATOMIC = new Set(["H2", "N2", "O2", "F2", "Cl2", "Br2", "I2"]);

function isMetal(sym: string): boolean {
  return sym in DEFAULT_CATION_CHARGE;
}

/** Deep element-count equality. */
function countsEqual(a: ElementCounts, b: ElementCounts): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] || 0) !== (b[k] || 0)) return false;
  }
  return true;
}

/** True when an ion is polyatomic (needs parentheses when subscripted). */
function isPolyatomic(ion: string): boolean {
  return !(PERIODIC_TABLE[ion] && ion.length <= 2 && /^[A-Z][a-z]?$/.test(ion));
}

function subscriptPart(part: string, n: number, poly: boolean): string {
  if (n === 1) return part;
  return poly ? `(${part})${n}` : `${part}${n}`;
}

/**
 * Compose the neutral formula of an ionic compound from a cation and anion,
 * crossing charge magnitudes and reducing by their GCD.
 */
export function buildSalt(cation: string, catCharge: number, anion: string, anCharge: number): string {
  const a = Math.abs(catCharge);
  const b = Math.abs(anCharge);
  let g = 1;
  for (let d = Math.min(a, b); d >= 1; d--) {
    if (a % d === 0 && b % d === 0) { g = d; break; }
  }
  const nCat = b / g;
  const nAn = a / g;

  // Acetate reads more naturally written after the cation as CH3COO.
  if (anion === "CH3COO") {
    return subscriptPart(cation, nCat, isPolyatomic(cation)) + subscriptPart("CH3COO", nAn, true);
  }
  return (
    subscriptPart(cation, nCat, isPolyatomic(cation)) +
    subscriptPart(anion, nAn, isPolyatomic(anion))
  );
}

export interface IonicParts {
  cation: string;
  catCharge: number;
  anion: string;
  anCharge: number;
}

/**
 * Decompose an ionic-compound formula into its cation and anion by enumerating
 * known ions and finding the pair whose neutral formula reproduces the input.
 * Prefers the most specific (largest polyatomic) anion match.
 */
export function parseIonic(formula: string): IonicParts | null {
  let target: ElementCounts;
  try {
    target = parseFormula(formula);
  } catch {
    return null;
  }

  const cationCandidates: Array<{ sym: string; charge: number }> = [{ sym: "NH4", charge: 1 }];
  for (const [sym, charges] of Object.entries(CATION_CHARGES)) {
    for (const c of charges) cationCandidates.push({ sym, charge: c });
  }

  let best: IonicParts | null = null;
  let bestAnionSize = -1;
  for (const cat of cationCandidates) {
    for (const [anion, anCharge] of Object.entries(ANION_CHARGES)) {
      let built: string;
      try {
        built = buildSalt(cat.sym, cat.charge, anion, anCharge);
        if (!countsEqual(parseFormula(built), target)) continue;
      } catch {
        continue;
      }
      const anionSize = Object.values(parseFormula(anion)).reduce((s, v) => s + v, 0);
      if (anionSize > bestAnionSize) {
        bestAnionSize = anionSize;
        best = { cation: cat.sym, catCharge: cat.charge, anion, anCharge };
      }
    }
  }
  return best;
}

/** Return the element symbol if the formula is a single element (incl. diatomics). */
function singleElement(formula: string): string | null {
  try {
    const c = parseFormula(formula);
    const keys = Object.keys(c);
    return keys.length === 1 ? keys[0] : null;
  } catch {
    return null;
  }
}

type CompoundKind =
  | "O2" | "H2" | "N2" | "water" | "peroxide" | "ammonia" | "halogen"
  | "metal" | "nonmetal_element" | "acid" | "base" | "carbonate"
  | "bicarbonate" | "metal_oxide" | "nonmetal_oxide" | "chlorate" | "salt" | "other";

interface Classified {
  formula: string;
  kind: CompoundKind;
  ionic?: IonicParts | null;
  element?: string;
}

function classifyCompound(formula: string): Classified {
  const f = formula.replace(/\s/g, "");
  if (f === "O2") return { formula: f, kind: "O2" };
  if (f === "H2") return { formula: f, kind: "H2" };
  if (f === "N2") return { formula: f, kind: "N2" };
  if (f === "H2O") return { formula: f, kind: "water" };
  if (f === "H2O2") return { formula: f, kind: "peroxide" };
  if (f === "NH3") return { formula: f, kind: "ammonia" };
  if (["F2", "Cl2", "Br2", "I2"].includes(f)) return { formula: f, kind: "halogen", element: f[0] === "C" ? "Cl" : f[0] === "B" ? "Br" : f[0] };
  if (["CO2", "CO", "SO2", "SO3", "NO", "NO2", "N2O5", "P2O5", "P4O10"].includes(f)) return { formula: f, kind: "nonmetal_oxide" };
  if (f in ACIDS) return { formula: f, kind: "acid" };

  const el = singleElement(f);
  if (el && !DIATOMIC.has(f)) {
    return { formula: f, kind: isMetal(el) ? "metal" : "nonmetal_element", element: el };
  }
  if (el && DIATOMIC.has(f)) {
    // Diatomic nonmetal element already handled above except generic
    return { formula: f, kind: "nonmetal_element", element: el };
  }

  const ionic = parseIonic(f);
  if (ionic) {
    switch (ionic.anion) {
      case "OH": return { formula: f, kind: "base", ionic };
      case "CO3": return { formula: f, kind: "carbonate", ionic };
      case "HCO3": return { formula: f, kind: "bicarbonate", ionic };
      case "O": return { formula: f, kind: "metal_oxide", ionic };
      case "ClO3": return { formula: f, kind: "chlorate", ionic };
      default: return { formula: f, kind: "salt", ionic };
    }
  }
  return { formula: f, kind: "other" };
}

/** Solubility rules -> is the salt soluble in water? */
function isSoluble(cation: string, anion: string): boolean {
  if (["Li", "Na", "K", "Rb", "Cs", "NH4"].includes(cation)) return true;
  if (["NO3", "ClO3", "ClO4", "CH3COO", "NO2"].includes(anion)) return true;
  if (["Cl", "Br", "I"].includes(anion)) return !["Ag", "Pb", "Hg", "Cu"].includes(cation);
  if (anion === "SO4") return !["Ba", "Sr", "Pb", "Ca", "Ag"].includes(cation);
  if (anion === "OH") return ["Ba", "Sr", "Ca"].includes(cation);
  if (["CO3", "PO4", "SO3", "CrO4", "S", "O"].includes(anion)) return false;
  return true;
}

function saltState(cation: string, anion: string): "aq" | "s" {
  return isSoluble(cation, anion) ? "aq" : "s";
}

export interface Prediction {
  reactionOccurs: boolean;
  products: string[];
  reactantStates: string[];
  productStates: string[];
  type: ReactionType;
  observations: string;
  conditions?: string;
  mechanism?: string;
  hazards?: string;
  reason?: string;
}

function metalOxide(cation: string): string {
  if (SPECIAL_METAL_OXIDE[cation]) return SPECIAL_METAL_OXIDE[cation];
  return buildSalt(cation, DEFAULT_CATION_CHARGE[cation] || 2, "O", -2);
}

function noReaction(reason: string): Prediction {
  return {
    reactionOccurs: false, products: [], reactantStates: [], productStates: [],
    type: "Unclassified", observations: "", reason,
  };
}

/**
 * Predict the products of a reaction deterministically. Returns
 * reactionOccurs=false (with a reason) when no rule applies or no driving force
 * exists — an honest "these do not react" rather than a guess.
 */
export function predictProducts(reactants: string[], conditions = ""): Prediction {
  const species = reactants.map(classifyCompound);
  const kinds = species.map((s) => s.kind);
  const has = (k: CompoundKind) => kinds.includes(k);
  const find = (k: CompoundKind) => species.find((s) => s.kind === k)!;

  // ---- Single-reactant decomposition ----
  if (reactants.length === 1) {
    const s = species[0];
    if (s.kind === "carbonate" && s.ionic) {
      return finish(
        [metalOxide(s.ionic.cation), "CO2"], "Decomposition",
        `${s.formula} decomposes on strong heating, releasing carbon dioxide gas and leaving the metal oxide.`,
        conditions || "Strong heat", reactants
      );
    }
    if (s.kind === "bicarbonate" && s.ionic) {
      const carbonate = buildSalt(s.ionic.cation, s.ionic.catCharge, "CO3", -2);
      return finish([carbonate, "H2O", "CO2"], "Decomposition",
        `${s.formula} decomposes with heat into the carbonate, water, and carbon dioxide.`,
        conditions || "Heat", reactants);
    }
    if (s.kind === "base" && s.ionic) {
      return finish([metalOxide(s.ionic.cation), "H2O"], "Decomposition",
        `${s.formula} decomposes on heating to the metal oxide and water vapour.`,
        conditions || "Heat", reactants);
    }
    if (s.kind === "chlorate" && s.ionic) {
      const chloride = buildSalt(s.ionic.cation, s.ionic.catCharge, "Cl", -1);
      return finish([chloride, "O2"], "Decomposition",
        `${s.formula} decomposes on heating (often with a catalyst) into the chloride and oxygen gas.`,
        conditions || "Heat, MnO2 catalyst", reactants);
    }
    if (s.kind === "peroxide") {
      return finish(["H2O", "O2"], "Decomposition",
        "Hydrogen peroxide decomposes into water and oxygen gas.",
        conditions || "Catalyst (MnO2)", reactants);
    }
    const only = species[0].formula;
    return noReaction(
      `${only} is stable on its own — it won't react or decompose by itself. Add a second reactant (for example an acid, a base, a metal, water, or O₂ to burn it) to see a reaction.`
    );
  }

  // ---- Combustion of a C/H(/O) compound in O2 ----
  if (has("O2") && reactants.length === 2) {
    const fuel = species.find((s) => s.kind !== "O2");
    if (fuel) {
      let counts: ElementCounts = {};
      try { counts = parseFormula(fuel.formula); } catch { counts = {}; }
      const elems = Object.keys(counts);
      const onlyCHO = elems.every((e) => ["C", "H", "O"].includes(e));
      if (onlyCHO && (counts.C || counts.H)) {
        const prods: string[] = [];
        if (counts.C) prods.push("CO2");
        if (counts.H) prods.push("H2O");
        return finish(prods, "Combustion",
          `${fuel.formula} burns in oxygen, releasing heat and light and producing ${prods.join(" and ")}.`,
          conditions || "Ignition", reactants, "Combustion is highly exothermic — keep fuels away from ignition sources and ensure ventilation.");
      }
    }
  }

  // ---- Element + O2 -> oxide (synthesis / combustion) ----
  if (has("O2") && reactants.length === 2) {
    const other = species.find((s) => s.kind !== "O2");
    if (other && (other.kind === "metal" || other.kind === "nonmetal_element" || other.kind === "H2")) {
      const el = other.element || (other.kind === "H2" ? "H" : "");
      if (other.kind === "H2") {
        return finish(["H2O"], "Synthesis (Combination)", "Hydrogen burns in oxygen, combining explosively to form water.", conditions || "Spark", reactants, "Hydrogen–oxygen mixtures are explosive.");
      }
      if (isMetal(el)) {
        return finish([metalOxide(el)], "Synthesis (Combination)",
          `${el} combines with oxygen to form its oxide${SPECIAL_METAL_OXIDE[el] ? "" : ""}.`,
          conditions || "Heat", reactants);
      }
      if (NONMETAL_OXIDE[el]) {
        return finish([NONMETAL_OXIDE[el]], "Combustion",
          `${el} burns in oxygen to form ${NONMETAL_OXIDE[el]}.`,
          conditions || "Ignition", reactants);
      }
    }
  }

  // ---- Acid + Base -> salt + water ----
  if (has("acid") && has("base")) {
    const acid = find("acid");
    const base = find("base");
    const anion = ACIDS[acid.formula].anion;
    const salt = buildSalt(base.ionic!.cation, base.ionic!.catCharge, anion, ANION_CHARGES[anion]);
    return finish([salt, "H2O"], "Acid–Base Neutralization",
      `The acid and base neutralize each other, forming ${salt} (a salt) and water; the mixture warms as heat is released.`,
      conditions, reactants, "Acids and bases are corrosive — add acid to water, never the reverse, and wear eye protection.");
  }

  // ---- Acid + metal oxide -> salt + water ----
  if (has("acid") && has("metal_oxide")) {
    const acid = find("acid");
    const oxide = find("metal_oxide");
    const anion = ACIDS[acid.formula].anion;
    const salt = buildSalt(oxide.ionic!.cation, oxide.ionic!.catCharge, anion, ANION_CHARGES[anion]);
    return finish([salt, "H2O"], "Double Displacement (Metathesis)",
      `The metal oxide is neutralized by the acid, dissolving to give ${salt} and water.`,
      conditions, reactants);
  }

  // ---- Acid + carbonate/bicarbonate -> salt + water + CO2 ----
  if (has("acid") && (has("carbonate") || has("bicarbonate"))) {
    const acid = find("acid");
    const carb = has("carbonate") ? find("carbonate") : find("bicarbonate");
    const anion = ACIDS[acid.formula].anion;
    const salt = buildSalt(carb.ionic!.cation, carb.ionic!.catCharge, anion, ANION_CHARGES[anion]);
    return finish([salt, "H2O", "CO2"], "Double Displacement (Metathesis)",
      `The acid reacts with the carbonate, fizzing vigorously as carbon dioxide gas is released, leaving ${salt} in solution.`,
      conditions, reactants);
  }

  // ---- Active metal + acid -> salt + H2 ----
  if (has("acid") && has("metal")) {
    const acid = find("acid");
    const metal = find("metal");
    const el = metal.element!;
    const mi = ACTIVITY_SERIES.indexOf(el);
    const hi = ACTIVITY_SERIES.indexOf("H");
    if (mi !== -1 && mi < hi) {
      const anion = ACIDS[acid.formula].anion;
      const salt = buildSalt(el, DEFAULT_CATION_CHARGE[el], anion, ANION_CHARGES[anion]);
      return finish([salt, "H2"], "Single Displacement",
        `${el} is more reactive than hydrogen, so it displaces H2 from the acid — bubbles of hydrogen gas form as ${salt} dissolves.`,
        conditions, reactants, "Hydrogen gas is flammable; keep flames away.");
    }
    return noReaction(`${el} sits below hydrogen in the activity series, so it does not displace hydrogen from this acid — no reaction.`);
  }

  // ---- Active metal + water -> hydroxide + H2 ----
  if (has("water") && has("metal")) {
    const metal = find("metal");
    const el = metal.element!;
    if (WATER_REACTIVE_METALS.includes(el)) {
      const hydroxide = buildSalt(el, DEFAULT_CATION_CHARGE[el], "OH", -1);
      return finish([hydroxide, "H2"], "Single Displacement",
        `${el} reacts with water, fizzing as hydrogen gas is released and forming ${hydroxide} in solution.`,
        conditions, reactants, "Alkali metals react violently with water and may ignite the hydrogen released.");
    }
    return noReaction(`${el} is not reactive enough to displace hydrogen from cold water.`);
  }

  // ---- Metal oxide + water -> hydroxide ----
  if (has("water") && has("metal_oxide")) {
    const oxide = find("metal_oxide");
    const hydroxide = buildSalt(oxide.ionic!.cation, oxide.ionic!.catCharge, "OH", -1);
    return finish([hydroxide], "Synthesis (Combination)",
      `The metal oxide reacts with water to form ${hydroxide}; basic (metal) oxides give alkaline hydroxide solutions.`,
      conditions, reactants);
  }

  // ---- Nonmetal oxide + water -> oxoacid ----
  if (has("water") && has("nonmetal_oxide")) {
    const oxide = find("nonmetal_oxide");
    const acid = OXIDE_TO_ACID[oxide.formula];
    if (acid) {
      return finish([acid], "Synthesis (Combination)",
        `The nonmetal oxide dissolves in water to form ${acid}; acidic oxides give acidic solutions.`,
        conditions, reactants);
    }
  }

  // ---- Metal + salt (single displacement) ----
  if (has("metal") && has("salt")) {
    const metal = find("metal");
    const salt = find("salt");
    const el = metal.element!;
    const dissolvedMetal = salt.ionic!.cation;
    const anion = salt.ionic!.anion;
    if (isMetal(dissolvedMetal)) {
      const ai = ACTIVITY_SERIES.indexOf(el);
      const bi = ACTIVITY_SERIES.indexOf(dissolvedMetal);
      if (ai !== -1 && bi !== -1 && ai < bi) {
        const newSalt = buildSalt(el, DEFAULT_CATION_CHARGE[el], anion, ANION_CHARGES[anion]);
        return finish([newSalt, dissolvedMetal], "Single Displacement",
          `${el} is more reactive than ${dissolvedMetal}, so it displaces it from solution — solid ${dissolvedMetal} deposits while ${newSalt} forms.`,
          conditions, reactants);
      }
      return noReaction(`${el} is less reactive than ${dissolvedMetal}, so it cannot displace it — no reaction.`);
    }
  }

  // ---- Metal + metal oxide (thermite / metallothermic reduction) ----
  if (has("metal") && has("metal_oxide")) {
    const metal = find("metal");
    const oxide = find("metal_oxide");
    const el = metal.element!;
    const oxideMetal = oxide.ionic!.cation;
    const ai = ACTIVITY_SERIES.indexOf(el);
    const bi = ACTIVITY_SERIES.indexOf(oxideMetal);
    if (ai !== -1 && bi !== -1 && ai < bi) {
      return finish([metalOxide(el), oxideMetal], "Single Displacement",
        `${el} is more reactive than ${oxideMetal}, so it strips the oxygen away (a thermite-type redox reduction): molten ${oxideMetal} and ${metalOxide(el)} form with an intense release of heat.`,
        conditions || "High-temperature ignition", reactants, "Thermite reactions reach extreme temperatures and are self-sustaining — perform only with proper shielding.");
    }
    return noReaction(`${el} is less reactive than ${oxideMetal}, so it cannot reduce ${oxide.formula} — no reaction.`);
  }

  // ---- H2 or C reduces a metal oxide ----
  if ((has("H2") || has("nonmetal_element")) && has("metal_oxide")) {
    const reducer = species.find((s) => s.kind === "H2" || (s.kind === "nonmetal_element" && s.element === "C"));
    const oxide = find("metal_oxide");
    const oxideMetal = oxide.ionic!.cation;
    const bi = ACTIVITY_SERIES.indexOf(oxideMetal);
    // Only oxides of metals at/below zinc are readily reduced by H2/C.
    if (reducer && bi >= ACTIVITY_SERIES.indexOf("Zn")) {
      if (reducer.kind === "H2") {
        return finish([oxideMetal, "H2O"], "Redox",
          `Hydrogen reduces ${oxide.formula}, pulling off the oxygen to leave metallic ${oxideMetal} and water vapour.`,
          conditions || "Heat", reactants);
      }
      return finish([oxideMetal, "CO2"], "Redox",
        `Carbon reduces ${oxide.formula} (a smelting-type reaction), freeing metallic ${oxideMetal} and releasing carbon dioxide.`,
        conditions || "Strong heat", reactants);
    }
  }

  // ---- Halogen + halide salt (single displacement) ----
  if (has("halogen") && has("salt")) {
    const hal = find("halogen");
    const salt = find("salt");
    const x = hal.element!;
    const y = salt.ionic!.anion;
    if (["Cl", "Br", "I", "F"].includes(y)) {
      const xi = HALOGEN_ORDER.indexOf(x);
      const yi = HALOGEN_ORDER.indexOf(y);
      if (xi !== -1 && yi !== -1 && xi < yi) {
        const newSalt = buildSalt(salt.ionic!.cation, salt.ionic!.catCharge, x, -1);
        const freed = y + "2";
        return finish([newSalt, freed], "Single Displacement",
          `${x}2 is more reactive than ${y}2, so it displaces it — ${freed} is released and ${newSalt} forms.`,
          conditions, reactants);
      }
      return noReaction(`${x}2 is less reactive than ${y}2, so no displacement occurs.`);
    }
  }

  // ---- Metal + nonmetal -> binary ionic compound (synthesis) ----
  if (has("metal") && (has("halogen") || has("nonmetal_element"))) {
    const metal = find("metal");
    const nm = species.find((s) => s.kind === "halogen" || s.kind === "nonmetal_element")!;
    const el = metal.element!;
    let anion = nm.element!;
    if (nm.kind === "halogen") anion = nm.element!;
    if (anion in ANION_CHARGES) {
      const compound = buildSalt(el, DEFAULT_CATION_CHARGE[el], anion, ANION_CHARGES[anion]);
      return finish([compound], "Synthesis (Combination)",
        `${el} combines directly with ${nm.formula} to form the ionic compound ${compound}.`,
        conditions || "Heat", reactants);
    }
  }

  // ---- Double displacement between two ionic compounds (metathesis) ----
  const ionicKinds: CompoundKind[] = ["salt", "base", "carbonate", "bicarbonate", "metal_oxide", "chlorate"];
  const ionics = species.filter((s) => ionicKinds.includes(s.kind) && s.ionic);
  if (ionics.length === 2 && reactants.length === 2) {
    const [a, b] = ionics;
    const p1 = buildSalt(a.ionic!.cation, a.ionic!.catCharge, b.ionic!.anion, b.ionic!.anCharge);
    const p2 = buildSalt(b.ionic!.cation, b.ionic!.catCharge, a.ionic!.anion, a.ionic!.anCharge);
    const s1 = saltState(a.ionic!.cation, b.ionic!.anion);
    const s2 = saltState(b.ionic!.cation, a.ionic!.anion);
    if (s1 === "s" || s2 === "s") {
      const precip = s1 === "s" ? p1 : p2;
      return finish([p1, p2], "Precipitation",
        `The ions exchange partners; insoluble ${precip} comes out of solution as a precipitate, driving the reaction forward.`,
        conditions, reactants, undefined, [s1, s2]);
    }
    return noReaction("All possible products are soluble, so the ions stay in solution as spectators — no net reaction.");
  }

  return noReaction("No deterministic reaction rule matched these reactants. Provide the expected products to balance the equation, or check the formulas.");

  // --- local helper that finalizes a prediction with reactant/product states ---
  function finish(
    products: string[], type: ReactionType, observations: string,
    cond: string, reacts: string[], hazards?: string, productStatesOverride?: string[]
  ): Prediction {
    const reactantStates = reacts.map((r) => defaultState(r));
    const productStates = productStatesOverride || products.map((p) => defaultState(p));
    return {
      reactionOccurs: true, products, reactantStates, productStates, type,
      observations, conditions: cond || undefined, hazards,
    };
  }
}

/** Best-effort physical state for a species at room conditions. */
function defaultState(formula: string): string {
  const f = formula.replace(/\s/g, "");
  if (["O2", "H2", "N2", "Cl2", "F2", "CO2", "CO", "SO2", "SO3", "NO", "NO2", "NH3", "CH4", "C3H8"].includes(f)) return "g";
  if (["H2O", "H2O2", "Br2", "H2SO4", "CH3COOH", "C2H5OH"].includes(f)) return "l";
  const cls = classifyCompound(f);
  if (cls.kind === "metal" || cls.kind === "nonmetal_element" || cls.kind === "metal_oxide") return "s";
  if (cls.kind === "acid") return "aq";
  if (cls.ionic) return saltState(cls.ionic.cation, cls.ionic.anion);
  return "";
}

/** Render a human-readable balanced equation string. */
export function formatEquation(
  reactants: string[],
  products: string[],
  coefficients: number[]
): string {
  const nReact = reactants.length;
  const fmt = (species: string[], offset: number) =>
    species
      .map((s, i) => {
        const c = coefficients[offset + i];
        return c === 1 ? s : `${c} ${s}`;
      })
      .join(" + ");
  return `${fmt(reactants, 0)} → ${fmt(products, nReact)}`;
}
