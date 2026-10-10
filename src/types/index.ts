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
  /** HMDB accession when PubChem cross-references this compound as a human metabolite. */
  hmdbAccession: string | null;
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
// HMDB metabolite (as returned by /api/hmdb/search and /api/hmdb/batch)
// ---------------------------------------------------------------------------
export interface HmdbConcentration {
  biospecimen: string;
  value: string;
  units: string;
  condition?: string;
}

export interface HmdbPathway {
  name: string;
  smpdbId: string | null;
  keggMapId: string | null;
}

/** An enzyme, transporter, or other protein that acts on the metabolite. */
export interface HmdbProtein {
  name: string;
  gene: string | null;
  type: string | null;
  uniprotId: string | null;
}

export interface HmdbClassification {
  directParent: string | null;
  superClass: string | null;
  class: string | null;
  subClass: string | null;
}

/** Identifiers that link the metabolite to other databases (and back into the app). */
export interface HmdbXrefs {
  pubchemCid: number | null;
  keggId: string | null;
  chebiId: string | null;
  drugbankId: string | null;
}

export interface HmdbMetabolite {
  accession: string;
  name: string;
  formula: string | null;
  averageMass: number | null;
  monoisotopicMass: number | null;
  iupacName: string | null;
  smiles: string | null;
  inchikey: string | null;
  casNumber: string | null;
  state: string | null;
  description: string | null;
  synonyms: string[];
  classification: HmdbClassification | null;
  biospecimens: string[];
  tissues: string[];
  cellularLocations: string[];
  pathways: HmdbPathway[];
  diseases: string[];
  proteins: HmdbProtein[];
  concentrations: HmdbConcentration[];
  xrefs: HmdbXrefs;
  url: string;
  structureImage: string;
}

export interface HmdbBatchResult {
  query: string;
  success: boolean;
  data?: HmdbMetabolite;
  error?: string;
}

export interface ResolvedReactant {
  input: string;
  formula: string | null;
  name?: string;
  source: "smiles" | "formula" | "alias" | "pubchem" | "unresolved";
}

export interface ReactionResult {
  reaction_occurs: boolean;
  reactants: string[];
  resolved_reactants?: ResolvedReactant[];
  assumed_combustion?: boolean;
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
