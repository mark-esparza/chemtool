/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Route tests for the metabolite integration endpoints, served by a real
 * Express app on an ephemeral port. Outbound HMDB/PubChem traffic is stubbed.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import hmdbRoute from "./routes/hmdb.ts";
import designRoute from "./routes/design.ts";
import { __test } from "./hmdb.ts";

const XML = readFileSync(new URL("./fixtures/hmdb-glucose.xml", import.meta.url), "utf8");
const realFetch = globalThis.fetch;
let server: Server;
let base = "";

before(async () => {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(base)) return realFetch(input, init);
    if (url.includes("/unearth/") && url.includes("glucose")) return new Response(`<a>HMDB0000122</a>`);
    if (url.includes("/unearth/")) return new Response("<html>No results</html>");
    if (url.endsWith("/metabolites/HMDB0000122.xml")) return new Response(XML);
    if (url.includes("autocomplete")) return new Response("{}");
    return new Response("", { status: 404 }); // PubChem: no such compound
  }) as typeof fetch;

  const app = express();
  app.use(express.json());
  app.use(hmdbRoute);
  app.use(designRoute);
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
  const res = await post("/api/hmdb/batch", { queries: "glucose" });
  assert.equal(res.status, 400);
});

test("POST /api/design-pipeline designs around an explicit metabolite seed", async () => {
  const seed = "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O";
  const res = await post("/api/design-pipeline", { prompt: "Design analogs of D-Glucose with balanced drug-like properties.", numSamples: 6, seedSmiles: seed });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.brief.seed_smiles, seed);
  assert.match(body.brief.objective_summary, /supplied seed scaffold/);
  assert.ok(body.candidates.length > 0);
  assert.equal(body.seed_properties.formula, "C6H12O6");
});

test("POST /api/design-pipeline rejects an unparseable seed", async () => {
  for (const seedSmiles of ["not a smiles", "XYZ", 42]) {
    const res = await post("/api/design-pipeline", { prompt: "anything", seedSmiles });
    assert.equal(res.status, 400, `seed ${JSON.stringify(seedSmiles)}`);
  }
});
