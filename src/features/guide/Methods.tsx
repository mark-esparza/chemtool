/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Methods: where each number on screen comes from, and what it does not
 * establish. This page is the tool's own limitations section.
 */

import React from "react";
import { Box, Ext, Note } from "../../components/ui";

interface Row {
  value: string;
  how: string;
  caveat: string;
}

const FROM_DATABASES: Row[] = [
  {
    value: "Compound identity, formula, mass, XLogP3, TPSA, H-bond counts, rotatable bonds",
    how: "Retrieved per query from PubChem PUG-REST and reported unchanged.",
    caveat: "PubChem computes these with its own pipeline; they are reference values, not measurements.",
  },
  {
    value: "Structural analogs",
    how: "PubChem fastsimilarity_2d: compounds whose 2D fingerprint Tanimoto similarity to the seed meets the threshold you set.",
    caveat: "Fingerprint similarity is not activity similarity, in either direction.",
  },
  {
    value: "Metabolite physiology, concentrations, diseases, pathways, enzymes",
    how: "Parsed from the HMDB record for the accession, as deposited.",
    caveat: "Concentration ranges come from the primary literature HMDB cites and vary by assay and cohort.",
  },
  {
    value: "Cross-references (CID, KEGG, ChEBI, DrugBank, UniProt, HMDB)",
    how: "Identifiers as deposited in the source record; links are constructed from them.",
    caveat: "Cross-references can be incomplete or lag behind the source databases.",
  },
];

const ON_DEVICE: Row[] = [
  {
    value: "Molecular formula and average mass",
    how: "Atom counts from the parsed structure graph with standard atomic weights.",
    caveat: "Average mass, not monoisotopic; no isotope or charge handling.",
  },
  {
    value: "TPSA",
    how: "Ertl et al. (2000) fragment contributions summed over N and O atoms, with a single sulfur value.",
    caveat: "Simplified: sulfur oxidation states are not distinguished and phosphorus is not counted.",
  },
  {
    value: "logP estimate",
    how: "Atom-additive sum of per-element increments.",
    caveat:
      "A coarse estimate, deliberately named as one. It is not Crippen cLogP or XLogP3. Where a PubChem CID is known, prefer the XLogP3 value shown beside it.",
  },
  {
    value: "H-bond donors and acceptors",
    how: "Lipinski's counts: acceptors are N and O atoms; donors are N and O carrying at least one hydrogen.",
    caveat: "The simple N+O convention overcounts relative to definitions that exclude amide nitrogen.",
  },
  {
    value: "Rotatable bonds",
    how: "Acyclic single bonds between two non-terminal heavy atoms, excluding amide C–N. Ring membership is determined by testing whether each bond is a bridge.",
    caveat: "Does not exclude other restricted rotations such as hindered biaryl bonds.",
  },
  {
    value: "Ring counts",
    how: "Cyclomatic number of the structure graph, and of its aromatic subgraph.",
    caveat: "Counts independent cycles, which can differ from a chemist's ring perception in fused systems.",
  },
  {
    value: "Lipinski and Veber violations",
    how: "Direct application of the published cut-offs to the values above.",
    caveat: "Inherits the logP estimate's error; a borderline count may flip with a better logP.",
  },
  {
    value: "Desirability index",
    how: "Unweighted geometric mean of six Gaussian desirability terms.",
    caveat:
      "Not Bickerton et al.'s QED: no fitted ADS functions, no weighting, no aromatic-ring or alert terms. Use it to order one result set only.",
  },
  {
    value: "Complexity index",
    how: "Proxy from heavy-atom count, ring count and flexibility, scaled 1–10.",
    caveat:
      "Not the Ertl–Schuffenhauer synthetic accessibility score. It has no fragment-frequency term and says nothing about synthesis.",
  },
  {
    value: "Functional groups",
    how: "Local connectivity patterns read off the parsed structure graph.",
    caveat:
      "Descriptive only. This is not PAINS, Brenk or any published alert set, and a listed group is not a liability claim.",
  },
  {
    value: "Fingerprint distance",
    how: "1 − Tanimoto over this app's own substructure fingerprint.",
    caveat:
      "Comparable only within this tool; the values differ from ECFP, MACCS or PubChem fingerprint distances.",
  },
  {
    value: "Balanced equations",
    how: "Products from a pattern knowledge base or deterministic classifier; coefficients solved from atom conservation and verified by re-counting both sides.",
    caveat: "Unbalanceable reactions are reported as such. No kinetics, yield or selectivity is modelled.",
  },
];

