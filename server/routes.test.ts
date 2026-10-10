/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Route tests for the database-backed endpoints, served by a real Express app
 * on an ephemeral port. Outbound HMDB/PubChem traffic is stubbed with fixtures.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import hmdbRoute from "./routes/hmdb.ts";
import analogRoute from "./routes/analogs.ts";
import evaluateRoute from "./routes/evaluate.ts";
import { __test } from "./hmdb.ts";

const XML = readFileSync(new URL("./fixtures/hmdb-glucose.xml", import.meta.url), "utf8");
const realFetch = globalThis.fetch;
let server: Server;
let base = "";

/** Minimal PubChem stand-in: aspirin (2244) plus three similarity neighbors. */
const SYNONYMS: Record<number, string[]> = {
  2244: ["Aspirin", "Acetylsalicylic acid", "HMDB0001879"],
  338: ["Salicylic acid"],
  54675783: ["Acetylsalicylate anion"],
  9999999: ["Mystery compound"],
};
const PROPS: Record<number, Record<string, unknown>> = {
  2244: { CID: 2244, MolecularFormula: "C9H8O4", MolecularWeight: "180.16", SMILES: "CC(=O)OC1=CC=CC=C1C(=O)O", XLogP: 1.2, TPSA: 63.6, HBondDonorCount: 1, HBondAcceptorCount: 4, RotatableBondCount: 3 },
  338: { CID: 338, MolecularFormula: "C7H6O3", MolecularWeight: "138.12", SMILES: "OC1=CC=CC=C1C(=O)O", XLogP: 2.3, TPSA: 57.5, HBondDonorCount: 2, HBondAcceptorCount: 3, RotatableBondCount: 1 },
  54675783: { CID: 54675783, MolecularFormula: "C9H7O4", MolecularWeight: "179.15", SMILES: "CC(=O)OC1=CC=CC=C1C(=O)[O-]", XLogP: -1.0, TPSA: 66.4, HBondDonorCount: 0, HBondAcceptorCount: 4, RotatableBondCount: 3 },
  // No SMILES: exercises the "not scorable on-device" path.
  9999999: { CID: 9999999, MolecularFormula: "C5H5", MolecularWeight: "65.09" },
};

function pubchemStub(url: string, init?: any): Response | null {
  const body = new URLSearchParams(typeof init?.body === "string" ? init.body : "");
  const J = (o: unknown) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });

  if (url.includes("fastsimilarity_2d")) {
    return J({ IdentifierList: { CID: [2244, 338, 54675783, 9999999] } });
  }
  if (url.includes("/compound/cid/property/")) {
    const cids = (body.get("cid") || "").split(",").map(Number);
    return J({ PropertyTable: { Properties: cids.map((c) => PROPS[c]).filter(Boolean) } });
  }
  if (url.includes("/compound/cid/synonyms/")) {
    const cids = (body.get("cid") || "").split(",").map(Number);
    return J({ InformationList: { Information: cids.map((c) => ({ CID: c, Synonym: SYNONYMS[c] ?? [] })) } });
  }
  // Single-compound GET endpoints used by the PubChem client when resolving a seed.
  const nameMatch = url.match(/compound\/name\/([^/]+)\/cids/);
  if (nameMatch) {
    return decodeURIComponent(nameMatch[1]).toLowerCase() === "aspirin"
      ? J({ IdentifierList: { CID: [2244] } })
      : new Response("", { status: 404 });
  }
  const cidProp = url.match(/compound\/cid\/(\d+)\/property\//);
  if (cidProp) return J({ PropertyTable: { Properties: [PROPS[Number(cidProp[1])] ?? {}] } });
  const cidSyn = url.match(/compound\/cid\/(\d+)\/synonyms\//);
  if (cidSyn) return J({ InformationList: { Information: [{ Synonym: SYNONYMS[Number(cidSyn[1])] ?? [] }] } });
  if (url.includes("/description/")) return J({});
  if (url.includes("autocomplete")) return J({});
  return null;
}

before(async () => {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(base)) return realFetch(input, init);
    if (url.includes("pubchem")) return pubchemStub(url, init) ?? new Response("", { status: 404 });
    if (url.includes("/unearth/")) return new Response(/glucose/i.test(decodeURIComponent(url)) ? "HMDB0000122" : "none");
    if (url.endsWith("/metabolites/HMDB0000122.xml")) return new Response(XML);
    return new Response("", { status: 404 });
  }) as typeof fetch;

  const app = express();
  app.use(express.json());
  app.use(hmdbRoute);
  app.use(analogRoute);
  app.use(evaluateRoute);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  __test.clearCache();
});

