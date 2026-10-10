/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The browse index is navigation, not data — but a malformed entry would send a
 * query HMDB cannot resolve, so its shape is worth pinning.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { BROWSE_CATEGORIES, ALL_BROWSE_NAMES, randomMetaboliteName } from "./browseIndex.ts";
import { noteViewed, clearRecent, getRecent } from "./recent.ts";

test("every category is populated and uniquely keyed", () => {
  assert.ok(BROWSE_CATEGORIES.length >= 5);
  const keys = BROWSE_CATEGORIES.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length, "category keys must be unique");
  // "all" is the synthetic view key, so no real category may claim it.
  assert.ok(!keys.includes("all"));
  for (const c of BROWSE_CATEGORIES) {
    assert.ok(c.members.length >= 5, `${c.key} is too thin`);
    assert.ok(c.label.length > 0 && c.blurb.length > 0, `${c.key} needs a label and blurb`);
  }
});

test("names are clean query strings with no duplicates", () => {
  const seen = new Map<string, string>();
  for (const c of BROWSE_CATEGORIES) {
    for (const n of c.members) {
      assert.equal(n, n.trim(), `"${n}" has stray whitespace`);
      assert.ok(n.length > 1, `"${n}" is too short to resolve`);
      // An accession here would bypass the point of storing names.
      assert.ok(!/^HMDB\d+$/i.test(n), `"${n}" is an accession, not a name`);
      const prior = seen.get(n.toLowerCase());
      assert.equal(prior, undefined, `"${n}" appears in both ${prior} and ${c.key}`);
      seen.set(n.toLowerCase(), c.key);
    }
  }
  assert.equal(ALL_BROWSE_NAMES.length, seen.size);
});

test("the combined list is sorted and de-duplicated", () => {
  const sorted = [...ALL_BROWSE_NAMES].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(ALL_BROWSE_NAMES, sorted);
  assert.equal(new Set(ALL_BROWSE_NAMES).size, ALL_BROWSE_NAMES.length);
});

test("random picks stay inside the index, including at the range edges", () => {
  assert.equal(randomMetaboliteName(() => 0), ALL_BROWSE_NAMES[0]);
  // Math.random() never returns 1, but the last index must still be reachable.
  assert.equal(randomMetaboliteName(() => 0.999999), ALL_BROWSE_NAMES[ALL_BROWSE_NAMES.length - 1]);
  for (let i = 0; i < 50; i++) assert.ok(ALL_BROWSE_NAMES.includes(randomMetaboliteName()));
});

beforeEach(() => clearRecent());

test("recently viewed keeps the newest first without duplicating", () => {
  noteViewed({ accession: "HMDB0000122", name: "D-Glucose" });
  noteViewed({ accession: "HMDB0000073", name: "Dopamine" });
  assert.deepEqual(getRecent().map((r) => r.name), ["Dopamine", "D-Glucose"]);

  // Revisiting moves it back to the front rather than adding a second row.
  noteViewed({ accession: "HMDB0000122", name: "D-Glucose" });
  assert.deepEqual(getRecent().map((r) => r.name), ["D-Glucose", "Dopamine"]);
  assert.equal(getRecent().length, 2);
});

test("recently viewed is capped and ignores entries with no accession", () => {
  for (let i = 0; i < 20; i++) {
    noteViewed({ accession: `HMDB000${String(i).padStart(4, "0")}`, name: `M${i}` });
  }
  assert.equal(getRecent().length, 12);
  assert.equal(getRecent()[0].name, "M19");

  const before = getRecent().length;
  noteViewed({ accession: "", name: "nameless" });
  assert.equal(getRecent().length, before);
});