function Table({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <Box title={title} flush>
      <div className="scroll-x">
        <table className="grid">
          <thead>
            <tr>
              <th scope="col" style={{ width: "26%" }}>Value</th>
              <th scope="col" style={{ width: "37%" }}>How it is produced</th>
              <th scope="col">What it does not establish</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.value}</td>
                <td>{r.how}</td>
                <td className="muted">{r.caveat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Box>
  );
}

export default function Methods() {
  return (
    <div>
      <h2 className="title">Methods and limitations</h2>
      <p className="lede">
        Every figure this tool displays is either retrieved from a public database or computed
        on-device from a parsed structure. This page states which is which, and what each value
        cannot be used to claim.
      </p>

      <Note title="What this tool does not do">
        It does not predict binding affinity, protein targets, docking poses, toxicity, metabolic
        fate, synthetic routes or yields. Earlier versions displayed figures of that kind which were
        produced by fixed formulas over simple descriptors rather than by any structural or
        pharmacological calculation; they have been removed rather than relabelled. For
        protein–ligand work use a structure-based tool; for metabolite prediction use a validated
        biotransformation engine.
      </Note>

      <Table title="Values retrieved from databases" rows={FROM_DATABASES} />
      <Table title="Values computed on-device" rows={ON_DEVICE} />

      <Box title="Reproducibility">
        <ul className="plain">
          <li>
            Database queries are live. A result reflects the source database on the date shown in
            the result header, and re-running later may differ as records are updated.
          </li>
          <li>
            Analog searches record their seed CID, similarity threshold, record cap and retrieval
            timestamp in the exported CSV header, so a query can be restated exactly.
          </li>
          <li>
            On-device calculations are deterministic: the same structure gives the same values on
            any machine, with no network dependence and no random component.
          </li>
          <li>
            Where a structure cannot be parsed, the tool reports an error. It never substitutes
            placeholder or default values for a failed calculation.
          </li>
        </ul>
      </Box>

      <Box title="Sources">
        <ul className="plain">
          <li>
            <Ext href="https://pubchem.ncbi.nlm.nih.gov/">PubChem</Ext> — Kim S. et al., <i>Nucleic
            Acids Res.</i> 49:D1388 (2021). PUG-REST compound, property, synonym and
            fastsimilarity_2d services.
          </li>
          <li>
            <Ext href="https://hmdb.ca/">Human Metabolome Database</Ext> — Wishart D.S. et al.,{" "}
            <i>Nucleic Acids Res.</i> 50:D622 (2022).
          </li>
          <li>
            TPSA fragment contributions — Ertl P., Rohde B., Selzer P., <i>J. Med. Chem.</i>{" "}
            43:3714 (2000).
          </li>
          <li>
            Rule-of-five cut-offs — Lipinski C.A. et al., <i>Adv. Drug Deliv. Rev.</i> 23:3 (1997);
            rotatable-bond and TPSA cut-offs — Veber D.F. et al., <i>J. Med. Chem.</i> 45:2615
            (2002).
          </li>
        </ul>
        <p className="small muted">
          Database content is used under each provider's terms. Citing a result from this tool
          should cite the underlying database as well as the software.
        </p>
      </Box>

      <Box title="Tools to hand off to">
        <ul className="plain">
          <li>
            <Ext href="https://www.rdkit.org/">RDKit</Ext> — reference cheminformatics
            implementations of the descriptors approximated here, plus substructure matching and
            reaction enumeration.
          </li>
          <li>
            <Ext href="https://copasi.org/">COPASI</Ext> and{" "}
            <Ext href="https://opencobra.github.io/cobrapy/">COBRApy</Ext> — simulation of a
            metabolic network once you have an SBML or genome-scale model.
          </li>
          <li>
            <Ext href="https://www.ebi.ac.uk/biomodels/">BioModels</Ext> and{" "}
            <Ext href="https://reactome.org/">Reactome</Ext> — curated pathway models to start from.
          </li>
        </ul>
      </Box>
    </div>
  );
}
