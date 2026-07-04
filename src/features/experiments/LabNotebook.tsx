/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { NotebookPen, Plus, Trash2 } from "lucide-react";
import { Panel, Button, Field, TextInput, Badge, EmptyState } from "../../components/ui";
import { useExperiments, addExperiment, removeExperiment } from "./store";
import type { ExperimentOutcome } from "../../types";

const OUTCOMES: { value: ExperimentOutcome; label: string; tone: "green" | "amber" | "rose" | "slate" }[] = [
  { value: "success", label: "Success", tone: "green" },
  { value: "partial", label: "Partial", tone: "amber" },
  { value: "failed", label: "Failed", tone: "rose" },
  { value: "toxic", label: "Toxic", tone: "rose" },
];

const toneFor = (o: ExperimentOutcome) => OUTCOMES.find((x) => x.value === o)?.tone || "slate";

export default function LabNotebook() {
  const experiments = useExperiments();
  const [name, setName] = useState("");
  const [smiles, setSmiles] = useState("");
  const [assay, setAssay] = useState("");
  const [resultValue, setResultValue] = useState("");
  const [outcome, setOutcome] = useState<ExperimentOutcome>("success");
  const [notes, setNotes] = useState("");

  const save = () => {
    if (!name.trim()) return;
    addExperiment({ name: name.trim(), smiles: smiles.trim(), assay: assay.trim() || "General assay", resultValue: resultValue.trim(), outcome, notes: notes.trim() });
    setName(""); setSmiles(""); setAssay(""); setResultValue(""); setNotes(""); setOutcome("success");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <NotebookPen className="h-5 w-5 text-[#0A355C]" /> Lab Notebook
        </h1>
        <p className="mt-1 text-sm text-slate-500">Record experiment outcomes. Reactions and designs can be logged here with one click.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Add form */}
        <div className="lg:col-span-2">
          <Panel title="Log an entry" icon={Plus}>
            <div className="space-y-3">
              <Field label="Name / title"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 5-Methyl aspirin analog" /></Field>
              <Field label="SMILES (optional)"><TextInput value={smiles} onChange={(e) => setSmiles(e.target.value)} className="font-mono" /></Field>
              <Field label="Assay"><TextInput value={assay} onChange={(e) => setAssay(e.target.value)} placeholder="e.g. Solubility screen" /></Field>
              <Field label="Result"><TextInput value={resultValue} onChange={(e) => setResultValue(e.target.value)} placeholder="e.g. 4.2 mg/mL" /></Field>
              <Field label="Outcome">
                <div className="flex flex-wrap gap-1.5">
                  {OUTCOMES.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setOutcome(o.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        outcome === o.value ? "border-[#0A355C] bg-[#0A355C]/10 text-[#0A355C]" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Notes">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-[#0A355C] focus:ring-2 focus:ring-[#0A355C]/10" />
              </Field>
              <Button icon={Plus} onClick={save} disabled={!name.trim()} className="w-full">Save entry</Button>
            </div>
          </Panel>
        </div>

        {/* Entries */}
        <div className="space-y-3 lg:col-span-3">
          {experiments.length === 0 ? (
            <Panel><EmptyState icon={NotebookPen} title="No entries yet" hint="Log an experiment or send one over from a reaction or design." /></Panel>
          ) : (
            experiments.map((exp) => (
              <Panel key={exp.id} className="animate-fadeIn">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-800">{exp.name}</h3>
                      <Badge tone={toneFor(exp.outcome)}>{exp.outcome}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">{exp.assay}{exp.resultValue ? ` · ${exp.resultValue}` : ""}</div>
                  </div>
                  <button onClick={() => removeExperiment(exp.id)} className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {exp.smiles && <code className="mt-2 block break-all rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">{exp.smiles}</code>}
                {exp.notes && <p className="mt-2 text-sm leading-relaxed text-slate-600">{exp.notes}</p>}
              </Panel>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
