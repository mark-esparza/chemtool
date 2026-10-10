/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live client for the Human Metabolome Database (HMDB, https://hmdb.ca).
 *
 * HMDB has no official JSON API, but each metabolite exposes a structured XML
 * document at /metabolites/{accession}.xml, and the /unearth search returns
 * pages containing the HMDB accession. We resolve a name to an accession via
 * search (falling back to PubChem's cross-reference, which also fixes typos),
 * then fetch and parse the metabolite XML for the fields students care about —
 * physiology (where it's found in the body), normal concentrations, associated
 * diseases, metabolic pathways, the enzymes that act on it, and cross-references
 * that link it back into the rest of the app (PubChem CID, KEGG, ChEBI).
 */

import type { HmdbMetabolite, HmdbConcentration, HmdbPathway, HmdbProtein } from "../src/types/index.js";
import { normalizeHmdbAccession } from "./hmdbIds.js";
import { fetchPubChemData } from "./pubchem.js";

export type { HmdbMetabolite };

const UA = { "User-Agent": "ChemStudio/1.0 (educational chemistry tool)" };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** First occurrence of <tag>…</tag> content, or null when absent or empty. */
function firstTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) return null;
  const v = decode(m[1]);
  return v || null;
}

/** Inner content of the first <wrapper>…</wrapper> block, or null. */
function block(xml: string, wrapper: string): string | null {
  const m = xml.match(new RegExp(`<${wrapper}>([\\s\\S]*?)</${wrapper}>`));
  return m ? m[1] : null;
}

/** Raw inner content of every <tag>…</tag> inside a block, up to cap. */
function eachTag(xml: string, tag: string, cap: number): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && out.length < cap) out.push(m[1]);
  return out;
}

/** All decoded <inner>…</inner> values inside the first <wrapper>…</wrapper> block. */
function listInside(xml: string, wrapper: string, inner: string, cap = 20): string[] {
  const b = block(xml, wrapper);
  if (!b) return [];
  return eachTag(b, inner, cap * 2).map(decode).filter(Boolean).slice(0, cap);
}

/** Parse a metabolite XML document into the fields we surface. */
function parseMetaboliteXml(xml: string, accession: string): HmdbMetabolite {
  const num = (tag: string) => {
    const v = firstTag(xml, tag);
    const n = v ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  // Pathways live under <biological_properties><pathways><pathway>, each with a
  // name and (optionally) its SMPDB and KEGG map IDs for deep links.
  const pathwaysBlock = block(xml, "pathways");
  const pathways: HmdbPathway[] = pathwaysBlock
    ? eachTag(pathwaysBlock, "pathway", 15)
        .map((p) => ({ name: firstTag(p, "name") || "", smpdbId: firstTag(p, "smpdb_id"), keggMapId: firstTag(p, "kegg_map_id") }))
        .filter((p) => p.name)
    : [];

  // Disease names: each <disease> starts with its <name>.
  const diseasesBlock = block(xml, "diseases");
  const diseases: string[] = [];
  if (diseasesBlock) {
    const re = /<disease>\s*<name>([\s\S]*?)<\/name>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(diseasesBlock)) && diseases.length < 20) {
      const v = decode(m[1]);
      if (v) diseases.push(v);
    }
  }

  // Normal concentrations.
  const concentrations: HmdbConcentration[] = [];
  const concBlock = block(xml, "normal_concentrations");
  if (concBlock) {
    for (const c of eachTag(concBlock, "concentration", 40)) {
      const value = firstTag(c, "concentration_value");
      const biospecimen = firstTag(c, "biospecimen");
      if (value && biospecimen) {
        concentrations.push({
          biospecimen,
          value,
          units: firstTag(c, "concentration_units") || "",
          condition: firstTag(c, "subject_condition") || undefined,
        });
      }
      if (concentrations.length >= 8) break;
    }
  }

  // Enzymes, transporters, and other proteins that act on this metabolite —
  // the candidate control points for a pathway model.
  const proteinsBlock = block(xml, "protein_associations");
  const proteins: HmdbProtein[] = proteinsBlock
    ? eachTag(proteinsBlock, "protein", 25)
        .map((p) => ({
          name: firstTag(p, "name") || "",
          gene: firstTag(p, "gene_name"),
          type: firstTag(p, "protein_type"),
          uniprotId: firstTag(p, "uniprot_id"),
        }))
        .filter((p) => p.name)
    : [];

  const taxonomy = block(xml, "taxonomy");
  const classification = taxonomy
    ? {
        directParent: firstTag(taxonomy, "direct_parent"),
        superClass: firstTag(taxonomy, "super_class"),
        class: firstTag(taxonomy, "class"),
        subClass: firstTag(taxonomy, "sub_class"),
      }
    : null;

  const desc = firstTag(xml, "description");
  const cid = num("pubchem_compound_id");

  return {
    accession,
    name: firstTag(xml, "name") || accession,
    formula: firstTag(xml, "chemical_formula"),
    averageMass: num("average_molecular_weight"),
    monoisotopicMass: num("monisotopic_molecular_weight"),
    iupacName: firstTag(xml, "iupac_name"),
    smiles: firstTag(xml, "smiles"),
    inchikey: firstTag(xml, "inchikey"),
    casNumber: firstTag(xml, "cas_registry_number"),
    state: firstTag(xml, "state"),
    description: desc ? (desc.length > 700 ? desc.slice(0, 700).trim() + "…" : desc) : null,
    synonyms: listInside(xml, "synonyms", "synonym", 8),
    classification: classification && Object.values(classification).some(Boolean) ? classification : null,
    biospecimens: listInside(xml, "biospecimen_locations", "biospecimen"),
    tissues: listInside(xml, "tissue_locations", "tissue"),
    cellularLocations: listInside(xml, "cellular_locations", "cellular"),
    pathways,
    diseases,
    proteins,
    concentrations,
    xrefs: {
      pubchemCid: cid !== null && Number.isInteger(cid) ? cid : null,
      keggId: firstTag(xml, "kegg_id"),
      chebiId: firstTag(xml, "chebi_id"),
      drugbankId: firstTag(xml, "drugbank_id"),
    },
    url: `https://hmdb.ca/metabolites/${accession}`,
    structureImage: `https://hmdb.ca/structures/${accession}/image.png`,
  };
}

