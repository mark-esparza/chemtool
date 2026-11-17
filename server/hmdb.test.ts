/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HMDB client tests. The network is stubbed: HMDB and PubChem responses come
 * from fixtures, so these run offline and deterministically.
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchMetabolite, __test } from "./hmdb.ts";
import { normalizeHmdbAccession, findHmdbAccession } from "./hmdbIds.ts";

const XML = readFileSync(new URL("./fixtures/hmdb-glucose.xml", import.meta.url), "utf8");
const realFetch = globalThis.fetch;

type Handler = (url: string) => Response | Promise<Response>;
let calls: string[] = [];

function stubFetch(handler: Handler) {
  calls = [];
  globalThis.fetch = (async (input: any) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    return handler(url);
  }) as typeof fetch;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const text = (body: string, status = 200) => new Response(body, { status });

beforeEach(() => __test.clearCache());
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("normalizes 5- and 7-digit HMDB accessions", () => {
  assert.equal(normalizeHmdbAccession("HMDB0000122"), "HMDB0000122");
  assert.equal(normalizeHmdbAccession("hmdb00122"), "HMDB0000122");
  assert.equal(normalizeHmdbAccession(" HMDB0000122 "), "HMDB0000122");
  assert.equal(normalizeHmdbAccession("glucose"), null);
  assert.equal(normalizeHmdbAccession("HMDB12345678"), null);
  assert.equal(findHmdbAccession(["D-glucose", "50-99-7", "HMDB00122", "CHEBI:4167"]), "HMDB0000122");
  assert.equal(findHmdbAccession(["aspirin", "50-78-2"]), null);
});

