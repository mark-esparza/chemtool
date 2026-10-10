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
  hmdb?: string; // HMDB accession when it's a known human metabolite
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

/** True when two bank entries are the same chemical (same CID, HMDB ID, or name). */
function sameChemical(a: BankChemical, b: BankChemical): boolean {
  if (a.cid && b.cid) return a.cid === b.cid;
  if (a.hmdb && b.hmdb) return a.hmdb === b.hmdb;
  return a.name.toLowerCase() === b.name.toLowerCase();
}

/**
 * Add a chemical, de-duplicated by CID, HMDB accession, or name. If it's already
 * banked, any identifiers the existing entry lacks (CID, SMILES, HMDB ID, mass)
 * are merged in so cross-links light up. Returns true if newly added.
 */
export function addToBank(chem: BankChemical): boolean {
  const idx = bank.findIndex((c) => sameChemical(c, chem));
  if (idx >= 0) {
    const cur = bank[idx];
    const merged: BankChemical = {
      ...cur,
      cid: cur.cid ?? chem.cid,
      smiles: cur.smiles ?? chem.smiles,
      hmdb: cur.hmdb ?? chem.hmdb,
      mw: cur.mw ?? chem.mw,
    };
    if (merged.cid !== cur.cid || merged.smiles !== cur.smiles || merged.hmdb !== cur.hmdb || merged.mw !== cur.mw) {
      bank = bank.map((c, i) => (i === idx ? merged : c));
      persist();
    }
    return false;
  }
  bank = [...bank, chem];
  persist();
  return true;
}

/** Record that a banked chemical is (or is not) a known human metabolite. */
export function setBankHmdb(id: string, hmdb: string | undefined) {
  if (!bank.some((c) => c.id === id && c.hmdb !== hmdb)) return;
  bank = bank.map((c) => (c.id === id ? { ...c, hmdb } : c));
  persist();
}

export function removeFromBank(id: string) {
  bank = bank.filter((c) => c.id !== id);
  persist();
}

export function clearBank() {
  bank = [];
  persist();
}

/** Current bank contents, for non-React callers. */
export function getBank(): BankChemical[] {
  return bank;
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
