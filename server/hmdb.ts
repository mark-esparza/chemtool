/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live client for the Human Metabolome Database (HMDB, https://hmdb.ca).
 *
 * HMDB has no official JSON API, but each metabolite exposes a structured XML
 * document at /metabolites/{accession}.xml, and the /unearth search returns
 * pages containing the HMDB accession. We resolve a name to an accession via
 * search, then fetch and parse the metabolite XML for the fields students care
 * about — physiology (where it's found in the body), normal concentrations,
 * associated diseases, and metabolic pathways.
 */

export interface HmdbConcentration {
  biospecimen: string;
  value: string;
  units: string;
  condition?: string;
}

export interface HmdbMetabolite {
  accession: string;
  name: string;
  formula: string | null;
  averageMass: number | null;
  iupacName: string | null;
  smiles: string | null;
  inchikey: string | null;
  state: string | null;
  description: string | null;
  biospecimens: string[];
  tissues: string[];
  pathways: string[];
  diseases: string[];
  concentrations: HmdbConcentration[];
  url: string;
  structureImage: string;
}

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

/** First occurrence of <tag>…</tag> content. */
function firstTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : null;
}

/** All <inner>…</inner> values inside the first <wrapper>…</wrapper> block. */
function listInside(xml: string, wrapper: string, inner: string, cap = 20): string[] {
  const block = xml.match(new RegExp(`<${wrapper}>([\\s\\S]*?)</${wrapper}>`));
  if (!block) return [];
  const out: string[] = [];
  const re = new RegExp(`<${inner}>([\\s\\S]*?)</${inner}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1])) && out.length < cap) {
    const v = decode(m[1]);
    if (v) out.push(v);
  }
  return out;
}

/** Parse a metabolite XML document into the fields we surface. */
function parseMetaboliteXml(xml: string, accession: string): HmdbMetabolite {
  const avg = firstTag(xml, "average_molecular_weight");

  // Pathway names live under <biological_properties><pathways><pathway><name>.
  const pathwaysBlock = xml.match(/<pathways>([\s\S]*?)<\/pathways>/);
  const pathways: string[] = [];
  if (pathwaysBlock) {
    const re = /<name>([\s\S]*?)<\/name>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pathwaysBlock[1])) && pathways.length < 15) {
      const v = decode(m[1]);
      if (v) pathways.push(v);
    }
  }

  // Disease names: each <disease> starts with its <name>.
  const diseasesBlock = xml.match(/<diseases>([\s\S]*?)<\/diseases>/);
  const diseases: string[] = [];
  if (diseasesBlock) {
    const re = /<disease>\s*<name>([\s\S]*?)<\/name>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(diseasesBlock[1])) && diseases.length < 20) {
      const v = decode(m[1]);
      if (v) diseases.push(v);
    }
  }

  // Normal concentrations.
  const concentrations: HmdbConcentration[] = [];
  const concBlock = xml.match(/<normal_concentrations>([\s\S]*?)<\/normal_concentrations>/);
  if (concBlock) {
    const re = /<concentration>([\s\S]*?)<\/concentration>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(concBlock[1])) && concentrations.length < 8) {
      const c = m[1];
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
    }
  }

  const desc = firstTag(xml, "description");

  return {
    accession,
    name: firstTag(xml, "name") || accession,
    formula: firstTag(xml, "chemical_formula"),
    averageMass: avg ? parseFloat(avg) : null,
    iupacName: firstTag(xml, "iupac_name"),
    smiles: firstTag(xml, "smiles"),
    inchikey: firstTag(xml, "inchikey"),
    state: firstTag(xml, "state"),
    description: desc ? (desc.length > 700 ? desc.slice(0, 700).trim() + "…" : desc) : null,
    biospecimens: listInside(xml, "biospecimen_locations", "biospecimen"),
    tissues: listInside(xml, "tissue_locations", "tissue"),
    pathways,
    diseases,
    concentrations,
    url: `https://hmdb.ca/metabolites/${accession}`,
    structureImage: `https://hmdb.ca/structures/${accession}/image.png`,
  };
}

/** Resolve a free-text query to an HMDB accession via the unearth search. */
async function resolveAccession(q: string): Promise<string | null> {
  const url = `https://hmdb.ca/unearth/q?utf8=%E2%9C%93&query=${encodeURIComponent(q)}&searcher=metabolites&button=`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`HMDB search HTTP ${r.status}`);
  const html = await r.text();
  const m = html.match(/HMDB\d{7}/);
  return m ? m[0] : null;
}

/**
 * Look up a metabolite by name (or HMDB accession) against the live HMDB.
 * Returns null when HMDB has no such metabolite; throws when HMDB is unreachable.
 */
export async function fetchMetabolite(q: string): Promise<HmdbMetabolite | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;

  try {
    let accession = /^HMDB\d{7}$/i.test(trimmed) ? trimmed.toUpperCase() : null;
    if (!accession) accession = await resolveAccession(trimmed);
    if (!accession) return null;

    const r = await fetch(`https://hmdb.ca/metabolites/${accession}.xml`, { headers: UA });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HMDB metabolite HTTP ${r.status}`);
    const xml = await r.text();
    return parseMetaboliteXml(xml, accession);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[HMDB] Lookup failed for "${trimmed}": ${msg.slice(0, 120)}`);
    throw new Error(`The Human Metabolome Database is currently unreachable, so "${trimmed}" could not be looked up. Check network access to hmdb.ca and try again.`);
  }
}

// Exported for unit testing the parser.
export const __test = { parseMetaboliteXml };
