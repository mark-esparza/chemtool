/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Compass, FlaskConical, Dna, ExternalLink, AlertTriangle, ArrowRight, Beaker } from "lucide-react";
import { Panel, Badge } from "../../components/ui";
import { navigate, ViewId } from "../../store/nav";

interface Step {
  title: string;
  body: string;
  inApp?: { label: string; view: ViewId };
}

const ORGANIC: Step[] = [
  { title: "Define the transformation", body: "State what you want to make — e.g. \"convert an alcohol to an ester\" or \"test amide formation between these acids and amines.\"" },
  { title: "Enter reactants as structures", body: "Work from SMILES / structures rather than vague names so the tooling can reason about functional groups.", inApp: { label: "Property calculator", view: "designer" } },
  { title: "Enumerate & predict products", body: "Generate the candidate space — analogs of a seed, or products of a reaction template applied to a reagent set.", inApp: { label: "Molecule Designer", view: "designer" } },
  { title: "Rank & filter the outputs", body: "Down-select on instability, functional-group conflicts, toxic/reactive motifs, drug-likeness, novelty, and physicochemical properties (logP, TPSA, MW).", inApp: { label: "Designer shortlist", view: "designer" } },
  { title: "Design a small screen", body: "Instead of trying 50 reactions, narrow to the 5–10 most plausible and export them to a real predictor before committing to synthesis." },
];

const BIOCHEM: Step[] = [
  { title: "Frame it as a network, not one flask", body: "Ask systems questions: what accumulates if enzyme X is inhibited? which reaction is the bottleneck? aerobic vs anaerobic?" },
  { title: "Anchor on the metabolite", body: "Pull a metabolite's biofluid locations, normal concentrations, associated diseases, and the pathways it sits in.", inApp: { label: "Metabolites (HMDB)", view: "metabolites" } },
  { title: "Model the pathway", body: "Simulate the reaction network — steady state, ODE dynamics, or flux balance — to find control points and predicted responses." },
  { title: "Interpret as control points", body: "The useful result isn't \"this works,\" it's \"this enzyme is a strong control point\" or \"these analogs are chemically plausible.\"" },
];

interface Tool {
  name: string;
  desc: string;
  url: string;
}

const ORGANIC_TOOLS: Tool[] = [
  { name: "RDKit", desc: "Open-source cheminformatics; its reaction module enumerates products from a reaction template + a reagent set.", url: "https://www.rdkit.org/" },
  { name: "ASKCOS", desc: "Computer-aided organic synthesis planning and feasible retrosynthetic route prediction (MIT).", url: "https://askcos.mit.edu/" },
  { name: "IBM RXN for Chemistry", desc: "Reaction prediction, retrosynthesis, and procedure-oriented tools.", url: "https://rxn.res.ibm.com/" },
];

const BIOCHEM_TOOLS: Tool[] = [
  { name: "COPASI", desc: "Simulation & analysis of biochemical networks — SBML models, ODE + stochastic simulation, parameter estimation.", url: "https://copasi.org/" },
  { name: "Tellurium", desc: "Python environment for building, simulating, and analyzing systems-biology models reproducibly.", url: "https://tellurium.analogmachine.org/" },
  { name: "COBRApy", desc: "Constraint-based metabolic modeling — flux balance analysis and gene-deletion at genome scale.", url: "https://opencobra.github.io/cobrapy/" },
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0A355C] text-[11px] font-bold text-white">{i + 1}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{s.title}</span>
              {s.inApp && (
                <button onClick={() => navigate(s.inApp!.view)} className="inline-flex items-center gap-1 rounded-full border border-[#0A355C]/20 bg-[#0A355C]/5 px-2 py-0.5 text-[11px] font-medium text-[#0A355C] hover:bg-[#0A355C]/10 cursor-pointer">
                  {s.inApp.label} <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <a href={tool.url} target="_blank" rel="noreferrer noopener" className="block rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-[#0A355C]/40 hover:bg-slate-50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800">{tool.name}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{tool.desc}</p>
    </a>
  );
}

export default function Methodology() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Compass className="h-5 w-5 text-[#0A355C]" /> Workflow & Tools
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          How to get research value out of a reaction simulator — and where Chem Studio fits alongside professional tools.
        </p>
      </div>

      <Panel>
        <p className="text-sm leading-relaxed text-slate-600">
          The practical way to use a reaction simulator is as a <span className="font-semibold text-slate-800">hypothesis generator</span>: it helps you decide which
          reactions or pathways are worth testing — not as proof that a reaction will work. Use it to move from
          <span className="italic"> "I wonder what happens" </span> to a ranked list of testable hypotheses, then verify in the lab or in a dedicated engine.
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Organic chemistry workflow" icon={FlaskConical}>
          <StepList steps={ORGANIC} />
        </Panel>
        <Panel title="Biochemistry workflow" icon={Dna}>
          <StepList steps={BIOCHEM} />
        </Panel>
      </div>

      <Panel title="A strong end-to-end workflow" icon={Beaker}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#0A355C]">Organic side</div>
            <p className="text-[13px] leading-relaxed text-slate-600">Predict plausible products, side products, and synthetic routes; rank and shortlist.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#0A355C]">Biochem side</div>
            <p className="text-[13px] leading-relaxed text-slate-600">Model how those molecules interact with enzymes, metabolites, and pathways.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#0A355C]">Research value</div>
            <p className="text-[13px] leading-relaxed text-slate-600">"These three analogs are chemically plausible, and this enzyme is a strong control point."</p>
          </div>
        </div>
      </Panel>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <div className="text-sm font-semibold text-amber-900">Don't trust the simulator blindly</div>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-800">
              Reaction predictors routinely miss solvent effects, impurities, enzyme selectivity, stereochemistry, side reactions,
              yield, and real lab practicality. Use these tools to <span className="font-semibold">prioritize experiments — not to replace them.</span>
            </p>
          </div>
        </div>
      </div>

      <Panel title="Professional tools to hand off to" icon={Compass}>
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="blue" icon={FlaskConical}>Organic synthesis</Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ORGANIC_TOOLS.map((t) => <ToolCard key={t.name} tool={t} />)}
        </div>
        <div className="mb-2 mt-5 flex items-center gap-2">
          <Badge tone="green" icon={Dna}>Biochemical networks</Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {BIOCHEM_TOOLS.map((t) => <ToolCard key={t.name} tool={t} />)}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          Tip: export your shortlist from the Molecule Designer (Copy SMILES / CSV) and load it straight into RDKit, ASKCOS, or IBM RXN.
        </p>
      </Panel>
    </div>
  );
}
