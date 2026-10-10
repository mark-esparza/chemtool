/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One HMDB metabolite record, and the handoffs from it into the rest of the
 * tool: the chemical bank, the compound record, an analog search, a reaction,
 * or the notebook.
 */

import React, { useEffect, useState } from "react";
import { Box, Btn, Tag, KeyVals, Ext, LinkBtn, Note, val } from "../../components/ui";
import type { HmdbMetabolite } from "../../types";
import { useBank } from "../bank/store";
import { navigate } from "../../store/nav";
import {
  bankMetabolite, analyzeMetabolite, reactMetabolite, analogsFromMetabolite, logMetabolite, pathwayLinks,
} from "./actions";

const ENGINES = [
  { name: "COPASI", desc: "ODE, stochastic and steady-state simulation of an SBML model", url: "https://copasi.org/" },
  { name: "Tellurium", desc: "Python systems-biology environment", url: "https://tellurium.analogmachine.org/" },
  { name: "COBRApy", desc: "Constraint-based / flux-balance analysis", url: "https://opencobra.github.io/cobrapy/" },
];

export default function MetaboliteRecord({ m }: { m: HmdbMetabolite }) {
  const bank = useBank();
  const banked = bank.some(
    (c) => c.hmdb === m.accession || (m.xrefs.pubchemCid != null && c.cid === m.xrefs.pubchemCid)
  );
  const [pathwayIdx, setPathwayIdx] = useState(0);
  useEffect(() => setPathwayIdx(0), [m.accession]);

  const pathway = m.pathways[pathwayIdx] ?? null;
  const links = pathway ? pathwayLinks(pathway) : null;
  const enzymes = m.proteins.filter((p) => !p.type || /enzyme/i.test(p.type));
  const cls = m.classification;

  return (
    <>
      <Box
        title={`${m.name} — ${m.accession}`}
        actions={
          <>
            {m.state && <Tag>{m.state}</Tag>}
            {cls?.superClass && <Tag>{cls.superClass}</Tag>}
          </>
        }
      >
        <div className="cols">
          {m.smiles && (
            <div className="col" style={{ flex: "0 0 160px" }}>
              <div className="struct" style={{ textAlign: "center" }}>
                <img
                  src={
                    m.xrefs.pubchemCid
                      ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${m.xrefs.pubchemCid}/PNG`
                      : `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(m.smiles)}/PNG`
                  }
                  alt={`Structure of ${m.name}`}
                  style={{ maxWidth: "100%", maxHeight: 150 }}
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}
          <div className="col">
            <KeyVals
              rows={[
                ["Formula", <span className="mono">{val(m.formula)}</span>],
                ["Average mass", m.averageMass === null ? null : `${m.averageMass} g/mol`],
                ["Monoisotopic", m.monoisotopicMass === null ? null : `${m.monoisotopicMass} g/mol`],
                ["IUPAC name", m.iupacName],
                ["Classification", cls ? [cls.class, cls.subClass, cls.directParent].filter(Boolean).join(" › ") : null],
                ["CAS", m.casNumber],
                ["InChIKey", m.inchikey ? <span className="mono small">{m.inchikey}</span> : null],
              ]}
            />
            {m.smiles && (
              <p style={{ marginTop: 6 }}>
                <span className="small muted">SMILES</span>
                <br />
                <code>{m.smiles}</code>
              </p>
            )}
          </div>
        </div>

        <hr />
        <div className="row">
          <Btn onClick={() => bankMetabolite(m)} disabled={!m.formula || banked}>
            {banked ? "In bank" : "Add to bank"}
          </Btn>
          <Btn onClick={() => analyzeMetabolite(m)}>Compound record</Btn>
          {m.smiles && <Btn onClick={() => analogsFromMetabolite(m)}>Find analogs</Btn>}
          {m.formula && <Btn onClick={() => reactMetabolite(m)}>Use in reaction</Btn>}
          <Btn onClick={() => logMetabolite(m)}>Record in notebook</Btn>
        </div>
      </Box>

      {(m.biospecimens.length > 0 || m.tissues.length > 0 || m.cellularLocations.length > 0) && (
        <Box title="Reported locations">
          <KeyVals
            rows={[
              ["Biofluids", m.biospecimens.length ? m.biospecimens.map((b) => <Tag key={b}>{b}</Tag>) : null],
              ["Tissues", m.tissues.length ? m.tissues.map((t) => <Tag key={t}>{t}</Tag>) : null],
              ["Cellular", m.cellularLocations.length ? m.cellularLocations.map((c) => <Tag key={c}>{c}</Tag>) : null],
            ]}
          />
        </Box>
      )}

      {m.concentrations.length > 0 && (
        <Box title="Reported normal concentrations" flush>
          <div className="scroll-x">
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Biofluid</th>
                  <th scope="col">Value</th>
                  <th scope="col">Units</th>
                  <th scope="col">Subject condition</th>
                </tr>
              </thead>
              <tbody>
                {m.concentrations.map((c, i) => (
                  <tr key={i}>
                    <td>{c.biospecimen}</td>
                    <td className="mono">{c.value}</td>
                    <td>{c.units || "—"}</td>
                    <td>{c.condition || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ padding: "4px 8px" }}>
            As deposited in HMDB from the primary literature. Ranges depend on assay, cohort and age
            band; consult the HMDB record for the citation behind each row.
          </p>
        </Box>
      )}

      <div className="cols">
        {m.diseases.length > 0 && (
          <div className="col">
            <Box title="Associated conditions">
              {m.diseases.map((d) => (
                <Tag key={d}>{d}</Tag>
              ))}
              <p className="small muted" style={{ marginTop: 4 }}>
                Association as recorded by HMDB, not a causal or diagnostic claim.
              </p>
            </Box>
          </div>
        )}
        {m.pathways.length > 0 && (
          <div className="col">
            <Box title="Pathways">
              <p className="small muted">Select a pathway to get its model links below.</p>
              {m.pathways.map((p, i) => (
                <React.Fragment key={`${p.name}-${i}`}>
                  <label className="small nowrap" style={{ display: "block" }}>
                    <input
                      type="radio"
                      name="pathway"
                      checked={i === pathwayIdx}
                      onChange={() => setPathwayIdx(i)}
                    />{" "}
                    {p.name}
                  </label>
                </React.Fragment>
              ))}
            </Box>
          </div>
        )}
      </div>

      {m.proteins.length > 0 && (
        <Box title={`Enzymes and transporters (${m.proteins.length})`} flush>
          <div className="scroll-x scroll-y">
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Protein</th>
                  <th scope="col">Gene</th>
                  <th scope="col">Type</th>
                  <th scope="col">UniProt</th>
                </tr>
              </thead>
              <tbody>
                {m.proteins.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td className="mono">{p.gene || "—"}</td>
                    <td>{p.type || "—"}</td>
                    <td>
                      {p.uniprotId ? (
                        <Ext href={`https://www.uniprot.org/uniprotkb/${p.uniprotId}`}>{p.uniprotId}</Ext>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      )}

      {links && pathway && (
        <Box title={`Model the pathway: ${pathway.name}`}>
          <p>
            To ask network questions — what accumulates when an enzyme is inhibited, which step
            limits flux — load an existing model into a simulator. Chemtool does not simulate
            networks itself; these links go to the curated sources and the engines that do.
          </p>
          <ul className="plain">
            <li>
              <Ext href={links.smpdb}>SMPDB</Ext> — HMDB's own pathway diagram
              {pathway.smpdbId ? ` (${pathway.smpdbId})` : " (search)"}
            </li>
            <li>
              <Ext href={links.kegg}>KEGG</Ext> — reference map
              {pathway.keggMapId ? ` ${pathway.keggMapId}` : " (search)"}
            </li>
            <li>
              <Ext href={links.biomodels}>BioModels</Ext> — curated SBML models (search)
            </li>
            <li>
              <Ext href={links.reactome}>Reactome</Ext> — curated human pathways (search)
            </li>
          </ul>
          <p className="small muted">Simulators: {ENGINES.map((e, i) => (
            <React.Fragment key={e.name}>
              {i > 0 && " · "}
              <Ext href={e.url}>{e.name}</Ext> ({e.desc})
            </React.Fragment>
          ))}</p>
          {enzymes.length > 0 && (
            <p className="small">
              Candidate perturbation points from this record:{" "}
              {enzymes.slice(0, 10).map((p) => (
                <Tag key={p.name} tone="warn">
                  {p.gene || p.name}
                </Tag>
              ))}
            </p>
          )}
        </Box>
      )}

      <Box title="Cross-references">
        <KeyVals
          rows={[
            [
              "PubChem",
              m.xrefs.pubchemCid ? (
                <>
                  <LinkBtn onClick={() => analyzeMetabolite(m)}>CID {m.xrefs.pubchemCid} in this tool</LinkBtn>
                  {" · "}
                  <Ext href={`https://pubchem.ncbi.nlm.nih.gov/compound/${m.xrefs.pubchemCid}`}>PubChem</Ext>
                </>
              ) : null,
            ],
            ["KEGG", m.xrefs.keggId ? <Ext href={`https://www.kegg.jp/entry/${m.xrefs.keggId}`}>{m.xrefs.keggId}</Ext> : null],
            [
              "ChEBI",
              m.xrefs.chebiId ? (
                <Ext href={`https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:${m.xrefs.chebiId}`}>
                  CHEBI:{m.xrefs.chebiId}
                </Ext>
              ) : null,
            ],
            ["DrugBank", m.xrefs.drugbankId ? <Ext href={`https://go.drugbank.com/drugs/${m.xrefs.drugbankId}`}>{m.xrefs.drugbankId}</Ext> : null],
            ["HMDB", <Ext href={m.url}>{m.accession}</Ext>],
          ]}
        />
        {m.synonyms.length > 0 && (
          <p style={{ marginTop: 6 }}>
            <span className="small muted">Synonyms: </span>
            {m.synonyms.map((s, i) => (
              <Tag key={i}>{s}</Tag>
            ))}
          </p>
        )}
      </Box>

      {m.description && (
        <Box title="Description">
          <p>{m.description}</p>
          <p className="small muted">Text as deposited in HMDB.</p>
        </Box>
      )}

      {m.pathways.length === 0 && m.proteins.length === 0 && (
        <Note kind="info">
          This HMDB record carries no pathway or protein associations. That is a gap in the record,
          not evidence that the metabolite has none.
        </Note>
      )}
    </>
  );
}
