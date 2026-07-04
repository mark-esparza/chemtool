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
  DesignBrief,
  Candidate,
  Experiment,
  ProductBreakdown,
  HmdbMetabolite,
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

export function simulateReaction(reactants: string[], conditions: string): Promise<ReactionResult> {
  return postJson<ReactionResult>("/api/reaction/simulate", { reactants, conditions });
}

export async function searchCompound(query: string): Promise<PubChemCompound> {
  const res = await fetch(`/api/pubchem/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Compound search failed.");
  return data as PubChemCompound;
}

export function batchLookup(queries: string[]): Promise<{ results: BatchResult[] }> {
  return postJson<{ results: BatchResult[] }>("/api/pubchem/batch", { queries });
}

export async function searchProduct(query: string): Promise<ProductBreakdown> {
  const res = await fetch(`/api/product/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Product search failed.");
  return data as ProductBreakdown;
}

export async function searchMetabolite(query: string): Promise<HmdbMetabolite> {
  const res = await fetch(`/api/hmdb/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Metabolite search failed.");
  return data as HmdbMetabolite;
}

export function evaluateSmiles(smiles: string): Promise<MolecularProperties> {
  return postJson<MolecularProperties>("/api/evaluate", { smiles });
}

export interface DesignResult {
  brief: DesignBrief;
  candidates: Candidate[];
  explanation: string;
  seed_properties: MolecularProperties;
  seed_pubchem: PubChemCompound | null;
}

export function runDesignPipeline(
  prompt: string,
  numSamples: number,
  experiments: Experiment[]
): Promise<DesignResult> {
  return postJson<DesignResult>("/api/design-pipeline", { prompt, numSamples, experiments });
}
