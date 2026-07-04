/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { PackageSearch, Plus, Check, Loader2, X, FlaskConical, Search as SearchIcon, Beaker, Trash2, ExternalLink } from "lucide-react";
import { Panel, Button, TextInput, Badge, Chip, Spinner, ErrorNote, EmptyState } from "../../components/ui";
import { searchProduct, searchCompound } from "../../api/client";
import type { ProductBreakdown as Breakdown } from "../../types";
import { useBank, addToBank, removeFromBank, clearBank, BankChemical } from "../bank/store";
import { setPendingReactants, setPendingCompound } from "../../store/handoff";
import { navigate } from "../../store/nav";

const EXAMPLES = ["Coca-Cola", "Nutella", "Colgate toothpaste", "Advil", "Windex", "Oreo"];

type Status = "idle" | "resolving" | "added" | "notfound";

export default function ProductBreakdown() {
  const [query, setQuery] = useState("Coca-Cola");
  const [result, setResult] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [addingAll, setAddingAll] = useState(false);

  const bank = useBank();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const run = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true); setError(""); setResult(null); setStatus({});
    try {
      setResult(await searchProduct(q.trim()));
    } catch (e: any) {
      setError(e?.message || "Product search failed.");
    } finally {
      setLoading(false);
    }
  };

  const addIngredient = async (name: string): Promise<boolean> => {
    setStatus((s) => ({ ...s, [name]: "resolving" }));
    try {
      const c = await searchCompound(name);
      const chem: BankChemical = {
        id: c.cid ? String(c.cid) : name.toLowerCase(),
        name: c.name || name,
        formula: c.formula,
        smiles: c.smiles,
        cid: c.cid,
        mw: c.mw,
        source: result?.product.name,
      };
      addToBank(chem);
      setStatus((s) => ({ ...s, [name]: "added" }));
      return true;
    } catch {
      setStatus((s) => ({ ...s, [name]: "notfound" }));
      return false;
    }
  };

  const addAll = async () => {
    if (!result) return;
    setAddingAll(true);
    for (const ing of result.ingredients) {
      if (status[ing.name] === "added") continue;
      // Sequential to be gentle on the PubChem API.
      // eslint-disable-next-line no-await-in-loop
      await addIngredient(ing.name);
    }
    setAddingAll(false);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const runReaction = () => {
    const formulas = bank.filter((c) => selected.has(c.id) && c.formula).map((c) => c.formula);
    if (formulas.length === 0) return;
    setPendingReactants(formulas);
    navigate("reactions");
  };

  const analyze = (c: BankChemical) => {
    setPendingCompound(c.cid ? String(c.cid) : c.name);
    navigate("search");
  };

  const selectedCount = bank.filter((c) => selected.has(c.id)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <PackageSearch className="h-5 w-5 text-[#0A355C]" /> Product Breakdown
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Search any consumer product to break it into its ingredients, add the chemicals to your bank, then analyze them or run reactions.
        </p>
      </div>

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Search a product — e.g. Coca-Cola, Nutella, Windex, Advil…"
            className="flex-1"
          />
          <Button icon={PackageSearch} loading={loading} onClick={() => run()} disabled={!query.trim()}>Break down</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-400">Try:</span>
          {EXAMPLES.map((e) => <Chip key={e} onClick={() => { setQuery(e); run(e); }}>{e}</Chip>)}
        </div>
      </Panel>

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !result && <Spinner label="Searching product databases…" />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Product + ingredients */}
        <div className="space-y-6 lg:col-span-3">
          {result && (
            <Panel className="animate-fadeIn">
              <div className="flex items-start gap-4">
                {result.product.image && (
                  <img src={result.product.image} alt={result.product.name} className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-contain p-1" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold text-slate-800">{result.product.name}</h2>
                  {result.product.brand && <div className="text-sm text-slate-500">{result.product.brand}</div>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="blue">{result.ingredients.length} ingredients</Badge>
                    <Badge tone="slate">{result.product.category}</Badge>
                  </div>
                </div>
                <Button variant="secondary" loading={addingAll} onClick={addAll} icon={Plus}>Add all</Button>
              </div>

              <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {result.ingredients.map((ing) => {
                  const st = status[ing.name] || "idle";
                  return (
                    <div key={ing.name} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <span className="text-sm text-slate-700">{ing.name}</span>
                        {ing.percent != null && <span className="ml-2 text-xs text-slate-400">{ing.percent}%</span>}
                      </div>
                      {st === "added" ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><Check className="h-3.5 w-3.5" /> Added</span>
                      ) : st === "resolving" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      ) : st === "notfound" ? (
                        <span className="text-xs text-slate-400">not on PubChem</span>
                      ) : (
                        <button onClick={() => addIngredient(ing.name)} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
                          <Plus className="h-3 w-3" /> Bank
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <a href={result.product.url} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#0A355C] hover:underline">
                Source: {result.product.source} <ExternalLink className="h-3 w-3" />
              </a>
            </Panel>
          )}
          {!result && !loading && !error && (
            <Panel><EmptyState icon={PackageSearch} title="Search a product to break it down" hint="Foods, drinks, cosmetics, and household products all work." /></Panel>
          )}
        </div>

        {/* Chemical bank */}
        <div className="lg:col-span-2">
          <Panel
            title={`Chemical Bank (${bank.length})`}
            icon={Beaker}
            actions={bank.length > 0 ? <button onClick={() => { clearBank(); setSelected(new Set()); }} className="text-xs text-slate-400 hover:text-rose-600 cursor-pointer">Clear</button> : undefined}
            className="lg:sticky lg:top-4"
          >
            {bank.length === 0 ? (
              <EmptyState icon={Beaker} title="Your bank is empty" hint="Add ingredients from a product to collect chemicals here." />
            ) : (
              <>
                <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
                  {bank.map((c) => (
                    <div key={c.id} className={`flex items-center gap-2 rounded-lg border p-2 ${selected.has(c.id) ? "border-[#0A355C] bg-[#0A355C]/5" : "border-slate-200"}`}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 accent-[#0A355C]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">{c.name}</div>
                        <div className="font-mono text-[11px] text-slate-400">{c.formula}</div>
                      </div>
                      <button onClick={() => analyze(c)} title="Analyze in Compound Search" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0A355C] cursor-pointer"><SearchIcon className="h-3.5 w-3.5" /></button>
                      <button onClick={() => removeFromBank(c.id)} title="Remove" className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <Button icon={FlaskConical} onClick={runReaction} disabled={selectedCount < 1} className="w-full">
                    Run reaction {selectedCount > 0 ? `(${selectedCount} selected)` : ""}
                  </Button>
                  <p className="mt-1.5 text-center text-[11px] text-slate-400">Select 2+ chemicals to react them together.</p>
                </div>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
