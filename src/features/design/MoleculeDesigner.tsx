/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { Sparkles, TrendingUp, FileText, FlaskConical, Beaker, Plus, Eye, Layers, ShieldAlert, Download, Copy, Check, ListFilter } from "lucide-react";
import { Panel, Button, Field, TextInput, Badge, Chip, Spinner, ErrorNote, StatTile, EmptyState } from "../../components/ui";
import { Markdown } from "../../components/ui/Markdown";
import StructureRenderer from "../../components/StructureRenderer";
import { runDesignPipeline, evaluateSmiles, DesignResult } from "../../api/client";
import { addToBank } from "../bank/store";
import type { Candidate, MolecularProperties } from "../../types";

const PRESETS = [
  "A more soluble, easier-to-synthesize aspirin analog under 400 Da.",
  "A caffeine-like stimulant with fewer rotatable bonds.",
  "Safer acetaminophen analogs with a better logP profile.",
];

type SortKey = "plausibility" | "mw" | "clogp" | "qed" | "sa_score" | "tanimoto_distance";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "plausibility", label: "Plausibility" },
  { key: "qed", label: "Drug-likeness (QED)" },
  { key: "sa_score", label: "Ease of synthesis" },
  { key: "clogp", label: "logP" },
  { key: "mw", label: "Molecular weight" },
  { key: "tanimoto_distance", label: "Novelty" },
];

