/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Structural neighborhood search against live PubChem.
 *
 * Given a seed compound, PubChem's 2D similarity search returns real, deposited
 * compounds whose fingerprint Tanimoto score meets a threshold. We use this
 * instead of inventing analog structures: every candidate returned here exists
 * in PubChem and carries a CID the reader can look up, so a result is
 * reproducible by re-running the same query against the same database.
 *
 * Reference: Kim S. et al., "PubChem in 2021: new data content and improved web
 * interfaces", Nucleic Acids Res. 49:D1388 (2021); PUG-REST fast search service.
 */

const BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

// Property names current as of PubChem's 2025 rename (CanonicalSMILES ->
// ConnectivitySMILES, IsomericSMILES -> SMILES). A retired name makes PUG-REST
// reject the whole request, so this list is kept identical to the one the
// single-compound client already uses in production.
const PROPS = "MolecularFormula,MolecularWeight,IUPACName,SMILES,ConnectivitySMILES,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount";

const UA = { "User-Agent": "chemtool (https://github.com/mark-esparza/chemtool)" };
const FORM = { ...UA, "Content-Type": "application/x-www-form-urlencoded" };

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

/** PubChem reports problems as a Fault object; pull out something readable. */
function faultMessage(body: string): string | null {
  try {
    const f = JSON.parse(body)?.Fault;
    if (!f) return null;
    const parts = [f.Code, f.Message, ...(Array.isArray(f.Details) ? f.Details : [])];
    const text = parts.filter((p) => typeof p === "string" && p).join(": ");
    return text || null;
  } catch {
    return null;
  }
}

/**
 * One PUG-REST call.
 *
 * Returns null ONLY for 404, which is how PubChem reports an empty result set.
 * Every other failure throws, carrying PubChem's own fault text. This
 * distinction is the whole point: an earlier version folded 400 in with 404, so
 * a malformed request produced an empty neighborhood and the interface told the
 * user to lower the similarity threshold — advice that could never help,
 * because the search had been rejected rather than run.
 */
async function pug(url: string, init?: RequestInit): Promise<any | null> {
  const r = await fetch(url, { ...init, headers: { ...UA, ...(init?.headers ?? {}) } });
  const body = await r.text();

  if (r.status === 404) return null;
  if (!r.ok) throw new Error(faultMessage(body) ?? `PubChem returned HTTP ${r.status}`);

  let data: any = null;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    throw new Error("PubChem returned a response that was not JSON.");
  }
  // The "fast" searches are synchronous. A ListKey means PubChem queued the job
  // instead, which would otherwise read as a result set with nothing in it.
  if (data?.Waiting?.ListKey) {
    throw new Error("PubChem queued this search rather than answering directly. Try again in a moment.");
  }
  return data;
}

/**
 * 2D similarity search. `threshold` is a Tanimoto percentage in PubChem's own
 * units (0-100); `maxRecords` caps how many CIDs come back.
 *
 * The CID form is a plain GET with the identifier in the path and the options
 * in the query string, which is PUG-REST's documented shape for this call.
 * Only a SMILES seed needs POST, because a SMILES string can contain
 * characters that do not survive being put in a URL path.
 */
async function similarCids(
  seed: { cid: number | null; smiles: string | null },
  threshold: number,
  maxRecords: number
): Promise<number[]> {
  const opts = new URLSearchParams({ Threshold: String(threshold), MaxRecords: String(maxRecords) });

  let data: any | null;
  if (seed.cid !== null) {
    data = await pug(`${BASE}/compound/fastsimilarity_2d/cid/${seed.cid}/cids/JSON?${opts}`);
  } else if (seed.smiles) {
    data = await pug(`${BASE}/compound/fastsimilarity_2d/smiles/cids/JSON?${opts}`, {
      method: "POST",
      headers: FORM,
      body: new URLSearchParams({ smiles: seed.smiles }).toString(),
    });
  } else {
    return [];
  }

  const cids = data?.IdentifierList?.CID;
  return Array.isArray(cids) ? cids.filter((c: unknown): c is number => typeof c === "number") : [];
}

/**
 * Batch-fetch properties for a CID list in one request. The identifier list
 * goes in a POST body so a long list cannot overflow the URL.
 */
async function propertiesFor(cids: number[]): Promise<Map<number, any>> {
  const out = new Map<number, any>();
  if (cids.length === 0) return out;
  const data = await pug(`${BASE}/compound/cid/property/${PROPS}/JSON`, {
    method: "POST",
    headers: FORM,
    body: new URLSearchParams({ cid: cids.join(",") }).toString(),
  });
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
    const data = await pug(`${BASE}/compound/cid/synonyms/JSON`, {
      method: "POST",
      headers: FORM,
      body: new URLSearchParams({ cid: cids.join(",") }).toString(),
    });
    for (const info of data?.InformationList?.Information ?? []) {
      const first = info?.Synonym?.[0];
      if (typeof info?.CID === "number" && typeof first === "string") out.set(info.CID, first);
    }
  } catch {
    /* a missing name costs nothing; the CID and its descriptors still stand */
  }
  return out;
}

/**
 * Find the structural neighborhood of a seed compound.
 *
 * Returns null when the seed carries nothing searchable. Throws when PubChem
 * cannot be reached or rejects the query — callers must not present either as
 * an empty neighborhood.
 */
export async function fetchNeighborhood(
  seed: { cid: number | null; smiles: string | null; name: string | null },
  opts: { threshold?: number; maxRecords?: number } = {}
): Promise<NeighborQuery | null> {
  const threshold = Math.min(100, Math.max(50, Math.round(opts.threshold ?? 90)));
  const maxRecords = Math.min(100, Math.max(1, Math.round(opts.maxRecords ?? 25)));
  if (seed.cid === null && !seed.smiles) return null;

  try {
    // Ask for one extra: the seed is normally its own best match.
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
      };
    });

    return { seed, threshold, maxRecords, neighbors, truncated };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.log(`[PubChem] Similarity search failed: ${detail.slice(0, 200)}`);
    throw new Error(`The structural neighborhood could not be retrieved from PubChem: ${detail}`);
  }
}
