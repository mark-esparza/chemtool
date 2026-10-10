/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Metabolite ↔ app integration: how an HMDB record lands in the chemical bank,
 * the handoff payloads other features consume, and cross-source de-duplication.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { HmdbMetabolite } from "../../types/index.ts";
import { addToBank, clearBank, setBankHmdb, getBank } from "../bank/store.ts";
import {
  bankEntryFor, bankMetabolite, notebookDraftFor, pubchemQueryFor, pathwayLinks,
  openMetabolite, analogsFromMetabolite, logMetabolite, analyzeMetabolite, reactMetabolite,
} from "./actions.ts";
import {
  takePendingMetabolite, takePendingAnalogSeed, takePendingNotebookDraft, takePendingCompound, takePendingReactants,
} from "../../store/handoff.ts";

const glucose: HmdbMetabolite = {
  accession: "HMDB0000122",
  name: "D-Glucose",
  formula: "C6H12O6",
  averageMass: 180.1559,
  monoisotopicMass: 180.0634,
  iupacName: null,
  smiles: "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
  inchikey: null,
  casNumber: "50-99-7",
  state: "Solid",
  description: null,
  synonyms: [],
  classification: null,
  biospecimens: ["Blood"],
  tissues: [],
  cellularLocations: [],
  pathways: [{ name: "Glycolysis", smpdbId: "SMP0000040", keggMapId: "map00010" }, { name: "Pentose phosphate", smpdbId: null, keggMapId: null }],
  diseases: ["Diabetes mellitus type 2"],
  proteins: [
    { name: "Hexokinase-1", gene: "HK1", type: "Enzyme", uniprotId: "P19367" },
    { name: "GLUT1", gene: "SLC2A1", type: "Transporter", uniprotId: "P11166" },
  ],
  concentrations: [{ biospecimen: "Blood", value: "5000.0 +/- 1000.0", units: "uM" }],
  xrefs: { pubchemCid: 5793, keggId: "C00031", chebiId: "4167", drugbankId: null },
  url: "https://hmdb.ca/metabolites/HMDB0000122",
  structureImage: "",
};

beforeEach(() => clearBank());

test("a metabolite banks with its CID, mass, and HMDB accession", () => {
  assert.deepEqual(bankEntryFor(glucose), {
    id: "5793", name: "D-Glucose", formula: "C6H12O6", smiles: glucose.smiles, cid: 5793, mw: 180.1559, source: "HMDB", hmdb: "HMDB0000122",
  });
  assert.equal(bankEntryFor({ ...glucose, formula: null }), null);
  assert.equal(bankEntryFor({ ...glucose, xrefs: { ...glucose.xrefs, pubchemCid: null } })!.id, "HMDB0000122");
});

test("banking the same chemical from PubChem and HMDB merges instead of duplicating", () => {
  addToBank({ id: "5793", name: "Glucose", formula: "C6H12O6", cid: 5793, source: "Coca-Cola" });
  assert.equal(bankMetabolite(glucose), true);
  const bank = getBank();
  assert.equal(bank.length, 1);
  assert.equal(bank[0].hmdb, "HMDB0000122");
  assert.equal(bank[0].source, "Coca-Cola");
  assert.equal(bank[0].smiles, glucose.smiles);
});

test("HMDB accession de-duplicates entries that lack a CID", () => {
  addToBank({ id: "a", name: "Dextrose", formula: "C6H12O6", hmdb: "HMDB0000122" });
  addToBank({ id: "b", name: "D-Glucose", formula: "C6H12O6", hmdb: "HMDB0000122" });
  addToBank({ id: "c", name: "Urea", formula: "CH4N2O" });
  setBankHmdb("c", "HMDB0000294");
  assert.deepEqual(getBank().map((c) => [c.id, c.hmdb]), [["a", "HMDB0000122"], ["c", "HMDB0000294"]]);
});

test("notebook draft summarizes the biology for review", () => {
  const d = notebookDraftFor(glucose);
  assert.equal(d.name, "D-Glucose (HMDB0000122)");
  assert.equal(d.assay, "HMDB record retrieval");
  assert.equal(d.resultValue, "Blood: 5000.0 +/- 1000.0 uM");
  assert.match(d.notes!, /Pathways: Glycolysis, Pentose phosphate\./);
  assert.match(d.notes!, /Key enzymes: HK1\./); // transporters aren't enzymes
  assert.match(d.notes!, /Associated diseases: Diabetes mellitus type 2\./);
  assert.match(d.notes!, /Source: https:\/\/hmdb\.ca\/metabolites\/HMDB0000122 \(retrieved \d{4}-\d{2}-\d{2}\)/);
});

test("handoffs deliver one-shot payloads to the destination feature", () => {
  openMetabolite("HMDB0000122");
  assert.equal(takePendingMetabolite(), "HMDB0000122");
  assert.equal(takePendingMetabolite(), null);

  // An analog search is seeded by CID when HMDB cross-references one, else by structure.
  analogsFromMetabolite(glucose);
  assert.equal(takePendingAnalogSeed(), "5793");
  analogsFromMetabolite({ ...glucose, xrefs: { ...glucose.xrefs, pubchemCid: null } });
  assert.equal(takePendingAnalogSeed(), glucose.smiles);

  logMetabolite(glucose);
  assert.equal(takePendingNotebookDraft()?.source, "Metabolites");

  analyzeMetabolite(glucose);
  assert.equal(takePendingCompound(), "5793");
  assert.equal(pubchemQueryFor({ ...glucose, xrefs: { ...glucose.xrefs, pubchemCid: null } }), "D-Glucose");

  reactMetabolite(glucose);
  assert.deepEqual(takePendingReactants(), ["C6H12O6"]);
});

test("pathway links go to the exact map when HMDB provides its ID", () => {
  assert.equal(pathwayLinks(glucose.pathways[0]).smpdb, "https://smpdb.ca/view/SMP0000040");
  assert.equal(pathwayLinks(glucose.pathways[0]).kegg, "https://www.kegg.jp/pathway/map00010");
  assert.match(pathwayLinks(glucose.pathways[1]).smpdb, /search\?query=Pentose%20phosphate/);
});
