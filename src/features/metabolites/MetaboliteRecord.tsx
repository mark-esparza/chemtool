/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One HMDB metabolite record: identity, where it lives in the body, its
 * pathways and enzymes, and the handoffs into the rest of Chem Studio.
 */

import React, { useEffect, useState } from "react";
import {
  Dna, Droplets, HeartPulse, Waypoints, Plus, Check, ExternalLink, Search as SearchIcon, FlaskConical, Network,
  Sparkles, NotebookPen, Microscope, Link2,
} from "lucide-react";
import { Panel, Button, Badge, StatTile } from "../../components/ui";
import type { HmdbMetabolite } from "../../types";
import { useBank } from "../bank/store";
import { navigate } from "../../store/nav";
import {
  bankMetabolite, analyzeMetabolite, reactMetabolite, designFromMetabolite, logMetabolite, pathwayLinks,
} from "./actions";

/** Engines that simulate a biochemical network. */
const ENGINES = [
  { name: "COPASI", desc: "Simulate & analyze the network — ODE, stochastic, steady state, parameter estimation.", url: "https://copasi.org/" },
  { name: "Tellurium", desc: "Programmable Python systems-biology environment.", url: "https://tellurium.analogmachine.org/" },
  { name: "COBRApy", desc: "Constraint-based / flux-balance analysis at genome scale.", url: "https://opencobra.github.io/cobrapy/" },
];

