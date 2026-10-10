/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Your bank vs. the human metabolome": profile the chemicals collected from
 * products, searches, and designs against HMDB to see which ones the body
 * itself makes or carries, and open any of them in the explorer.
 */

import React, { useState } from "react";
import { Beaker, ScanSearch, ArrowRight } from "lucide-react";
import { Panel, Button, Badge, ErrorNote } from "../../components/ui";
import { batchMetabolites } from "../../api/client";
import type { HmdbMetabolite } from "../../types";
import { useBank, setBankHmdb, BankChemical } from "../bank/store";

const BATCH = 10;

type Row = { status: "found"; data: HmdbMetabolite } | { status: "absent" } | { status: "error"; error: string };

export default function BankProfile({ onOpen }: { onOpen: (m: HmdbMetabolite) => void }) {
  const bank = useBank();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (bank.length === 0) return null;

  const pending = bank.filter((c) => !rows[c.id] || rows[c.id].status === "error");
  const queryFor = (c: BankChemical) => c.hmdb || c.name;

  const check = async () => {
    const chunk = pending.slice(0, BATCH);
    if (chunk.length === 0) return;
    setLoading(true); setError("");
    try {
      const { results } = await batchMetabolites(chunk.map(queryFor));
      const next: Record<string, Row> = {};
      chunk.forEach((c, i) => {
        const r = results[i];
        if (r?.success && r.data) {
          next[c.id] = { status: "found", data: r.data };
          setBankHmdb(c.id, r.data.accession);
        } else if (r && /unreachable/i.test(r.error || "")) {
          next[c.id] = { status: "error", error: r.error! };
        } else {
          next[c.id] = { status: "absent" };
        }
      });
      setRows((s) => ({ ...s, ...next }));
      if (Object.values(next).every((r) => r.status === "error")) setError("HMDB is unreachable right now, so the bank couldn't be profiled. Try again shortly.");
    } catch (e: any) {
      setError(e?.message || "Bank profile failed.");
    } finally {
      setLoading(false);
    }
  };

  const found = bank.filter((c) => rows[c.id]?.status === "found").length;
  const checked = bank.filter((c) => rows[c.id] && rows[c.id].status !== "error").length;

  return (
    <Panel
      title="Your bank vs. the human metabolome"
      icon={Beaker}
      actions={
        <Button variant="secondary" icon={ScanSearch} loading={loading} onClick={check} disabled={pending.length === 0}>
          {pending.length === 0 ? "All checked" : `Check ${Math.min(BATCH, pending.length)}${pending.length > BATCH ? ` of ${pending.length}` : ""}`}
        </Button>
      }
    >
      <p className="mb-3 text-[12px] text-slate-500">
        Which chemicals in your bank does the human body itself make or carry? {checked > 0 && <span className="font-medium text-slate-700">{found} of {checked} checked are human metabolites.</span>}
      </p>
      {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}
      <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
        {bank.map((c) => {
          const r = rows[c.id];
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">{c.name}</div>
                <div className="font-mono text-[11px] text-slate-400">{c.formula}{c.source ? <span className="ml-2 font-sans">· {c.source}</span> : null}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r?.status === "found" ? (
                  <>
                    <span className="hidden text-[11px] text-slate-400 sm:inline">
                      {r.data.biospecimens.length} biofluids · {r.data.pathways.length} pathways
                    </span>
                    <button onClick={() => onOpen(r.data)} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 cursor-pointer">
                      {r.data.accession} <ArrowRight className="h-3 w-3" />
                    </button>
                  </>
                ) : r?.status === "absent" ? (
                  <Badge tone="slate">not in HMDB</Badge>
                ) : r?.status === "error" ? (
                  <Badge tone="amber">retry</Badge>
                ) : c.hmdb ? (
                  <Badge tone="green">{c.hmdb}</Badge>
                ) : (
                  <span className="text-[11px] text-slate-300">unchecked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
