/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Dna, Droplets, HeartPulse, Waypoints, Plus, Check, ExternalLink, Search as SearchIcon, FlaskConical } from "lucide-react";
import { Panel, Button, TextInput, Badge, Chip, Spinner, ErrorNote, StatTile, EmptyState } from "../../components/ui";
import { searchMetabolite } from "../../api/client";
import type { HmdbMetabolite } from "../../types";
import { addToBank } from "../bank/store";
import { setPendingReactants, setPendingCompound } from "../../store/handoff";
import { navigate } from "../../store/nav";

const EXAMPLES = ["Glucose", "Dopamine", "Cholesterol", "Lactic acid", "Urea", "Caffeine"];

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
                <div className="flex flex-wrap gap-1.5">{result.pathways.map((p) => <Badge key={p} tone="green">{p}</Badge>)}</div>
              </Panel>
            )}
          </div>

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
