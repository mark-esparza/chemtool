/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared application types — the single source of truth used by both the
 * browser client and the Express server, so the two can never drift.
 */

import type { MolecularProperties } from "../lib/chemEngine.js";

export type { MolecularProperties };

// ---------------------------------------------------------------------------
// Molecule design pipeline
// ---------------------------------------------------------------------------
export interface PropertyConstraint {
  name: string;
  op: "<=" | ">=" | "==";
  value: number;
  weight: number;
  hard: boolean;
}

export interface DesignBrief {
  objective_summary: string;
  seed_smiles: string;
  property_constraints: PropertyConstraint[];
  admet_limits?: Record<string, string>;
  novelty: {
    min_tanimoto_distance_from_seed: number;
    max: number;
  };
  must_avoid_alerts: string[];
  confidence_required: "low" | "medium" | "high";
  notes?: string;
}

export interface Candidate extends MolecularProperties {
  name: string;
  mutation_rationale: string;
  tanimoto_distance: number;
  is_pareto_optimal: boolean;
  total_cost: number;
  ood_flag: boolean;
  is_parent?: boolean;
}

// ---------------------------------------------------------------------------
// Lab notebook (experiments)
// ---------------------------------------------------------------------------
export type ExperimentOutcome = "success" | "partial" | "failed" | "toxic";

export interface Experiment {
  id: string;
  smiles: string;
  name: string;
  assay: string;
  resultValue: string;
  outcome: ExperimentOutcome;
  notes: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// PubChem compound record (as returned by /api/pubchem/*)
// ---------------------------------------------------------------------------
export interface PubChemCompound {
  cid: number;
  name: string;
  iupac_name: string;
  smiles: string;
  formula: string;
  mw: number | string;
  clogp: number | null;
  tpsa: number | null;
  hbd: number | null;
  hba: number | null;
  rotatable_bonds: number | null;
  description: string;
  descriptionSource: string;
  descriptionUrl?: string;
  synonyms: string[];
  reportUrl: string;
  websiteReportEmbed: string;
}

export interface BatchResult {
  query: string;
  success: boolean;
  data?: PubChemCompound;
  error?: string;
}

// ---------------------------------------------------------------------------
// Reaction simulator (as returned by /api/reaction/simulate)
// ---------------------------------------------------------------------------
export interface ReactionSpecies {
  formula: string;
  role: "reactant" | "product";
  state: string;
  coefficient: number;
  molarMass: number | null;
}

export interface ReactionEnergetics {
  character: "Exothermic" | "Endothermic" | "Approximately thermoneutral";
  estimatedDeltaH: number;
  note: string;
}

// ---------------------------------------------------------------------------
// Product ingredient breakdown (as returned by /api/product/search)
// ---------------------------------------------------------------------------
export interface ProductIngredient {
  name: string;
  percent?: number;
}

export interface ProductBreakdown {
  product: {
    name: string;
    brand: string;
    image: string;
    source: string;
    category: string;
    code: string;
    url: string;
  };
  ingredients: ProductIngredient[];
}

// ---------------------------------------------------------------------------
// HMDB metabolite (as returned by /api/hmdb/search)
// ---------------------------------------------------------------------------
export interface HmdbConcentration {
  biospecimen: string;
  value: string;
  units: string;
  condition?: string;
}

export interface HmdbMetabolite {
  accession: string;
  name: string;
  formula: string | null;
  averageMass: number | null;
  iupacName: string | null;
  smiles: string | null;
  inchikey: string | null;
  state: string | null;
  description: string | null;
  biospecimens: string[];
  tissues: string[];
  pathways: string[];
  diseases: string[];
  concentrations: HmdbConcentration[];
  url: string;
  structureImage: string;
}

export interface ReactionResult {
  reaction_occurs: boolean;
  reactants: string[];
  products: string[];
  balanced: boolean;
  balance_reason?: string;
  reason?: string;
  coefficients: number[];
  equation: string;
  reaction_type: string;
  observations: string;
  conditions?: string;
  mechanism?: string;
  hazards?: string;
  energetics: ReactionEnergetics;
  species: ReactionSpecies[];
  report: string;
  source: string;
}
