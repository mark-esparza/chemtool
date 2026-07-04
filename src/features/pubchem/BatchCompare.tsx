/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Rows3, GitCompare } from "lucide-react";
import { Panel, Button, Field, Badge, Spinner, ErrorNote } from "../../components/ui";
import { batchLookup } from "../../api/client";
import type { BatchResult } from "../../types";

const METRICS: { key: "mw" | "clogp" | "tpsa" | "rotatable_bonds"; label: string }[] = [
  { key: "mw", label: "Molar mass" },
  { key: "clogp", label: "logP" },
  { key: "tpsa", label: "TPSA" },
  { key: "rotatable_bonds", label: "Rot. bonds" },
];

export default function BatchCompare() {
  const [text, setText] = useState("Aspirin, Caffeine, Ibuprofen, Paracetamol, Glucose");
  const [results, setResults] = useState<BatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    const queries = text.split(/[,\n]+/).map((q) => q.trim()).filter(Boolean);
    if (queries.length === 0) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const { results } = await batchLookup(queries);
      setResults(results);
      if (!results.some((r) => r.success)) setError("None of those compounds could be resolved on PubChem.");
    } catch (e: any) {
      setError(e?.message || "Batch lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const ok = results.filter((r) => r.success && r.data);
  const failed = results.filter((r) => !r.success);
  const fmt = (v: number | string | null | undefined) => (v === null || v === undefined ? "—" : v);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <GitCompare className="h-5 w-5 text-[#0A355C]" /> Compare Compounds
        </h1>
        <p className="mt-1 text-sm text-slate-500">Look up several compounds at once and compare their properties side by side.</p>
      </div>

      <Panel>
        <Field label="Compounds (separate with commas or new lines)">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-[#0A355C] focus:ring-2 focus:ring-[#0A355C]/10"
          />
        </Field>
        <div className="mt-3">
          <Button icon={Rows3} loading={loading} onClick={run} disabled={!text.trim()}>
            Compare
          </Button>
        </div>
      </Panel>

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && <Spinner label="Looking up compounds…" />}

      {ok.length > 0 && (
        <Panel title="Comparison" icon={GitCompare} padded={false} className="animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Compound</th>
                  <th className="px-4 py-2 font-medium">Formula</th>
                  {METRICS.map((m) => (
                    <th key={m.key} className="px-4 py-2 text-right font-medium">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ok.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-800">{r.data!.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[#0A355C]">{r.data!.formula}</td>
                    {METRICS.map((m) => (
                      <td key={m.key} className="px-4 py-2 text-right font-mono text-slate-700">{fmt(r.data![m.key] as any)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {failed.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {failed.map((f, i) => (
            <Badge key={i} tone="rose">Not found: {f.query}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