test("parses the metabolite XML into the surfaced fields", () => {
  const m = __test.parseMetaboliteXml(XML, "HMDB0000122");
  assert.equal(m.name, "D-Glucose");
  assert.equal(m.formula, "C6H12O6");
  assert.equal(m.averageMass, 180.1559);
  assert.equal(m.monoisotopicMass, 180.063388116);
  assert.equal(m.casNumber, "50-99-7");
  assert.equal(m.smiles, "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O");
  assert.match(m.description!, /monosaccharide & the body's primary energy source/);
  assert.deepEqual(m.synonyms, ["Dextrose", "Grape sugar"]);
  assert.deepEqual(m.classification, {
    directParent: "Hexoses",
    superClass: "Organic oxygen compounds",
    class: "Organooxygen compounds",
    subClass: "Carbohydrates and carbohydrate conjugates",
  });
  assert.deepEqual(m.biospecimens, ["Blood", "Urine", "Cerebrospinal Fluid (CSF)"]);
  assert.deepEqual(m.tissues, ["Liver", "Muscle"]);
  assert.deepEqual(m.cellularLocations, ["Cytoplasm", "Extracellular"]);
  assert.deepEqual(m.pathways, [
    { name: "Glycolysis", smpdbId: "SMP0000040", keggMapId: "map00010" },
    { name: "Gluconeogenesis", smpdbId: "SMP0000128", keggMapId: null },
  ]);
  assert.deepEqual(m.diseases, ["Diabetes mellitus type 2", "Glycogen storage disease"]);
  // Only normal concentrations with a value; the abnormal block is ignored.
  assert.deepEqual(m.concentrations, [{ biospecimen: "Blood", value: "5000.0 +/- 1000.0", units: "uM", condition: "Normal" }]);
  assert.deepEqual(m.proteins, [
    { name: "Hexokinase-1", gene: "HK1", type: "Enzyme", uniprotId: "P19367" },
    { name: "Solute carrier family 2, facilitated glucose transporter member 1", gene: "SLC2A1", type: "Transporter", uniprotId: "P11166" },
  ]);
  assert.deepEqual(m.xrefs, { pubchemCid: 5793, keggId: "C00031", chebiId: "4167", drugbankId: "DB09341" });
  assert.equal(m.url, "https://hmdb.ca/metabolites/HMDB0000122");
});

test("tolerates a sparse record", () => {
  const m = __test.parseMetaboliteXml("<metabolite><name>Mystery</name></metabolite>", "HMDB0099999");
  assert.equal(m.name, "Mystery");
  assert.equal(m.formula, null);
  assert.equal(m.classification, null);
  assert.deepEqual(m.pathways, []);
  assert.deepEqual(m.proteins, []);
  assert.deepEqual(m.xrefs, { pubchemCid: null, keggId: null, chebiId: null, drugbankId: null });
});

test("resolves a name through HMDB search, then caches it", async () => {
  stubFetch((url) => {
    if (url.includes("/unearth/")) return text(`<a href="/metabolites/HMDB0000122">D-Glucose</a>`);
    if (url.endsWith("/metabolites/HMDB0000122.xml")) return text(XML);
    return text("unexpected", 500);
  });
  const m = await fetchMetabolite("Glucose");
  assert.equal(m?.accession, "HMDB0000122");
  assert.equal(calls.length, 2);

  // Same query and the bare accession are both served from cache.
  await fetchMetabolite("glucose");
  await fetchMetabolite("HMDB00122");
  assert.equal(calls.length, 2);
});

test("falls back to PubChem's HMDB cross-reference when HMDB search finds nothing", async () => {
  stubFetch((url) => {
    if (url.includes("/unearth/")) return text("<html>No results</html>");
    if (url.includes("/compound/name/glucoze/cids/")) return text("", 404);
    if (url.includes("/autocomplete/compound/glucoze")) return json({ dictionary_terms: { compound: ["glucose"] } });
    if (url.includes("/compound/name/glucose/cids/")) return json({ IdentifierList: { CID: [5793] } });
    // Shaped like the live service: the accession is a RegistryID cross-reference
    // and does not appear among the synonyms.
    if (url.includes("/compound/cid/5793/synonyms/")) return json({ InformationList: { Information: [{ Synonym: ["D-glucose", "Dextrose"] }] } });
    if (url.includes("/compound/cid/5793/xrefs/RegistryID/")) return json({ InformationList: { Information: [{ RegistryID: ["50-99-7", "CHEBI:4167", "HMDB0000122"] }] } });
    if (url.includes("/compound/cid/5793/")) return json({});
    if (url.endsWith("/metabolites/HMDB0000122.xml")) return text(XML);
    return text("unexpected", 500);
  });
  const m = await fetchMetabolite("glucoze");
  assert.equal(m?.name, "D-Glucose");
});

test("returns null when neither HMDB nor PubChem know the chemical", async () => {
  stubFetch((url) => {
    if (url.includes("/unearth/")) return text("<html>No results</html>");
    if (url.includes("pubchem")) return url.includes("autocomplete") ? json({}) : text("", 404);
    return text("unexpected", 500);
  });
  assert.equal(await fetchMetabolite("sodium chloride"), null);
});

test("a bot-check HTML page is never parsed as data, and with PubChem down too the lookup fails", async () => {
  stubFetch((url) => {
    if (url.endsWith(".xml")) return text("<!DOCTYPE html><html><title>Just a moment...</title></html>");
    return text("unexpected", 500);
  });
  await assert.rejects(fetchMetabolite("HMDB0000122"), /Neither the Human Metabolome Database nor PubChem/);
});

test("reports a failure only when both HMDB and PubChem are unreachable", async () => {
  stubFetch(() => {
    throw new TypeError("fetch failed");
  });
  await assert.rejects(fetchMetabolite("dopamine"), /Neither the Human Metabolome Database nor PubChem/);
});

// --- HMDB refuses the request: build the record from PubChem's copy ----------

/** PUG-View shaped like the live service, with one non-HMDB item mixed in. */
const PUG_VIEW = {
  Record: {
    Reference: [
      { ReferenceNumber: 44, SourceName: "Human Metabolome Database (HMDB)", SourceID: "HMDB0000073" },
      { ReferenceNumber: 9, SourceName: "Some Other Source", SourceID: "X1" },
    ],
    Section: [
      {
        TOCHeading: "Pharmacology and Biochemistry",
        Section: [
          {
            TOCHeading: "Human Metabolite Information",
            Section: [
              { TOCHeading: "Tissue Locations", Information: [{ ReferenceNumber: 44, Value: { StringWithMarkup: [{ String: "Adrenal Medulla" }, { String: "Brain" }] } }] },
              {
                TOCHeading: "Cellular Locations",
                Information: [
                  { ReferenceNumber: 44, Value: { StringWithMarkup: [{ String: "Cytoplasm" }] } },
                  { ReferenceNumber: 9, Value: { StringWithMarkup: [{ String: "Not From HMDB" }] } },
                ],
              },
              {
                TOCHeading: "Metabolite Pathways",
                Information: [{ ReferenceNumber: 44, Value: { StringWithMarkup: [
                  { String: "Tyrosine Metabolism", Markup: [{ URL: "http://smpdb.ca/view/SMP00006" }] },
                  { String: "Alkaptonuria" },
                ] } }],
              },
            ],
          },
        ],
      },
      {
        TOCHeading: "Associated Disorders and Diseases",
        Section: [{ TOCHeading: "Disease and References", Information: [
          { ReferenceNumber: 44, Name: "Parkinson's disease", Value: { StringWithMarkup: [{ String: "PubMed: 1" }] } },
          { ReferenceNumber: 44, Name: "Parkinson's disease", Value: { StringWithMarkup: [{ String: "PubMed: 2" }] } },
        ] }],
      },
    ],
  },
};

function hmdbRefusing(url: string): Response | null {
  if (url.includes("hmdb.ca")) return text("Forbidden", 403);
  if (url.includes("/compound/name/dopamine/cids/")) return json({ IdentifierList: { CID: [681] } });
  if (url.includes("/xref/RegistryID/HMDB0000073/cids/")) return json({ IdentifierList: { CID: [681] } });
  if (url.includes("/compound/cid/681/property/")) return json({ PropertyTable: { Properties: [{ MolecularFormula: "C8H11NO2", MolecularWeight: "153.18", SMILES: "NCCc1ccc(O)c(O)c1" }] } });
  if (url.includes("/compound/cid/681/synonyms/")) return json({ InformationList: { Information: [{ Synonym: ["Dopamine"] }] } });
  if (url.includes("/compound/cid/681/xrefs/RegistryID/")) return json({ InformationList: { Information: [{ RegistryID: ["HMDB0000073"] }] } });
  if (url.includes("/pug_view/data/compound/681/")) return json(PUG_VIEW);
  if (url.includes("/compound/cid/681/")) return json({});
  return null;
}

test("when HMDB refuses the request, the record is built from PubChem's HMDB annotations", async () => {
  stubFetch((url) => hmdbRefusing(url) ?? text("", 404));
  const m = await fetchMetabolite("dopamine");
  assert.equal(m?.accession, "HMDB0000073");
  assert.equal(m?.source, "pubchem");
  assert.equal(m?.formula, "C8H11NO2");
  assert.deepEqual(m?.tissues, ["Adrenal Medulla", "Brain"]);
  // Only items PubChem attributes to HMDB are taken.
  assert.deepEqual(m?.cellularLocations, ["Cytoplasm"]);
  assert.deepEqual(m?.pathways, [
    { name: "Tyrosine Metabolism", smpdbId: "SMP00006", keggMapId: null },
    { name: "Alkaptonuria", smpdbId: null, keggMapId: null },
  ]);
  assert.deepEqual(m?.diseases, ["Parkinson's disease"]); // de-duplicated
  // What this route cannot supply is declared, not left looking like an empty record.
  assert.deepEqual(m?.concentrations, []);
  assert.ok(m?.unavailable.includes("normal concentrations"));
  assert.ok(m?.unavailable.includes("enzymes and transporters"));
});

test("an accession resolves through PubChem too, and a refusal is not retried on every lookup", async () => {
  stubFetch((url) => hmdbRefusing(url) ?? text("", 404));
  assert.equal((await fetchMetabolite("HMDB0000073"))?.source, "pubchem");
  const hmdbCalls = calls.filter((u) => u.includes("hmdb.ca")).length;
  __test.clearCacheKeepingRefusal();
  await fetchMetabolite("dopamine");
  assert.equal(calls.filter((u) => u.includes("hmdb.ca")).length, hmdbCalls, "hmdb.ca was asked again after refusing");
});

test("a compound PubChem holds no HMDB record for is not a metabolite", async () => {
  stubFetch((url) => {
    if (url.includes("/pug_view/")) return json({ Record: { Reference: [{ ReferenceNumber: 9, SourceName: "Some Other Source" }], Section: [] } });
    if (url.includes("/xrefs/RegistryID/")) return json({ InformationList: { Information: [{ RegistryID: [] }] } });
    return hmdbRefusing(url) ?? text("", 404);
  });
  assert.equal(await fetchMetabolite("dopamine"), null);
});
