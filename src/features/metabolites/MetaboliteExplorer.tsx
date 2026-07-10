/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Dna, Droplets, HeartPulse, Waypoints, Plus, Check, ExternalLink, Search as SearchIcon, FlaskConical, Network } from "lucide-react";
import { Panel, Button, TextInput, Badge, Chip, Spinner, ErrorNote, StatTile, EmptyState } from "../../components/ui";
import { searchMetabolite } from "../../api/client";
import type { HmdbMetabolite } from "../../types";
import { addToBank } from "../bank/store";
import { setPendingReactants, setPendingCompound } from "../../store/handoff";
import { navigate } from "../../store/nav";

const EXAMPLES = ["Glucose", "Dopamine", "Cholesterol", "Lactic acid", "Urea", "Caffeine"];

const enc = encodeURIComponent;
/** Where to find an existing, loadable model of a pathway. */
const modelSources = (q: string) => [
  { name: "BioModels", desc: "Curated systems-biology models (SBML) you can load into a simulator.", url: `https://www.ebi.ac.uk/biomodels/search?query=${enc(q)}` },
  { name: "KEGG PATHWAY", desc: "Reference metabolic pathway maps.", url: `https://www.kegg.jp/kegg-bin/search_pathway_text?map=map&keyword=${enc(q)}` },
  { name: "Reactome", desc: "Curated human pathways and reactions.", url: `https://reactome.org/content/query?q=${enc(q)}` },
  { name: "SMPDB", desc: "Small Molecule Pathway Database — HMDB's pathway source.", url: `https://smpdb.ca/search?query=${enc(q)}` },
];
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

export default function MetaboliteExplorer() {
  const [query, setQuery] = useState("Glucose");
  const [result, setResult] = useState<HmdbMetabolite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [banked, setBanked] = useState(false);

  const run = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true); setError(""); setResult(null); setBanked(false);
    try {
      setResult(await searchMetabolite(q.trim()));
    } catch (e: any) {
      setError(e?.message || "Metabolite search failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bank = () => {
    if (!result?.formula) return;
    addToBank({ id: result.accession, name: result.name, formula: result.formula, smiles: result.smiles || undefined, source: "HMDB" });
    setBanked(true);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Dna className="h-5 w-5 text-[#0A355C]" /> Metabolites
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Explore human metabolites from the HMDB — where they occur in the body, normal concentrations, linked diseases, and pathways.
        </p>
      </div>

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Search a body chemical — e.g. glucose, dopamine, cholesterol, or an HMDB ID"
            className="flex-1"
          />
          <Button icon={Dna} loading={loading} onClick={() => run()} disabled={!query.trim()}>Explore</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-400">Try:</span>
          {EXAMPLES.map((e) => <Chip key={e} onClick={() => { setQuery(e); run(e); }}>{e}</Chip>)}
        </div>
      </Panel>

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !result && <Spinner label="Searching the Human Metabolome Database…" />}

      {result && (
        <div className="space-y-6 animate-fadeIn">
          <Panel>
            <div className="flex flex-col gap-5 md:flex-row">
              {result.smiles && (
                <div className="flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-3 md:w-48">
                  <img
                    src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(result.smiles)}/PNG`}
                    alt={result.name}
                    className="max-h-40 max-w-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800">{result.name}</h2>
                  <Badge tone="blue">{result.accession}</Badge>
                  {result.state && <Badge tone="slate">{result.state}</Badge>}
                </div>
                {result.iupacName && <p className="mt-0.5 text-xs text-slate-500">{result.iupacName}</p>}

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <StatTile label="Formula" value={<span className="font-mono text-sm">{result.formula || "—"}</span>} />
                  <StatTile label="Avg. mass" value={result.averageMass ?? "—"} unit={result.averageMass ? "g/mol" : undefined} />
                  <StatTile label="Biofluids" value={result.biospecimens.length} tone="blue" />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant={banked ? "secondary" : "primary"} icon={banked ? Check : Plus} onClick={bank} disabled={!result.formula || banked}>
                    {banked ? "In bank" : "Add to bank"}
                  </Button>
                  <Button variant="secondary" icon={SearchIcon} onClick={() => { setPendingCompound(result.name); navigate("search"); }}>Analyze</Button>
                  {result.formula && (
                    <Button variant="secondary" icon={FlaskConical} onClick={() => { setPendingReactants([result.formula!]); navigate("reactions"); }}>Send to reactions</Button>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          {/* Where it's found */}
          {(result.biospecimens.length > 0 || result.tissues.length > 0) && (
            <Panel title="Where it's found in the body" icon={Droplets}>
              {result.biospecimens.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1.5 text-xs font-medium text-slate-500">Biofluids</div>
                  <div className="flex flex-wrap gap-1.5">{result.biospecimens.map((b) => <Badge key={b} tone="sky">{b}</Badge>)}</div>
                </div>
              )}
              {result.tissues.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium text-slate-500">Tissues</div>
                  <div className="flex flex-wrap gap-1.5">{result.tissues.map((t) => <Badge key={t} tone="slate">{t}</Badge>)}</div>
                </div>
              )}
            </Panel>
          )}

          {/* Concentrations */}
          {result.concentrations.length > 0 && (
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
                    {result.concentrations.map((c, i) => (
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
            {result.diseases.length > 0 && (
              <Panel title="Associated diseases" icon={HeartPulse}>
                <div className="flex flex-wrap gap-1.5">{result.diseases.map((d) => <Badge key={d} tone="rose">{d}</Badge>)}</div>
              </Panel>
            )}
            {result.pathways.length > 0 && (
              <Panel title="Metabolic pathways" icon={Waypoints}>
                <div className="flex flex-wrap gap-1.5">
                  {result.pathways.map((p) => (
                    <a key={p} href={`https://www.ebi.ac.uk/biomodels/search?query=${enc(p)}`} target="_blank" rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                      {p} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </Panel>
            )}
          </div>

          {/* Biochem pathway bridge — hand off to a network simulator */}
          <Panel title="Model this pathway" icon={Network}>
            <p className="text-sm leading-relaxed text-slate-600">
              To go beyond a single reaction, take a pathway into a systems-biology simulator and ask network questions — what accumulates if an
              enzyme is inhibited, which reaction is the bottleneck, or how flux shifts under aerobic vs anaerobic conditions.
            </p>
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0A355C]">1 · Find a model{result.pathways[0] ? ` for "${result.pathways[0]}"` : ""}</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {modelSources(result.pathways[0] || result.name).map((s) => <LinkTile key={s.name} {...s} />)}
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0A355C]">2 · Simulate the network</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {ENGINES.map((e) => <LinkTile key={e.name} {...e} />)}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Load an SBML model into COPASI/Tellurium, or a genome-scale model into COBRApy, then vary enzyme activity and substrate levels to test hypotheses. See <button onClick={() => navigate("guide")} className="text-[#0A355C] hover:underline cursor-pointer">Workflow &amp; Tools</button> for the full method.
            </p>
          </Panel>

          {result.description && (
            <Panel title="About" icon={Dna}>
              <p className="text-sm leading-relaxed text-slate-600">{result.description}</p>
            </Panel>
          )}

          <a href={result.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs font-medium text-[#0A355C] hover:underline">
            View full HMDB record <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {!loading && !result && !error && (
        <Panel><EmptyState icon={Dna} title="Search a metabolite" hint="Common names or HMDB IDs both work." /></Panel>
      )}
    </div>
  );
}