after(() => {
  globalThis.fetch = realFetch;
  server.close();
});

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const noFilters = { mwMax: null, logpMax: null, tpsaMax: null, hbdMax: null, hbaMax: null, rotMax: null, lipinskiOnly: false };

test("POST /api/hmdb/batch profiles each query in order", async () => {
  const res = await post("/api/hmdb/batch", { queries: ["glucose", "sodium chloride", " ", "HMDB00122"] });
  assert.equal(res.status, 200);
  const { results } = await res.json();
  assert.deepEqual(results.map((r: any) => [r.query, r.success, r.data?.accession ?? null]), [
    ["glucose", true, "HMDB0000122"],
    ["sodium chloride", false, null],
    ["HMDB00122", true, "HMDB0000122"],
  ]);
  assert.match(results[1].error, /Not a known human metabolite/);
});

test("POST /api/hmdb/batch rejects a missing queries array", async () => {
  assert.equal((await post("/api/hmdb/batch", { queries: "glucose" })).status, 400);
});

test("POST /api/analogs returns real neighbors with both value sets", async () => {
  const res = await post("/api/analogs", { seed: "Aspirin", threshold: 90, maxRecords: 25, filters: noFilters });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.seed.cid, 2244);
  assert.equal(body.query.threshold, 90);
  // The seed is excluded from its own neighborhood.
  assert.ok(!body.candidates.some((c: any) => c.cid === 2244));
  assert.deepEqual(body.candidates.map((c: any) => c.cid).sort((a: number, b: number) => a - b), [338, 9999999, 54675783]);

  const salicylic = body.candidates.find((c: any) => c.cid === 338);
  assert.equal(salicylic.name, "Salicylic acid");
  assert.equal(salicylic.pubchem.xlogp, 2.3); // PubChem's own value, unaltered
  assert.equal(salicylic.computed.formula, "C7H6O3"); // recomputed on-device
  assert.ok(salicylic.tanimotoDistance > 0 && salicylic.tanimotoDistance <= 1);
  assert.equal(salicylic.passes, true);

  // A compound PubChem returns without a structure is reported, not scored.
  const unscorable = body.candidates.find((c: any) => c.cid === 9999999);
  assert.equal(unscorable.computed, null);
  assert.match(unscorable.computeError, /no SMILES/);
  assert.equal(body.counts.notScored, 1);
});

test("POST /api/analogs applies descriptor bounds and reports why a candidate failed", async () => {
  const res = await post("/api/analogs", {
    seed: "Aspirin",
    filters: { ...noFilters, mwMax: 150 },
  });
  const body = await res.json();
  const salicylic = body.candidates.find((c: any) => c.cid === 338);
  const acetyl = body.candidates.find((c: any) => c.cid === 54675783);
  assert.equal(salicylic.passes, true); // 138 Da
  assert.equal(acetyl.passes, false); // ~179 Da
  assert.match(acetyl.failedFilters.join(" "), /molecular mass .* > 150/);
  // A candidate with no computed values cannot satisfy a bound on them.
  assert.equal(body.candidates.find((c: any) => c.cid === 9999999).passes, false);
});

test("POST /api/analogs reports a Pareto front only with two or more objectives", async () => {
  const one = await (await post("/api/analogs", { seed: "Aspirin", filters: { ...noFilters, mwMax: 500 } })).json();
  assert.deepEqual(one.query.paretoObjectives, []);
  assert.equal(one.counts.paretoOptimal, 0);

  const two = await (await post("/api/analogs", { seed: "Aspirin", filters: { ...noFilters, mwMax: 500, tpsaMax: 140 } })).json();
  assert.deepEqual(two.query.paretoObjectives, ["molecular mass", "TPSA"]);
  assert.ok(two.counts.paretoOptimal > 0);
});

test("POST /api/analogs 404s on a seed PubChem does not know", async () => {
  const res = await post("/api/analogs", { seed: "notacompound", filters: noFilters });
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /no compound matching/i);
});

test("POST /api/analogs requires a seed", async () => {
  assert.equal((await post("/api/analogs", { filters: noFilters })).status, 400);
});

test("POST /api/evaluate rejects an unparseable structure instead of inventing values", async () => {
  const ok = await post("/api/evaluate", { smiles: "CC(=O)OC1=CC=CC=C1C(=O)O" });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).formula, "C9H8O4");

  const bad = await post("/api/evaluate", { smiles: "XYZ" });
  assert.equal(bad.status, 400);
  const body = await bad.json();
  assert.match(body.error, /could not be parsed/);
  assert.equal(body.formula, undefined); // no placeholder record
});
