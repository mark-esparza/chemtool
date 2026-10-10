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
// Structural analog search (as returned by /api/analogs)
// ---------------------------------------------------------------------------

/** Upper bounds applied to on-device computed properties. null = not applied. */
export interface AnalogFilters {
  mwMax: number | null;
  logpMax: number | null;
  tpsaMax: number | null;
  hbdMax: number | null;
  hbaMax: number | null;
  rotMax: number | null;
  lipinskiOnly: boolean;
}

/** Descriptors as PubChem reports them for a deposited compound. */
export interface PubChemDescriptors {
  mw: number | null;
  xlogp: number | null;
  tpsa: number | null;
  hbd: number | null;
  hba: number | null;
  rotatableBonds: number | null;
}

export interface AnalogCandidate {
  cid: number;
  name: string | null;
  formula: string | null;
  smiles: string | null;
  /** Authoritative values from PubChem. */
  pubchem: PubChemDescriptors;
  /** Values recomputed on-device from the structure; null if not parseable. */
  computed: MolecularProperties | null;
  computeError: string | null;
  /** 1 - Tanimoto similarity to the seed, on this app's own fingerprint. */
  tanimotoDistance: number | null;
  passes: boolean;
  failedFilters: string[];
  paretoOptimal: boolean;
  url: string;
}

export interface AnalogResult {
  seed: {
    cid: number;
    name: string;
    formula: string;
    smiles: string;
    hmdbAccession: string | null;
    computed: MolecularProperties | null;
    url: string;
  };
  query: {
    threshold: number;
    maxRecords: number;
    truncated: boolean;
    filters: AnalogFilters;
    paretoObjectives: string[];
    retrievedAt: string;
  };
  candidates: AnalogCandidate[];
  counts: { retrieved: number; passing: number; paretoOptimal: number; notScored: number };
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
