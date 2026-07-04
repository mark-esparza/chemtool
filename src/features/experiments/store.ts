/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tiny localStorage-backed store for lab-notebook experiments, shared across
 * features via useSyncExternalStore so a "log" action anywhere updates the list.
 */

import { useSyncExternalStore } from "react";
import type { Experiment } from "../../types";

const KEY = "chemstudio_experiments";

const SEED: Experiment[] = [
  {
    id: "exp-1",
    smiles: "CC(=O)OC1=CC=CC=C1C(=O)O",
    name: "Acetylsalicylic Acid (Aspirin)",
    assay: "COX-2 Inhibition Assay",
    resultValue: "IC50 = 240 nM",
    outcome: "success",
    notes: "High target potency validated in vitro. Moderate gastrointestinal irritation noted.",
    createdAt: "2026-06-19T10:00:00Z",
  },
];

let experiments: Experiment[] = load();
const listeners = new Set<() => void>();

function load(): Experiment[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return SEED;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(experiments));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function addExperiment(exp: Omit<Experiment, "id" | "createdAt"> & Partial<Pick<Experiment, "id" | "createdAt">>) {
  const full: Experiment = {
    id: exp.id || `exp-${Date.now()}`,
    createdAt: exp.createdAt || new Date().toISOString(),
    ...exp,
  } as Experiment;
  experiments = [full, ...experiments];
  persist();
}

export function removeExperiment(id: string) {
  experiments = experiments.filter((e) => e.id !== id);
  persist();
}

export function useExperiments(): Experiment[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => experiments,
    () => experiments
  );
}
