/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Chemical Bank — a localStorage-backed collection of resolved chemicals
 * (from product breakdowns, searches, etc.) shared across features via
 * useSyncExternalStore. From the bank, chemicals can be analyzed or sent into
 * the Reaction Simulator.
 */

import { useSyncExternalStore } from "react";

export interface BankChemical {
  id: string; // cid as string, or normalized name
  name: string;
  formula: string;
  smiles?: string;
  cid?: number;
  mw?: number | string;
  source?: string; // e.g. the product it came from
}

const KEY = "chemstudio_bank";

let bank: BankChemical[] = load();
const listeners = new Set<() => void>();

function load(): BankChemical[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(bank));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Add a chemical, de-duplicated by CID (or name). Returns true if newly added. */
export function addToBank(chem: BankChemical): boolean {
  const key = chem.cid ? `cid:${chem.cid}` : `name:${chem.name.toLowerCase()}`;
  const exists = bank.some((c) => (c.cid ? `cid:${c.cid}` : `name:${c.name.toLowerCase()}`) === key);
  if (exists) return false;
  bank = [...bank, chem];
  persist();
  return true;
}

export function removeFromBank(id: string) {
  bank = bank.filter((c) => c.id !== id);
  persist();
}

export function clearBank() {
  bank = [];
  persist();
}

export function useBank(): BankChemical[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => bank,
    () => bank
  );
}
