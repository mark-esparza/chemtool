/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HMDB data by way of PubChem.
 *
 * hmdb.ca answers this server's requests with HTTP 403 — from the deployed
 * host as well as in development — so its pages cannot be read directly.
 * HMDB deposits its annotations in PubChem, though, and PubChem serves them
 * through PUG-View with each item attributed to its source. This module builds
 * a metabolite record from the items PubChem attributes to HMDB and nothing
 * else.
 *
 * The record is narrower than HMDB's own: PubChem does not carry the biofluid
 * list, the normal-concentration table, the enzyme and transporter table or
 * HMDB's chemical taxonomy. Those are reported as unavailable, never guessed.
 */

import type { HmdbMetabolite, HmdbPathway } from "../src/types/index.js";
import { normalizeHmdbAccession, findHmdbAccession } from "./hmdbIds.js";
import { fetchPubChemData } from "./pubchem.js";

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest";
const UA = { "User-Agent": "chemtool (https://github.com/mark-esparza/chemtool)" };

/** What this route cannot supply, shown to the reader beside the record. */
export const UNAVAILABLE_VIA_PUBCHEM = [
  "biofluid locations",
  "normal concentrations",
  "enzymes and transporters",
  "chemical classification",
];

async function getJson(url: string): Promise<any | null> {
  const r = await fetch(url, { headers: UA });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`PubChem returned HTTP ${r.status}`);
  return r.json();
}

/** CID for an HMDB accession, through PubChem's registry cross-reference. */
async function cidForAccession(accession: string): Promise<number | null> {
  const data = await getJson(`${PUG}/pug/compound/xref/RegistryID/${accession}/cids/JSON`);
  const cid = data?.IdentifierList?.CID?.[0];
  return typeof cid === "number" ? cid : null;
}

interface PvSection {
  TOCHeading: string;
  Information?: any[];
  Section?: PvSection[];
}

function findSection(sections: PvSection[] | undefined, heading: string): PvSection | null {
  for (const s of sections ?? []) {
    if (s.TOCHeading === heading) return s;
    const inner = findSection(s.Section, heading);
    if (inner) return inner;
  }
  return null;
}

/**
 * Build a metabolite record for `q` (a name or an HMDB accession) from
 * PubChem's HMDB-attributed annotations. Returns null when PubChem knows the
 * compound but holds no HMDB record for it, or does not know it at all.
 */
export async function fetchMetaboliteViaPubChem(q: string): Promise<HmdbMetabolite | null> {
  const wanted = normalizeHmdbAccession(q);

  const compound = wanted
    ? await (async () => {
        const cid = await cidForAccession(wanted);
        return cid === null ? null : fetchPubChemData(String(cid));
      })()
    : await fetchPubChemData(q);
  if (!compound) return null;

  const view = await getJson(`${PUG}/pug_view/data/compound/${compound.cid}/JSON`);
  const record = view?.Record;
  if (!record) return null;

  // Only items PubChem attributes to HMDB are used.
  const hmdbRefs = new Set<number>();
  const refIds: string[] = [];
  for (const ref of record.Reference ?? []) {
    if (typeof ref?.SourceName === "string" && ref.SourceName.includes("Human Metabolome Database")) {
      hmdbRefs.add(ref.ReferenceNumber);
      if (typeof ref.SourceID === "string") refIds.push(ref.SourceID);
    }
  }
  const accession = wanted ?? findHmdbAccession(refIds) ?? compound.hmdbAccession;
  // An accession is what makes this an HMDB metabolite. PubChem lists one for
  // some compounds (carnitine, for one) without carrying any of HMDB's
  // annotations; those still get a record, just a bare one.
  if (!accession) return null;

  const items = (heading: string): any[] =>
    (findSection(record.Section, heading)?.Information ?? []).filter((i) => hmdbRefs.has(i.ReferenceNumber));
  const strings = (heading: string): string[] =>
    items(heading)
      .flatMap((i) => i?.Value?.StringWithMarkup ?? [])
      .map((v: any) => String(v?.String ?? "").trim())
      .filter(Boolean);

  const pathways: HmdbPathway[] = items("Metabolite Pathways")
    .flatMap((i) => i?.Value?.StringWithMarkup ?? [])
    .map((v: any) => {
      const link = (v?.Markup ?? []).map((m: any) => String(m?.URL ?? "")).find((u: string) => u.includes("smpdb.ca/view/"));
      return {
        name: String(v?.String ?? "").trim(),
        smpdbId: link ? link.split("/view/")[1] || null : null,
        keggMapId: null,
      };
    })
    .filter((p) => p.name)
    .slice(0, 25);

  const diseases = [...new Set(items("Disease and References").map((i) => String(i?.Name ?? "").trim()).filter(Boolean))].slice(0, 20);
  const mw = Number(compound.mw);

  return {
    accession,
    name: compound.name,
    formula: compound.formula ?? null,
    averageMass: Number.isFinite(mw) ? mw : null,
    monoisotopicMass: null,
    iupacName: compound.iupac_name || null,
    smiles: compound.smiles || null,
    inchikey: null,
    casNumber: strings("CAS")[0] ?? null,
    state: strings("Physical Description")[0] ?? null,
    description:
      compound.description && compound.description !== "No description available in PubChem." ? compound.description : null,
    synonyms: compound.synonyms.slice(0, 8),
    classification: null,
    biospecimens: [],
    tissues: strings("Tissue Locations").slice(0, 30),
    cellularLocations: strings("Cellular Locations"),
    pathways,
    diseases,
    proteins: [],
    concentrations: [],
    xrefs: { pubchemCid: compound.cid, keggId: null, chebiId: null, drugbankId: null },
    url: `https://hmdb.ca/metabolites/${accession}`,
    structureImage: `https://hmdb.ca/structures/${accession}/image.png`,
    source: "pubchem",
    unavailable: UNAVAILABLE_VIA_PUBCHEM,
  };
}
