/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Structural neighborhood search against live PubChem.
 *
 * Given a seed compound, PubChem's 2D similarity search returns real, deposited
 * compounds whose Morgan-style fingerprint Tanimoto score meets a threshold. We
 * use this instead of inventing analog structures: every candidate returned here
 * exists in PubChem and carries a CID the reader can look up, so a result is
 * reproducible by re-running the same query against the same database.
 *
 * Reference: Kim S. et al., "PubChem in 2021: new data content and improved web
 * interfaces", Nucleic Acids Res. 49:D1388 (2021); PUG-REST fast search service.
 */

const PROPS = "MolecularFormula,MolecularWeight,IUPACName,SMILES,ConnectivitySMILES,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,Charge";

export interface NeighborCompound {
  cid: number;
  name: string | null;
  formula: string | null;
  smiles: string | null;
  mw: number | null;
  xlogp: number | null;
  tpsa: number | null;
  hbd: number | null;
  hba: number | null;
  rotatableBonds: number | null;
  charge: number | null;
}

export interface NeighborQuery {
  /** How the seed was interpreted. */
  seed: { cid: number | null; smiles: string | null; name: string | null };
  threshold: number;
  maxRecords: number;
  /** Compounds PubChem returned, seed excluded. */
  neighbors: NeighborCompound[];
  /** True when PubChem capped the result set at maxRecords. */
  truncated: boolean;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** POST a form body to PUG-REST (keeps long SMILES/CID lists out of the URL). */
async function pugPost(path: string, form: Record<string, string>): Promise<any | null> {
  const r = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok) throw new Error(`PubChem returned HTTP ${r.status}`);
  return r.json();
}

/**
 * 2D similarity search. `threshold` is a Tanimoto percentage (PubChem's own
 * units, 0-100); `maxRecords` caps how many CIDs come back.
 */
async function similarCids(seed: { cid: number | null; smiles: string | null }, threshold: number, maxRecords: number): Promise<number[]> {
  const form: Record<string, string> = { Threshold: String(threshold), MaxRecords: String(maxRecords) };
  let data: any | null;
  if (seed.cid !== null) {
    data = await pugPost(`compound/fastsimilarity_2d/cid/cids/JSON`, { ...form, cid: String(seed.cid) });
  } else if (seed.smiles) {
    data = await pugPost(`compound/fastsimilarity_2d/smiles/cids/JSON`, { ...form, smiles: seed.smiles });
  } else {
    return [];
  }
  const cids = data?.IdentifierList?.CID;
  return Array.isArray(cids) ? cids.filter((c: unknown): c is number => typeof c === "number") : [];
}

/** Batch-fetch properties for a CID list in one request. */
async function propertiesFor(cids: number[]): Promise<Map<number, any>> {
  const out = new Map<number, any>();
  if (cids.length === 0) return out;
  const data = await pugPost(`compound/cid/property/${PROPS}/JSON`, { cid: cids.join(",") });
  for (const p of data?.PropertyTable?.Properties ?? []) {
    if (typeof p?.CID === "number") out.set(p.CID, p);
  }
  return out;
}

/** Batch-fetch one common synonym per CID. Best-effort: names are cosmetic. */
async function namesFor(cids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (cids.length === 0) return out;
  try {
    const data = await pugPost(`compound/cid/synonyms/JSON`, { cid: cids.join(",") });
    for (const info of data?.InformationList?.Information ?? []) {
      const first = info?.Synonym?.[0];
      if (typeof info?.CID === "number" && typeof first === "string") out.set(info.CID, first);
    }
  } catch {
    /* names are optional */
  }
  return out;
}

/**
 * Find the structural neighborhood of a seed compound.
 *
 * `seed` is a CID, a SMILES string, or a chemical name (resolved by the caller
 * through the PubChem client and passed in already-resolved where possible).
 * Returns null when PubChem is reachable but cannot resolve the seed; throws
 * when PubChem cannot be reached.
 */
export async function fetchNeighborhood(
  seed: { cid: number | null; smiles: string | null; name: string | null },
  opts: { threshold?: number; maxRecords?: number } = {}
): Promise<NeighborQuery | null> {
  const threshold = Math.min(100, Math.max(50, Math.round(opts.threshold ?? 90)));
  const maxRecords = Math.min(100, Math.max(1, Math.round(opts.maxRecords ?? 25)));
  if (seed.cid === null && !seed.smiles) return null;

  try {
    // Ask for one extra: the seed itself is normally its own best match.
    const cids = await similarCids(seed, threshold, maxRecords + 1);
    const truncated = cids.length > maxRecords;
    const hits = cids.filter((c) => c !== seed.cid).slice(0, maxRecords);

    const [props, names] = await Promise.all([propertiesFor(hits), namesFor(hits)]);
    const neighbors: NeighborCompound[] = hits.map((cid) => {
      const p = props.get(cid) ?? {};
      return {
        cid,
        name: names.get(cid) ?? p.IUPACName ?? null,
        formula: p.MolecularFormula ?? null,
        smiles: p.SMILES ?? p.ConnectivitySMILES ?? null,
        mw: num(p.MolecularWeight),
        xlogp: num(p.XLogP),
        tpsa: num(p.TPSA),
        hbd: num(p.HBondDonorCount),
        hba: num(p.HBondAcceptorCount),
        rotatableBonds: num(p.RotatableBondCount),
        charge: num(p.Charge),
      };
    });

    return { seed, threshold, maxRecords, neighbors, truncated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[PubChem] Similarity search failed: ${msg.slice(0, 120)}`);
    throw new Error("PubChem is currently unreachable, so the structural neighborhood could not be retrieved. Check network access to pubchem.ncbi.nlm.nih.gov and try again.");
  }
}
