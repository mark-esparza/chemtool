/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One-shot handoff payloads between features. A feature sets a payload and
 * navigates; the destination feature consumes (takes) it once on mount.
 */

let pendingReactants: string[] | null = null;
let pendingCompound: string | null = null;

export function setPendingReactants(reactants: string[]) {
  pendingReactants = reactants;
}
export function takePendingReactants(): string[] | null {
  const r = pendingReactants;
  pendingReactants = null;
  return r;
}

export function setPendingCompound(query: string) {
  pendingCompound = query;
}
export function takePendingCompound(): string | null {
  const q = pendingCompound;
  pendingCompound = null;
  return q;
}

/** A metabolite name or HMDB accession to open in the Metabolites explorer. */
let pendingMetabolite: string | null = null;

export function setPendingMetabolite(query: string) {
  pendingMetabolite = query;
}
export function takePendingMetabolite(): string | null {
  const q = pendingMetabolite;
  pendingMetabolite = null;
  return q;
}

/** A seed structure for the Molecule Designer (design analogs / compute properties). */
export interface DesignSeed {
  name: string;
  smiles: string;
}
let pendingDesignSeed: DesignSeed | null = null;

export function setPendingDesignSeed(seed: DesignSeed) {
  pendingDesignSeed = seed;
}
export function takePendingDesignSeed(): DesignSeed | null {
  const s = pendingDesignSeed;
  pendingDesignSeed = null;
  return s;
}

/** A pre-filled Lab Notebook entry; the student reviews it and picks the outcome. */
export interface NotebookDraft {
  name: string;
  smiles?: string;
  assay?: string;
  resultValue?: string;
  notes?: string;
  source?: string;
}
let pendingNotebookDraft: NotebookDraft | null = null;

export function setPendingNotebookDraft(draft: NotebookDraft) {
  pendingNotebookDraft = draft;
}
export function takePendingNotebookDraft(): NotebookDraft | null {
  const d = pendingNotebookDraft;
  pendingNotebookDraft = null;
  return d;
}
