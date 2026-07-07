/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { FlaskConical, Zap, Scale, Flame, Atom, ShieldAlert, AlertTriangle, FileText, Thermometer, Gauge, Shapes, ArrowRight } from "lucide-react";
import { Panel, Button, Field, TextInput, Badge, Chip, Spinner, ErrorNote } from "../../components/ui";
import { Markdown } from "../../components/ui/Markdown";
import { simulateReaction } from "../../api/client";
import { takePendingReactants } from "../../store/handoff";
import { estimateEfficacy, Concentration } from "./efficacy";
import type { ReactionResult, ReactionSpecies } from "../../types";

/** 2D structure image for a species, resolved live from PubChem by formula/name. */
const structureUrl = (formula: string) => `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(formula)}/PNG?image_size=180x180`;

function SpeciesCard({ s }: { s: ReactionSpecies }) {
  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-1">
      <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-slate-200 bg-white p-1">
        <img src={structureUrl(s.formula)} alt={s.formula} className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
      </div>
      <div className="text-center leading-tight">
        <div className="font-mono text-xs font-semibold text-slate-700">{s.coefficient > 1 ? <span className="text-slate-400">{s.coefficient} </span> : null}{s.formula}</div>
        {s.state && <div className="text-[10px] italic text-slate-400">({s.state})</div>}
      </div>
    </div>
  );
}

