/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Search, ExternalLink, Dna, Plus, Check, FlaskConical } from "lucide-react";
import { Panel, Button, TextInput, Badge, Chip, Spinner, ErrorNote, StatTile, EmptyState } from "../../components/ui";
import { searchCompound } from "../../api/client";
import { takePendingCompound, setPendingReactants } from "../../store/handoff";
import { navigate } from "../../store/nav";
import { useBank, addToBank } from "../bank/store";
import { openMetabolite } from "../metabolites/actions";
import type { PubChemCompound } from "../../types";

const EXAMPLES = ["Aspirin", "Caffeine", "Glucose", "Ethanol", "Meloxicam", "Benzene"];

export default function CompoundSearch() {
  const [query, setQuery] = useState("Aspirin");
  const [result, setResult] = useState<PubChemCompound | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bank = useBank();
  const banked = !!result && bank.some((c) => c.cid === result.cid);

  const bankIt = () => {
    if (!result?.formula) return;
    addToBank({
      id: String(result.cid), name: result.name, formula: result.formula, smiles: result.smiles || undefined,
      cid: result.cid, mw: result.mw, source: "Compound Search", hmdb: result.hmdbAccession || undefined,
    });
  };

  const run = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await searchCompound(q.trim()));
    } catch (e: any) {
      setError(e?.message || "Compound search failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If a compound was sent over from the bank, look it up.
    const pending = takePendingCompound();
    if (pending) {
      setQuery(pending);
      run(pending);
    } else {
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const num = (v: number | null) => (v === null || v === undefined ? "—" : v);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Search className="h-5 w-5 text-[#0A355C]" /> Compound Search
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Look up any chemical in the live NIH PubChem database — by name, formula, SMILES, or CID. Misspellings are auto-corrected.
        </p>
      </div>

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Search any chemical — e.g. Meloxicam, C6H6, NaCl, 2244…"
            className="flex-1"
          />
          <Button icon={Search} loading={loading} onClick={() => run()} disabled={!query.trim()}>
            Search
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-400">Try:</span>
          {EXAMPLES.map((e) => (
            <Chip key={e} onClick={() => { setQuery(e); run(e); }}>{e}</Chip>
          ))}
        </div>
      </Panel>

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !result && <Spinner label="Searching PubChem…" />}

      {result && (
        <Panel className="animate-fadeIn">
          <div className="flex flex-col gap-5 md:flex-row">
            {/* Structure */}
            <div className="flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-3 md:w-56">
              <img
                src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${result.cid}/PNG`}
                alt={`${result.name} structure`}
                className="max-h-44 max-w-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-bold text-slate-800">{result.name}</h2>
                    <Badge tone="blue">CID {result.cid}</Badge>
                    {result.hmdbAccession && <Badge tone="green" icon={Dna}>Human metabolite</Badge>}
                  </div>
                  {result.iupac_name && <p className="mt-0.5 break-words text-xs text-slate-500">{result.iupac_name}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] text-slate-400">Formula</div>
                  <div className="font-mono text-sm font-bold text-[#0A355C]">{result.formula}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <StatTile label="Molar mass" value={result.mw} unit="g/mol" />
                <StatTile label="logP" value={num(result.clogp)} />
                <StatTile label="TPSA" value={num(result.tpsa)} unit="Å²" />
                <StatTile label="H-bond donors" value={num(result.hbd)} />
                <StatTile label="H-bond acceptors" value={num(result.hba)} />
                <StatTile label="Rotatable bonds" value={num(result.rotatable_bonds)} />
              </div>

              {result.smiles && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className="text-[11px] text-slate-400">SMILES</div>
                  <code className="block break-all font-mono text-xs text-slate-700">{result.smiles}</code>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant={banked ? "secondary" : "primary"} icon={banked ? Check : Plus} onClick={bankIt} disabled={!result.formula || banked}>
                  {banked ? "In bank" : "Add to bank"}
                </Button>
                {result.formula && (
                  <Button variant="secondary" icon={FlaskConical} onClick={() => { setPendingReactants([result.formula]); navigate("reactions"); }}>React</Button>
                )}
                {result.hmdbAccession && (
                  <Button variant="secondary" icon={Dna} onClick={() => openMetabolite(result.hmdbAccession!)}>
                    Body chemistry ({result.hmdbAccession})
                  </Button>
                )}
              </div>
            </div>
          </div>

          {result.description && result.description !== "No description available in PubChem." && (
            <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">
              {result.description}
              {result.descriptionSource && <span className="ml-1 text-xs text-slate-400">— {result.descriptionSource}</span>}
            </p>
          )}

          {result.synonyms?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.synonyms.slice(0, 8).map((s, i) => (
                <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{s}</span>
              ))}
            </div>
          )}

          <a
            href={result.reportUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#0A355C] hover:underline"
          >
            View full PubChem record <ExternalLink className="h-3 w-3" />
          </a>
        </Panel>
      )}

      {!loading && !result && !error && (
        <Panel>
          <EmptyState icon={Search} title="Search for a compound" hint="Names, formulas, SMILES, or CIDs all work." />
        </Panel>
      )}
    </div>
  );
}
