/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Metabolite handoffs: the one place that knows how an HMDB record maps onto the
 * rest of the app — the chemical bank, Compound Search, the Reaction Simulator,
 * the Molecule Designer, and the Lab Notebook — and how other features open a
 * chemical in the Metabolites explorer.
 */

import type { HmdbMetabolite } from "../../types";
import { addToBank, BankChemical } from "../bank/store";
import {
  setPendingMetabolite,
  setPendingCompound,
  setPendingReactants,
  setPendingDesignSeed,
  setPendingNotebookDraft,
  NotebookDraft,
} from "../../store/handoff";
import { navigate } from "../../store/nav";

/** Open a chemical (name or HMDB accession) in the Metabolites explorer. */
export function openMetabolite(query: string) {
  setPendingMetabolite(query);
  navigate("metabolites");
}

/** Bank entry for a metabolite, carrying every identifier that cross-links it. */
export function bankEntryFor(m: HmdbMetabolite): BankChemical | null {
  if (!m.formula) return null;
  const cid = m.xrefs.pubchemCid ?? undefined;
  return {
    id: cid ? String(cid) : m.accession,
    name: m.name,
    formula: m.formula,
    smiles: m.smiles || undefined,
    cid,
    mw: m.averageMass ?? undefined,
    source: "HMDB",
    hmdb: m.accession,
  };
}

export function bankMetabolite(m: HmdbMetabolite): boolean {
  const entry = bankEntryFor(m);
  if (!entry) return false;
  addToBank(entry);
  return true;
}

/** PubChem query for a metabolite: its CID when HMDB cross-references one, else its name. */
export function pubchemQueryFor(m: HmdbMetabolite): string {
  return m.xrefs.pubchemCid ? String(m.xrefs.pubchemCid) : m.name;
}

export function analyzeMetabolite(m: HmdbMetabolite) {
  setPendingCompound(pubchemQueryFor(m));
  navigate("search");
}

export function reactMetabolite(m: HmdbMetabolite) {
  if (!m.formula) return;
  setPendingReactants([m.formula]);
  navigate("reactions");
}

export function designFromMetabolite(m: HmdbMetabolite) {
  if (!m.smiles) return;
  setPendingDesignSeed({ name: m.name, smiles: m.smiles });
  navigate("designer");
}

const fmtConc = (c: HmdbMetabolite["concentrations"][number]) => `${c.biospecimen}: ${c.value}${c.units ? ` ${c.units}` : ""}`;

/** A reviewable notebook entry summarizing the metabolite's biology. */
export function notebookDraftFor(m: HmdbMetabolite): NotebookDraft {
  const parts: string[] = [];
  if (m.pathways.length) parts.push(`Pathways: ${m.pathways.slice(0, 4).map((p) => p.name).join(", ")}.`);
  const enzymes = m.proteins.filter((p) => !p.type || /enzyme/i.test(p.type)).slice(0, 5);
  if (enzymes.length) parts.push(`Key enzymes: ${enzymes.map((p) => p.gene || p.name).join(", ")}.`);
  if (m.diseases.length) parts.push(`Associated diseases: ${m.diseases.slice(0, 4).join(", ")}.`);
  parts.push(`Source: ${m.url}`);
  return {
    name: `${m.name} (${m.accession})`,
    smiles: m.smiles || undefined,
    assay: "Metabolite profile (HMDB)",
    resultValue: m.concentrations[0] ? fmtConc(m.concentrations[0]) : undefined,
    notes: parts.join(" "),
    source: "Metabolites",
  };
}

export function logMetabolite(m: HmdbMetabolite) {
  setPendingNotebookDraft(notebookDraftFor(m));
  navigate("notebook");
}

/** External deep links for a pathway: the exact map when HMDB gives its ID, else a search. */
export function pathwayLinks(p: HmdbMetabolite["pathways"][number]) {
  const q = encodeURIComponent(p.name);
  return {
    smpdb: p.smpdbId ? `https://smpdb.ca/view/${p.smpdbId}` : `https://smpdb.ca/search?query=${q}`,
    kegg: p.keggMapId ? `https://www.kegg.jp/pathway/${p.keggMapId}` : `https://www.kegg.jp/kegg-bin/search_pathway_text?map=map&keyword=${q}`,
    biomodels: `https://www.ebi.ac.uk/biomodels/search?query=${q}`,
    reactome: `https://reactome.org/content/query?q=${q}`,
  };
}
