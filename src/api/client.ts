/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed client wrappers around the server API. Every call returns parsed data or
 * throws an Error with the server's message.
 */

import type {
  ReactionResult,
  PubChemCompound,
  BatchResult,
  MolecularProperties,
  HmdbMetabolite,
  HmdbBatchResult,
  AnalogFilters,
  AnalogResult,
} from "../types";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error || "Request failed") as Error & { status?: number; body?: any };
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data as T;
}

async function getJson<T>(url: string, fallbackError: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || fallbackError);
  return data as T;
}

export function simulateReaction(reactants: string[], conditions: string): Promise<ReactionResult> {
  return postJson<ReactionResult>("/api/reaction/simulate", { reactants, conditions });
}

export function searchCompound(query: string): Promise<PubChemCompound> {
  return getJson<PubChemCompound>(`/api/pubchem/search?q=${encodeURIComponent(query)}`, "Compound search failed.");
}

export function batchLookup(queries: string[]): Promise<{ results: BatchResult[] }> {
  return postJson<{ results: BatchResult[] }>("/api/pubchem/batch", { queries });
}

export function searchMetabolite(query: string): Promise<HmdbMetabolite> {
  return getJson<HmdbMetabolite>(`/api/hmdb/search?q=${encodeURIComponent(query)}`, "Metabolite search failed.");
}

export function batchMetabolites(queries: string[]): Promise<{ results: HmdbBatchResult[] }> {
  return postJson<{ results: HmdbBatchResult[] }>("/api/hmdb/batch", { queries });
}

export function evaluateSmiles(smiles: string): Promise<MolecularProperties> {
  return postJson<MolecularProperties>("/api/evaluate", { smiles });
}

/** Structural neighbors of a seed compound, retrieved live from PubChem. */
export function searchAnalogs(
  seed: string,
  threshold: number,
  maxRecords: number,
  filters: AnalogFilters
): Promise<AnalogResult> {
  return postJson<AnalogResult>("/api/analogs", { seed, threshold, maxRecords, filters });
}