// ---------------------------------------------------------------------------
// Cache. HMDB is slow and rate-sensitive, and the same metabolite is looked up
// from several features (explorer, bank profile, compound cross-links).
// ---------------------------------------------------------------------------
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;
const byAccession = new Map<string, { at: number; value: HmdbMetabolite }>();
const queryToAccession = new Map<string, { at: number; accession: string }>();

function fresh<T extends { at: number }>(map: Map<string, T>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    map.delete(key);
    return null;
  }
  return hit;
}

function remember<T>(map: Map<string, T>, key: string, value: T) {
  if (map.size >= MAX_ENTRIES) map.delete(map.keys().next().value as string);
  map.set(key, value);
}

/** Resolve a free-text query to an HMDB accession via the unearth search. */
async function resolveViaHmdbSearch(q: string): Promise<string | null> {
  const url = `https://hmdb.ca/unearth/q?utf8=%E2%9C%93&query=${encodeURIComponent(q)}&searcher=metabolites&button=`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`HMDB search HTTP ${r.status}`);
  const html = await r.text();
  const m = html.match(/HMDB\d{5,7}/);
  return m ? normalizeHmdbAccession(m[0]) : null;
}

/** Resolve via PubChem's synonym cross-reference (also corrects misspellings). */
async function resolveViaPubChem(q: string): Promise<string | null> {
  try {
    const pc = await fetchPubChemData(q);
    return pc?.hmdbAccession ?? null;
  } catch {
    return null;
  }
}

async function fetchXml(accession: string): Promise<HmdbMetabolite | null> {
  const r = await fetch(`https://hmdb.ca/metabolites/${accession}.xml`, { headers: UA });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HMDB metabolite HTTP ${r.status}`);
  const xml = await r.text();
  // A bot-check or maintenance page arrives as 200 HTML — that's an outage, not data.
  if (!/<metabolite[\s>]/.test(xml)) throw new Error("HMDB returned a non-XML page");
  return parseMetaboliteXml(xml, accession);
}

/**
 * Look up a metabolite by name (or HMDB accession, 5- or 7-digit) against the live
 * HMDB. Returns null when HMDB has no such metabolite; throws when HMDB is unreachable.
 */
export async function fetchMetabolite(q: string): Promise<HmdbMetabolite | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();

  let accession = normalizeHmdbAccession(trimmed) ?? fresh(queryToAccession, key)?.accession ?? null;
  if (accession) {
    const cached = fresh(byAccession, accession);
    if (cached) return cached.value;
  }

  try {
    if (!accession) {
      let searchError: unknown = null;
      try {
        accession = await resolveViaHmdbSearch(trimmed);
      } catch (err) {
        searchError = err;
      }
      if (!accession) accession = await resolveViaPubChem(trimmed);
      if (!accession) {
        if (searchError) throw searchError;
        return null;
      }
    }

    const data = await fetchXml(accession);
    if (!data) return null;
    remember(byAccession, accession, { at: Date.now(), value: data });
    remember(queryToAccession, key, { at: Date.now(), accession });
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[HMDB] Lookup failed for "${trimmed}": ${msg.slice(0, 120)}`);
    throw new Error(`The Human Metabolome Database is currently unreachable, so "${trimmed}" could not be looked up. Check network access to hmdb.ca and try again.`);
  }
}

// Exported for unit testing.
export const __test = {
  parseMetaboliteXml,
  clearCache: () => {
    byAccession.clear();
    queryToAccession.clear();
  },
};
