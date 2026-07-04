/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, TrendingUp, FileText, FlaskConical, Beaker, Plus, Eye, Layers, ShieldAlert } from "lucide-react";
import { Panel, Button, Field, TextInput, Badge, Chip, Spinner, ErrorNote, StatTile, EmptyState } from "../../components/ui";
import { Markdown } from "../../components/ui/Markdown";
import StructureRenderer from "../../components/StructureRenderer";
import { runDesignPipeline, evaluateSmiles, DesignResult } from "../../api/client";
import { addExperiment } from "../experiments/store";
import type { Candidate, MolecularProperties } from "../../types";

const PRESETS = [
  "A more soluble, easier-to-synthesize aspirin analog under 400 Da.",
  "A caffeine-like stimulant with fewer rotatable bonds.",
  "Safer acetaminophen analogs with a better logP profile.",
];

export default function MoleculeDesigner() {
  const [prompt, setPrompt] = useState(PRESETS[0]);
  const [numSamples, setNumSamples] = useState(12);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [active, setActive] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [safety, setSafety] = useState("");
  const [view, setView] = useState<"2d" | "3d">("2d");

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

  const paretoCount = result?.candidates.filter((c) => c.is_pareto_optimal).length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Sparkles className="h-5 w-5 text-[#0A355C]" /> Molecule Designer
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Describe a design goal. The engine enumerates analogs around a seed scaffold, scores their properties, and ranks them on a Pareto front.
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
          {PRESETS.map((p, i) => (
            <Chip key={i} onClick={() => setPrompt(p)}>{p.length > 42 ? p.slice(0, 42) + "…" : p}</Chip>
          ))}
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
            <StatTile label="Seed scaffold" value={<span className="font-mono text-xs">{result.brief.seed_smiles.slice(0, 16)}…</span>} />
            <StatTile label="Candidates" value={result.candidates.length} tone="blue" />
            <StatTile label="Pareto-optimal" value={paretoCount} tone="green" />
            <StatTile label="Alerts" value={result.candidates.reduce((s, c) => s + c.structural_alerts.length, 0)} tone="rose" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Candidate list */}
            <div className="space-y-2 lg:col-span-1">
              <div className="text-xs font-medium text-slate-500">Ranked candidates</div>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {result.candidates.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => { setActive(c); setView("2d"); }}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${active === c ? "border-[#0A355C] bg-[#0A355C]/5" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">{c.name}</span>
                      {c.is_pareto_optimal && <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono">{c.formula}</span>
                      <span>·</span>
                      <span>MW {c.mw}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Active candidate */}
            <div className="space-y-6 lg:col-span-2">
              <Panel
                title={active.name}
                icon={Beaker}
                actions={
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
                    {(["2d", "3d"] as const).map((v) => (
                      <button key={v} onClick={() => setView(v)}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${view === v ? "bg-[#0A355C] text-white" : "text-slate-500 hover:text-slate-800"}`}>
                        {v === "2d" ? <Eye className="h-3 w-3" /> : <Layers className="h-3 w-3" />} {v.toUpperCase()}
                      </button>
                    ))}
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
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {active.structural_alerts.map((a, i) => <Badge key={i} tone="rose">{a}</Badge>)}
                  </div>
                )}

                <p className="mt-3 border-t border-slate-100 pt-3 text-sm italic text-slate-600">"{active.mutation_rationale}"</p>

                <div className="mt-3">
                  <Button variant="secondary" icon={Plus} onClick={() => addExperiment({
                    name: active.name, smiles: active.smiles, assay: "In-silico design candidate",
                    resultValue: `QED ${active.qed} · SA ${active.sa_score}`, outcome: "partial",
                    notes: active.mutation_rationale,
                  })}>
                    Log to Lab Notebook
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
