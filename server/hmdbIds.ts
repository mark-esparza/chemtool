/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HMDB accession helpers shared by the HMDB and PubChem clients. HMDB moved
 * from 5-digit (HMDB00122) to 7-digit (HMDB0000122) accessions; both forms
 * still appear in the wild (old papers, PubChem synonyms), so everything is
 * normalized to the current 7-digit form.
 */

const ACCESSION_RE = /^HMDB0*(\d{1,7})$/i;

/** Normalize an HMDB accession to the 7-digit form, or null if it isn't one. */
export function normalizeHmdbAccession(value: string): string | null {
  const m = value.trim().match(ACCESSION_RE);
  if (!m) return null;
  return `HMDB${m[1].padStart(7, "0")}`;
}

/** First HMDB accession found in a list of synonyms (e.g. PubChem's), normalized. */
export function findHmdbAccession(synonyms: string[]): string | null {
  for (const s of synonyms) {
    const acc = normalizeHmdbAccession(s);
    if (acc) return acc;
  }
  return null;
}