function Meter({ label, pct, sub, tone }: { label: string; pct: number; sub: string; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-700">{sub}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const PRESETS = [
  { title: "Methane combustion", input: "CH4 + O2", conditions: "Ignition, excess O₂" },
  { title: "Zinc + acid", input: "Zn + HCl", conditions: "" },
  { title: "Neutralization", input: "HCl + NaOH", conditions: "" },
  { title: "Silver chloride precipitate", input: "AgNO3 + NaCl", conditions: "Aqueous solution" },
  { title: "Thermite", input: "Al + Fe2O3", conditions: "High-heat ignition" },
  { title: "Decomposition", input: "KClO3", conditions: "Heat, MnO₂ catalyst" },
];

export default function ReactionSimulator() {
  const [input, setInput] = useState("CH4 + O2");
  const [conditions, setConditions] = useState("");
  const [result, setResult] = useState<ReactionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [safety, setSafety] = useState("");

  // Condition-optimization controls (what-if analysis on the predicted reaction)
  const [tempC, setTempC] = useState(25);
  const [concentration, setConcentration] = useState<Concentration>("normal");
  const [catalyst, setCatalyst] = useState(false);
  const efficacy = useMemo(
    () => estimateEfficacy(result?.energetics?.character, { tempC, concentration, catalyst }),
    [result, tempC, concentration, catalyst]
  );

  const run = async (rx = input, cond = conditions) => {
    if (!rx.trim()) return;
    setLoading(true);
    setError("");
    setSafety("");
    setResult(null);
    const reactants = rx.split(/[,+]/).map((r) => r.trim()).filter(Boolean);
    try {
      setResult(await simulateReaction(reactants, cond));
    } catch (e: any) {
      if (e?.status === 403 && e?.body?.safety_tripped) setSafety(e.body.error);
      else setError(e?.message || "Reaction simulation failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If chemicals were sent over from the bank, prefill and run them.
    const pending = takePendingReactants();
    if (pending && pending.length > 0) {
      const rx = pending.join(" + ");
      setInput(rx);
      run(rx, "");
    } else {
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const energyColor = (c?: string) =>
    c === "Exothermic" ? "text-orange-600" : c === "Endothermic" ? "text-sky-600" : "text-slate-600";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <FlaskConical className="h-5 w-5 text-[#0A355C]" /> Reaction Simulator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter reactants by <span className="font-medium text-slate-600">name, formula, or SMILES</span> — we predict the products, balance the equation, and explain what happens.
        </p>
      </div>

      <Panel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-6">
            <Field label="Reactants (separate with + or ,)">
              <TextInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="e.g. methane + oxygen · HCl + NaOH · vinegar + baking soda · CC(=O)O + NaHCO3"
                className="font-mono"
              />
            </Field>
          </div>
          <div className="md:col-span-4">
            <Field label="Conditions (optional)">
              <TextInput
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="heat, catalyst, aqueous…"
              />
            </Field>
          </div>
          <div className="flex items-end md:col-span-2">
            <Button icon={Zap} loading={loading} onClick={() => run()} disabled={!input.trim()} className="w-full">
              Predict
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Chip key={p.title} onClick={() => { setInput(p.input); setConditions(p.conditions); run(p.input, p.conditions); }}>
              {p.title}
            </Chip>
          ))}
        </div>
      </Panel>

      {error && <ErrorNote>{error}</ErrorNote>}
      {safety && (
        <Panel className="border-rose-200">
          <div className="flex gap-3">
            <ShieldAlert className="h-6 w-6 shrink-0 text-rose-600" />
            <div>
              <div className="text-sm font-semibold text-rose-900">Safety boundary tripped</div>
              <p className="mt-1 text-sm text-rose-800">{safety}</p>
            </div>
          </div>
        </Panel>
      )}

      {loading && !result && <Spinner label="Predicting, balancing, computing molar masses…" />}

      {result && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            {/* Equation */}
            <Panel
              title="Balanced equation"
              icon={Scale}
              actions={
                result.reaction_occurs ? (
                  <Badge tone={result.balanced ? "green" : "amber"}>{result.balanced ? "✓ Balanced" : "⚠ Not balanced"}</Badge>
                ) : undefined
              }
            >
              {(() => {
                const named = (result.resolved_reactants || []).filter((r) => r.source === "alias" || r.source === "pubchem" || r.source === "smiles");
                if (named.length === 0) return null;
                return (
                  <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Read as: {named.map((r, i) => (
                      <span key={i}>
                        {i > 0 && ", "}
                        <span className="text-slate-600">{r.input}</span> → <span className="font-mono font-medium text-[#0A355C]">{r.formula}</span>
                      </span>
                    ))}
                  </div>
                );
              })()}
              {result.assumed_combustion && (
                <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <Flame className="h-3.5 w-3.5 shrink-0" />
                  A single fuel was entered, so we assumed <span className="font-medium">combustion in air</span> and added O₂.
                </div>
              )}
              {result.reaction_occurs ? (
                <>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                    <code className="break-words font-mono text-lg font-bold text-[#0A355C]">{result.equation}</code>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone="blue" icon={Atom}>{result.reaction_type}</Badge>
                    {result.conditions && <Badge tone="slate">{result.conditions}</Badge>}
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <p className="text-sm italic text-slate-600">
                    {result.reason || "No reaction is predicted between these reactants under the given conditions."}
                  </p>
                </div>
              )}
            </Panel>

            {/* Structure diagram */}
            {result.reaction_occurs && result.species?.length > 0 && (
              <Panel title="Structures — how they interact" icon={Shapes}>
                <div className="flex flex-wrap items-center gap-3 overflow-x-auto">
                  <div className="flex flex-wrap items-center gap-2">
                    {result.species.filter((s) => s.role === "reactant").map((s, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="font-bold text-slate-300">+</span>}
                        <SpeciesCard s={s} />
                      </React.Fragment>
                    ))}
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#0A355C]" />
                  <div className="flex flex-wrap items-center gap-2">
                    {result.species.filter((s) => s.role === "product").map((s, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="font-bold text-slate-300">+</span>}
                        <SpeciesCard s={s} />
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">2D structures fetched live from PubChem; some ionic or complex species may not render.</p>
              </Panel>
            )}

            {/* Optimize conditions */}
            {result.reaction_occurs && (
              <Panel title="Optimize conditions" icon={Gauge}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Thermometer className="h-3.5 w-3.5" /> Temperature</span>
                      <span className="font-mono font-semibold text-slate-700">{tempC} °C</span>
                    </div>
                    <input type="range" min={0} max={300} step={5} value={tempC} onChange={(e) => setTempC(+e.target.value)} className="mt-2 w-full accent-[#0A355C]" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Concentration</div>
                    <div className="mt-2 flex gap-1">
                      {(["low", "normal", "high"] as Concentration[]).map((v) => (
                        <button key={v} onClick={() => setConcentration(v)} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer ${concentration === v ? "border-[#0A355C] bg-[#0A355C]/10 text-[#0A355C]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Catalyst</div>
                    <button onClick={() => setCatalyst((v) => !v)} className={`mt-2 w-full rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer ${catalyst ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{catalyst ? "Catalyst added" : "No catalyst"}</button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Efficacy</div>
                    <div className={`text-2xl font-bold ${efficacy.score >= 65 ? "text-emerald-600" : efficacy.score >= 40 ? "text-amber-600" : "text-slate-500"}`}>{efficacy.score}</div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Meter label="Rate" pct={efficacy.ratePct} sub={efficacy.rateLabel} tone="bg-[#0A355C]" />
                    <Meter label="Equilibrium" pct={efficacy.yieldPct} sub={efficacy.yieldLabel} tone="bg-emerald-500" />
                  </div>
                </div>

                <ul className="mt-3 space-y-1">
                  {efficacy.tips.map((t, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-slate-600"><span className="text-[#0A355C]">→</span>{t}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-slate-400">Educational estimate from thermal character + conditions (Arrhenius / Le Chatelier intuition) — not rigorous kinetics.</p>
              </Panel>
            )}

            {/* Energetics */}
            {result.reaction_occurs && result.energetics && (
              <Panel title="Energetics" icon={Flame}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] text-slate-500">Thermal character</div>
                    <div className={`text-lg font-semibold ${energyColor(result.energetics.character)}`}>{result.energetics.character}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Estimated ΔH</div>
                    <div className="font-mono text-lg font-semibold text-slate-800">{result.energetics.estimatedDeltaH} kJ/mol</div>
                  </div>
                </div>
                <p className="mt-2 text-xs italic text-slate-500">{result.energetics.note}</p>
              </Panel>
            )}

            {/* Species */}
            {result.reaction_occurs && result.species?.length > 0 && (
              <Panel title="Species & molar masses" icon={Atom} padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2 font-medium">#</th>
                        <th className="px-4 py-2 font-medium">Formula</th>
                        <th className="px-4 py-2 font-medium">Role</th>
                        <th className="px-4 py-2 font-medium">State</th>
                        <th className="px-4 py-2 text-right font-medium">Molar mass</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {result.species.map((s, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2 text-slate-400">{s.coefficient}</td>
                          <td className="px-4 py-2 font-semibold text-[#0A355C]">{s.formula}</td>
                          <td className="px-4 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-[11px] ${s.role === "reactant" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>
                              {s.role}
                            </span>
                          </td>
                          <td className="px-4 py-2 italic text-slate-500">{s.state ? `(${s.state})` : "—"}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-800">
                            {s.molarMass !== null ? `${s.molarMass.toFixed(2)} g/mol` : "n/a"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
          </div>

          {/* Report */}
          <div className="lg:col-span-2">
            <Panel title="Analysis report" icon={FileText}>
              <div className="max-h-[70vh] overflow-y-auto pr-1">
                <Markdown text={result.report} />
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