/** A 0–100 "worth testing" heuristic from the deterministic property scores. */
function plausibility(c: Candidate): number {
  const q = c.qed ?? 0; // 0..1
  const ease = 1 - Math.min(1, (c.sa_score ?? 5) / 10); // low SA score = easier
  const noAlert = c.structural_alerts.length === 0 ? 1 : 0;
  const lipinski = (c.ro5_violations ?? 0) === 0 ? 1 : 0;
  const d = c.tanimoto_distance ?? 0;
  const novelty = d >= 0.1 && d <= 0.6 ? 1 : 0.5; // meaningful-but-not-wild change
  return Math.round((q * 0.4 + ease * 0.2 + noAlert * 0.2 + lipinski * 0.1 + novelty * 0.1) * 100);
}

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MoleculeDesigner() {
  const [prompt, setPrompt] = useState(PRESETS[0]);
  const [numSamples, setNumSamples] = useState(12);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [active, setActive] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [safety, setSafety] = useState("");
  const [view, setView] = useState<"2d" | "3d">("2d");

  // Hypothesis controls
  const [sortKey, setSortKey] = useState<SortKey>("plausibility");
  const [paretoOnly, setParetoOnly] = useState(false);
  const [hideAlerts, setHideAlerts] = useState(false);
  const [drugLike, setDrugLike] = useState(false);
  const [topN, setTopN] = useState(5);
  const [copied, setCopied] = useState(false);

  // SMILES property calculator
  const [smiles, setSmiles] = useState("CN1C=NC2=C1C(=O)N(C(=O)N2C)C");
  const [calc, setCalc] = useState<MolecularProperties | null>(null);
  const [calcErr, setCalcErr] = useState("");

  const run = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(""); setSafety(""); setResult(null); setActive(null);
    try {
      const r = await runDesignPipeline(prompt, numSamples, []);
      setResult(r);
      setActive(r.candidates[0] || null);
    } catch (e: any) {
      if (e?.status === 403 && e?.body?.safety_tripped) setSafety(e.body.error);
      else setError(e?.message || "Design pipeline failed.");
    } finally {
      setLoading(false);
    }
  };

  const evaluate = async () => {
    if (!smiles.trim()) return;
    setCalcErr(""); setCalc(null);
    try {
      setCalc(await evaluateSmiles(smiles.trim()));
    } catch (e: any) {
      setCalcErr(e?.message || "Invalid SMILES.");
    }
  };

  const ranked = useMemo(() => {
    if (!result) return [] as { c: Candidate; score: number }[];
    let list = result.candidates.map((c) => ({ c, score: plausibility(c) }));
    if (paretoOnly) list = list.filter((x) => x.c.is_pareto_optimal);
    if (hideAlerts) list = list.filter((x) => x.c.structural_alerts.length === 0);
    if (drugLike) list = list.filter((x) => (x.c.ro5_violations ?? 0) === 0);
    list.sort((a, b) => {
      if (sortKey === "plausibility") return b.score - a.score;
      const av = (a.c as any)[sortKey] ?? 0;
      const bv = (b.c as any)[sortKey] ?? 0;
      return sortKey === "qed" || sortKey === "tanimoto_distance" ? bv - av : av - bv;
    });
    return list;
  }, [result, sortKey, paretoOnly, hideAlerts, drugLike]);

  const shortlist = ranked.slice(0, topN);

  const copySmiles = () => {
    const text = shortlist.map(({ c }) => `${c.smiles} ${c.name.replace(/\s+/g, "_")}`).join("\n");
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const exportCsv = () => {
    const header = ["name", "smiles", "formula", "mw", "clogp", "tpsa", "hbd", "hba", "qed", "sa_score", "ro5_violations", "novelty", "structural_alerts", "plausibility"];
    const q = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = shortlist.map(({ c, score }) => [
      q(c.name), q(c.smiles), q(c.formula), c.mw, c.clogp, c.tpsa, c.hbd, c.hba, c.qed, c.sa_score, c.ro5_violations, c.tanimoto_distance, q(c.structural_alerts.join("; ")), score,
    ].join(","));
    download("chemstudio-shortlist.csv", [header.join(","), ...rows].join("\n"), "text/csv");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Sparkles className="h-5 w-5 text-[#0A355C]" /> Molecule Designer
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          A <span className="font-medium text-slate-600">hypothesis generator</span>: enumerate analogs, rank them by how worth-testing they look, shortlist the best, and export to RDKit / ASKCOS / IBM RXN. It prioritizes experiments — it doesn't prove they'll work.
        </p>
      </div>

      <Panel>
        <Field label="Design goal">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-[#0A355C] focus:ring-2 focus:ring-[#0A355C]/10"
          />
        </Field>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Samples</span>
            <input type="range" min={5} max={24} value={numSamples} onChange={(e) => setNumSamples(+e.target.value)} className="accent-[#0A355C]" />
            <span className="w-6 font-mono text-sm font-semibold text-[#0A355C]">{numSamples}</span>
          </div>
          <Button icon={Sparkles} loading={loading} onClick={run} disabled={!prompt.trim()}>Generate analogs</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p, i) => <Chip key={i} onClick={() => setPrompt(p)}>{p.length > 42 ? p.slice(0, 42) + "…" : p}</Chip>)}
        </div>
      </Panel>

      {error && <ErrorNote>{error}</ErrorNote>}
      {safety && (
        <Panel className="border-rose-200">
          <div className="flex gap-3">
            <ShieldAlert className="h-6 w-6 shrink-0 text-rose-600" />
            <div><div className="text-sm font-semibold text-rose-900">Safety boundary tripped</div><p className="mt-1 text-sm text-rose-800">{safety}</p></div>
          </div>
        </Panel>
      )}
      {loading && !result && <Spinner label="Enumerating and scoring analogs…" />}

      {result && active && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Candidates" value={result.candidates.length} tone="blue" />
            <StatTile label="Passing filters" value={ranked.length} />
            <StatTile label="Shortlisted" value={shortlist.length} tone="green" />
            <StatTile label="With alerts" value={result.candidates.reduce((s, c) => s + (c.structural_alerts.length ? 1 : 0), 0)} tone="rose" />
          </div>

          {/* Hypothesis toolbar */}
          <Panel>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <ListFilter className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">Rank by</span>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-[#0A355C]">
                  {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <Chip active={paretoOnly} onClick={() => setParetoOnly((v) => !v)}>Pareto only</Chip>
                <Chip active={hideAlerts} onClick={() => setHideAlerts((v) => !v)}>No alerts</Chip>
                <Chip active={drugLike} onClick={() => setDrugLike((v) => !v)}>Drug-like</Chip>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500">Shortlist top</span>
                <select value={topN} onChange={(e) => setTopN(+e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-[#0A355C]">
                  {[3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="secondary" icon={copied ? Check : Copy} onClick={copySmiles} disabled={shortlist.length === 0}>{copied ? "Copied" : "Copy SMILES"}</Button>
                <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={shortlist.length === 0}>CSV</Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Export the shortlist and run it through a real reaction predictor (RDKit reaction enumeration, ASKCOS, IBM RXN) before committing to synthesis.</p>
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Ranked candidate list */}
            <div className="space-y-2 lg:col-span-1">
              <div className="text-xs font-medium text-slate-500">Ranked hypotheses</div>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {ranked.map(({ c, score }, i) => (
                  <button
                    key={i}
                    onClick={() => { setActive(c); setView("2d"); }}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${active === c ? "border-[#0A355C] bg-[#0A355C]/5" : i < topN ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="text-[11px] font-mono text-slate-400">#{i + 1}</span>
                        <span className="truncate text-sm font-medium text-slate-800">{c.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {c.is_pareto_optimal && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${score >= 70 ? "bg-emerald-100 text-emerald-700" : score >= 45 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{score}</span>
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono">{c.formula}</span><span>·</span><span>MW {c.mw}</span>
                      {c.structural_alerts.length > 0 && <span className="text-rose-500">· alert</span>}
                    </div>
                  </button>
                ))}
                {ranked.length === 0 && <div className="rounded-lg border border-slate-200 p-4 text-center text-xs text-slate-400">No candidates pass the current filters.</div>}
              </div>
            </div>

            {/* Active candidate */}
            <div className="space-y-6 lg:col-span-2">
              <Panel
                title={active.name}
                icon={Beaker}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge tone={plausibility(active) >= 70 ? "green" : plausibility(active) >= 45 ? "amber" : "slate"}>Plausibility {plausibility(active)}</Badge>
                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
                      {(["2d", "3d"] as const).map((v) => (
                        <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${view === v ? "bg-[#0A355C] text-white" : "text-slate-500 hover:text-slate-800"}`}>
                          {v === "2d" ? <Eye className="h-3 w-3" /> : <Layers className="h-3 w-3" />} {v.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              >
                <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-slate-200 bg-white">
                  {view === "2d" ? (
                    <img
                      src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(active.smiles)}/PNG`}
                      alt={active.name}
                      className="max-h-56 max-w-full object-contain p-4"
                      referrerPolicy="no-referrer"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ) : (
                    <StructureRenderer smiles={active.smiles} />
                  )}
                </div>
                <code className="mt-3 block break-all rounded bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-600">{active.smiles}</code>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  <StatTile label="MW" value={active.mw} unit="Da" />
                  <StatTile label="logP" value={active.clogp} />
                  <StatTile label="TPSA" value={active.tpsa} unit="Å²" />
                  <StatTile label="QED" value={active.qed} />
                  <StatTile label="SA score" value={active.sa_score} />
                  <StatTile label="HBD / HBA" value={`${active.hbd}/${active.hba}`} />
                  <StatTile label="Lipinski" value={active.ro5_violations} tone={active.ro5_violations ? "rose" : "green"} />
                  <StatTile label="Novelty" value={active.tanimoto_distance} />
                </div>

                {active.structural_alerts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">{active.structural_alerts.map((a, i) => <Badge key={i} tone="rose">{a}</Badge>)}</div>
                )}

                <p className="mt-3 border-t border-slate-100 pt-3 text-sm italic text-slate-600">"{active.mutation_rationale}"</p>

                <div className="mt-3">
                  <Button variant="secondary" icon={Plus} onClick={() => addToBank({
                    id: active.smiles, name: active.name, smiles: active.smiles, formula: active.formula, source: "Designer",
                  })}>
                    Add to bank
                  </Button>
                </div>
              </Panel>

              <Panel title="Analysis report" icon={FileText}>
                <div className="max-h-[60vh] overflow-y-auto pr-1"><Markdown text={result.explanation} /></div>
              </Panel>
            </div>
          </div>
        </>
      )}

      {/* SMILES property calculator */}
      <Panel title="Property calculator" icon={FlaskConical}>
        <p className="mb-3 text-xs text-slate-500">Paste any SMILES to compute molecular properties instantly (on-device).</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput value={smiles} onChange={(e) => setSmiles(e.target.value)} onKeyDown={(e) => e.key === "Enter" && evaluate()} className="flex-1 font-mono" placeholder="e.g. CC(=O)OC1=CC=CC=C1C(=O)O" />
          <Button variant="secondary" onClick={evaluate} disabled={!smiles.trim()}>Calculate</Button>
        </div>
        {calcErr && <div className="mt-2"><ErrorNote>{calcErr}</ErrorNote></div>}
        {calc && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <StatTile label="Formula" value={<span className="font-mono text-sm">{calc.formula}</span>} />
            <StatTile label="MW" value={calc.mw} />
            <StatTile label="logP" value={calc.clogp} />
            <StatTile label="TPSA" value={calc.tpsa} />
            <StatTile label="HBD/HBA" value={`${calc.hbd}/${calc.hba}`} />
            <StatTile label="Rot. bonds" value={calc.rotatable_bonds} />
          </div>
        )}
      </Panel>

      {!result && !loading && !error && (
        <Panel><EmptyState icon={Sparkles} title="Describe a molecule to design" hint="Or use the property calculator below with any SMILES." /></Panel>
      )}
    </div>
  );
}