function LinkTile({ name, desc, url }: { name: string; desc: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="block rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-[#0A355C]/40 hover:bg-slate-50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800">{name}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{desc}</p>
    </a>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[#0A355C] hover:underline">
      {children} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export default function MetaboliteRecord({ m }: { m: HmdbMetabolite }) {
  const bank = useBank();
  const banked = bank.some((c) => c.hmdb === m.accession || (m.xrefs.pubchemCid != null && c.cid === m.xrefs.pubchemCid));
  const [pathwayIdx, setPathwayIdx] = useState(0);
  useEffect(() => setPathwayIdx(0), [m.accession]);

  const pathway = m.pathways[pathwayIdx] ?? null;
  const links = pathway ? pathwayLinks(pathway) : null;
  const q = encodeURIComponent(pathway?.name || m.name);
  const modelSources = links
    ? [
        { name: "BioModels", desc: "Curated systems-biology models (SBML) you can load into a simulator.", url: links.biomodels },
        { name: "KEGG PATHWAY", desc: pathway?.keggMapId ? `Reference map ${pathway.keggMapId}.` : "Reference metabolic pathway maps.", url: links.kegg },
        { name: "Reactome", desc: "Curated human pathways and reactions.", url: links.reactome },
        { name: "SMPDB", desc: pathway?.smpdbId ? `HMDB's own diagram, ${pathway.smpdbId}.` : "Small Molecule Pathway Database — HMDB's pathway source.", url: links.smpdb },
      ]
    : [
        { name: "BioModels", desc: "Curated systems-biology models (SBML) you can load into a simulator.", url: `https://www.ebi.ac.uk/biomodels/search?query=${q}` },
        { name: "Reactome", desc: "Curated human pathways and reactions.", url: `https://reactome.org/content/query?q=${q}` },
      ];

  const enzymes = m.proteins.filter((p) => !p.type || /enzyme/i.test(p.type));
  const cls = m.classification;

  return (
    <div className="space-y-6 animate-fadeIn">
      <Panel>
        <div className="flex flex-col gap-5 md:flex-row">
          {m.smiles && (
            <div className="flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-3 md:w-48">
              <img
                src={m.xrefs.pubchemCid
                  ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${m.xrefs.pubchemCid}/PNG`
                  : `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(m.smiles)}/PNG`}
                alt={m.name}
                className="max-h-40 max-w-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">{m.name}</h2>
              <Badge tone="blue">{m.accession}</Badge>
              {m.state && <Badge tone="slate">{m.state}</Badge>}
              {cls?.superClass && <Badge tone="green">{cls.superClass}</Badge>}
            </div>
            {m.iupacName && <p className="mt-0.5 break-words text-xs text-slate-500">{m.iupacName}</p>}
            {cls?.directParent && <p className="mt-0.5 text-xs text-slate-400">Class: {[cls.class, cls.subClass, cls.directParent].filter(Boolean).join(" › ")}</p>}

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Formula" value={<span className="font-mono text-sm">{m.formula || "—"}</span>} />
              <StatTile label="Avg. mass" value={m.averageMass ?? "—"} unit={m.averageMass ? "g/mol" : undefined} />
              <StatTile label="Biofluids" value={m.biospecimens.length} tone="blue" />
              <StatTile label="Enzymes" value={enzymes.length} tone="green" />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={banked ? "secondary" : "primary"} icon={banked ? Check : Plus} onClick={() => bankMetabolite(m)} disabled={!m.formula || banked}>
                {banked ? "In bank" : "Add to bank"}
              </Button>
              <Button variant="secondary" icon={SearchIcon} onClick={() => analyzeMetabolite(m)}>Analyze</Button>
              {m.formula && <Button variant="secondary" icon={FlaskConical} onClick={() => reactMetabolite(m)}>React</Button>}
              {m.smiles && <Button variant="secondary" icon={Sparkles} onClick={() => designFromMetabolite(m)}>Design analogs</Button>}
              <Button variant="secondary" icon={NotebookPen} onClick={() => logMetabolite(m)}>Log</Button>
            </div>
          </div>
        </div>
      </Panel>

      {(m.biospecimens.length > 0 || m.tissues.length > 0 || m.cellularLocations.length > 0) && (
        <Panel title="Where it's found in the body" icon={Droplets}>
          <div className="space-y-3">
            {m.biospecimens.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-medium text-slate-500">Biofluids</div>
                <div className="flex flex-wrap gap-1.5">{m.biospecimens.map((b) => <Badge key={b} tone="sky">{b}</Badge>)}</div>
              </div>
            )}
            {m.tissues.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-medium text-slate-500">Tissues</div>
                <div className="flex flex-wrap gap-1.5">{m.tissues.map((t) => <Badge key={t} tone="slate">{t}</Badge>)}</div>
              </div>
            )}
            {m.cellularLocations.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-medium text-slate-500">Inside the cell</div>
                <div className="flex flex-wrap gap-1.5">{m.cellularLocations.map((c) => <Badge key={c} tone="green">{c}</Badge>)}</div>
              </div>
            )}
          </div>
        </Panel>
      )}

      {m.concentrations.length > 0 && (
        <Panel title="Normal concentrations" icon={Droplets} padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Biofluid</th>
                  <th className="px-4 py-2 font-medium">Value</th>
                  <th className="px-4 py-2 font-medium">Units</th>
                  <th className="px-4 py-2 font-medium">Condition</th>
                </tr>
              </thead>
              <tbody>
                {m.concentrations.map((c, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 text-slate-700">{c.biospecimen}</td>
                    <td className="px-4 py-2 font-mono text-slate-800">{c.value}</td>
                    <td className="px-4 py-2 text-slate-500">{c.units}</td>
                    <td className="px-4 py-2 text-slate-500">{c.condition || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {m.diseases.length > 0 && (
          <Panel title="Associated diseases" icon={HeartPulse}>
            <div className="flex flex-wrap gap-1.5">{m.diseases.map((d) => <Badge key={d} tone="rose">{d}</Badge>)}</div>
          </Panel>
        )}
        {m.pathways.length > 0 && (
          <Panel title="Metabolic pathways" icon={Waypoints}>
            <p className="mb-2 text-[11px] text-slate-400">Pick a pathway to model it below.</p>
            <div className="flex flex-wrap gap-1.5">
              {m.pathways.map((p, i) => (
                <button
                  key={`${p.name}-${i}`}
                  onClick={() => setPathwayIdx(i)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                    i === pathwayIdx ? "border-emerald-500 bg-emerald-100 text-emerald-800" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {m.proteins.length > 0 && (
        <Panel title="Enzymes & proteins" icon={Microscope} padded={false}>
          <p className="px-4 pt-3 text-[12px] text-slate-500">
            Proteins that make, break down, or transport {m.name}. In a pathway model these are the candidate control points — inhibit one and see what accumulates.
          </p>
          <div className="mt-2 max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Protein</th>
                  <th className="px-4 py-2 font-medium">Gene</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">UniProt</th>
                </tr>
              </thead>
              <tbody>
                {m.proteins.map((p, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 text-slate-700">{p.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{p.gene || "—"}</td>
                    <td className="px-4 py-2 text-slate-500">{p.type || "—"}</td>
                    <td className="px-4 py-2 text-xs">{p.uniprotId ? <ExtLink href={`https://www.uniprot.org/uniprotkb/${p.uniprotId}`}>{p.uniprotId}</ExtLink> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Biochem pathway bridge — hand off to a network simulator */}
      <Panel title="Model this pathway" icon={Network}>
        <p className="text-sm leading-relaxed text-slate-600">
          To go beyond a single reaction, take a pathway into a systems-biology simulator and ask network questions — what accumulates if an
          enzyme is inhibited, which reaction is the bottleneck, or how flux shifts under aerobic vs anaerobic conditions.
        </p>
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0A355C]">1 · Find a model{pathway ? ` for "${pathway.name}"` : ""}</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {modelSources.map((s) => <LinkTile key={s.name} {...s} />)}
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0A355C]">2 · Simulate the network</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ENGINES.map((e) => <LinkTile key={e.name} {...e} />)}
          </div>
        </div>
        {enzymes.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0A355C]">3 · Perturb a control point</div>
            <div className="flex flex-wrap gap-1.5">
              {enzymes.slice(0, 8).map((p, i) => <Badge key={i} tone="amber">{p.gene || p.name}</Badge>)}
            </div>
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          Load an SBML model into COPASI/Tellurium, or a genome-scale model into COBRApy, then vary enzyme activity and substrate levels to test hypotheses. See <button onClick={() => navigate("guide")} className="text-[#0A355C] hover:underline cursor-pointer">Workflow &amp; Tools</button> for the full method.
        </p>
      </Panel>

      <Panel title="Cross-references" icon={Link2}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">PubChem</span>
            {m.xrefs.pubchemCid ? (
              <span className="flex items-center gap-3">
                <button onClick={() => analyzeMetabolite(m)} className="text-[#0A355C] hover:underline cursor-pointer">CID {m.xrefs.pubchemCid} in Compound Search</button>
                <ExtLink href={`https://pubchem.ncbi.nlm.nih.gov/compound/${m.xrefs.pubchemCid}`}>PubChem</ExtLink>
              </span>
            ) : <span className="text-slate-400">—</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">KEGG compound</span>
            {m.xrefs.keggId ? <ExtLink href={`https://www.kegg.jp/entry/${m.xrefs.keggId}`}>{m.xrefs.keggId}</ExtLink> : <span className="text-slate-400">—</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">ChEBI</span>
            {m.xrefs.chebiId ? <ExtLink href={`https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:${m.xrefs.chebiId}`}>CHEBI:{m.xrefs.chebiId}</ExtLink> : <span className="text-slate-400">—</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">DrugBank</span>
            {m.xrefs.drugbankId ? <ExtLink href={`https://go.drugbank.com/drugs/${m.xrefs.drugbankId}`}>{m.xrefs.drugbankId}</ExtLink> : <span className="text-slate-400">—</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">CAS</span>
            <span className="font-mono text-xs text-slate-700">{m.casNumber || "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">InChIKey</span>
            <span className="truncate font-mono text-[11px] text-slate-700">{m.inchikey || "—"}</span>
          </div>
        </div>
        {m.synonyms.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
            {m.synonyms.map((s, i) => <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{s}</span>)}
          </div>
        )}
      </Panel>

      {m.description && (
        <Panel title="About" icon={Dna}>
          <p className="text-sm leading-relaxed text-slate-600">{m.description}</p>
        </Panel>
      )}

      <a href={m.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs font-medium text-[#0A355C] hover:underline">
        View full HMDB record <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
