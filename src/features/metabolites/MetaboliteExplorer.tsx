/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Dna } from "lucide-react";
import { Panel, Button, TextInput, Chip, Spinner, ErrorNote, EmptyState } from "../../components/ui";
import { searchMetabolite } from "../../api/client";
import type { HmdbMetabolite } from "../../types";
import { takePendingMetabolite } from "../../store/handoff";
import MetaboliteRecord from "./MetaboliteRecord";
import BankProfile from "./BankProfile";

const EXAMPLES = ["Glucose", "Dopamine", "Cholesterol", "Lactic acid", "Urea", "Caffeine"];

export default function MetaboliteExplorer() {
  const [query, setQuery] = useState("Glucose");
  const [result, setResult] = useState<HmdbMetabolite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const top = useRef<HTMLDivElement>(null);

  const run = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      setResult(await searchMetabolite(q.trim()));
    } catch (e: any) {
      setError(e?.message || "Metabolite search failed.");
    } finally {
      setLoading(false);
    }
  };

  /** Show a record we already have (e.g. from the bank profile) without re-fetching. */
  const open = (m: HmdbMetabolite) => {
    setQuery(m.name); setError(""); setResult(m);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    // A chemical sent over from another feature (Compound Search, the bank, Compare…).
    const pending = takePendingMetabolite();
    if (pending) {
      setQuery(pending);
      run(pending);
    } else {
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={top} className="mx-auto max-w-4xl scroll-mt-6 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Dna className="h-5 w-5 text-[#0A355C]" /> Metabolites
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Explore human metabolites from the HMDB — where they occur in the body, normal concentrations, linked diseases, pathways, and the enzymes that act on them — then take them into reactions, the designer, or your notebook.
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

      {result && <MetaboliteRecord m={result} />}

      {!loading && !result && !error && (
        <Panel><EmptyState icon={Dna} title="Search a metabolite" hint="Common names or HMDB IDs both work." /></Panel>
      )}

      <BankProfile onOpen={open} />
    </div>
  );
}
