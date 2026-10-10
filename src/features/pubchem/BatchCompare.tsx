/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Box, Btn, Field, Tag, Note, Busy, Empty, LinkBtn, val } from "../../components/ui";
import { batchLookup } from "../../api/client";
import { setPendingCompound } from "../../store/handoff";
import { navigate } from "../../store/nav";
import { openMetabolite } from "../metabolites/actions";
import type { BatchResult } from "../../types";

const METRICS: { key: "mw" | "clogp" | "tpsa" | "hbd" | "hba" | "rotatable_bonds"; label: string }[] = [
  { key: "mw", label: "Mass" },
  { key: "clogp", label: "XLogP3" },
  { key: "tpsa", label: "TPSA" },
  { key: "hbd", label: "HBD" },
  { key: "hba", label: "HBA" },
  { key: "rotatable_bonds", label: "Rot." },
];

export default function BatchCompare() {
  const [text, setText] = useState("Aspirin, Ibuprofen, Paracetamol, Naproxen, Celecoxib");
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

  return (
    <div>
      <h2 className="title">Compare compounds</h2>
      <p className="lede">
        Looks up several compounds in one pass and tabulates PubChem's descriptors side by side.
        Up to ten compounds per query. Values are PubChem's own; none are computed here.
      </p>

      <Box title="Query">
        <Field label="Compounds" hint="Separate with commas or new lines.">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} style={{ width: "100%" }} />
        </Field>
        <Btn primary busy={loading} onClick={run} disabled={!text.trim()}>
          Compare
        </Btn>
      </Box>

      {error && <Note kind="err" title="Lookup failed">{error}</Note>}
      {loading && <Busy label="Querying PubChem…" />}

      {ok.length > 0 && (
        <Box title={`Comparison (${ok.length} compounds)`} flush>
          <div className="scroll-x">
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Compound</th>
                  <th scope="col">CID</th>
                  <th scope="col">Formula</th>
                  {METRICS.map((m) => (
                    <th scope="col" key={m.key} className="num">
                      {m.label}
                    </th>
                  ))}
                  <th scope="col">HMDB</th>
                </tr>
              </thead>
              <tbody>
                {ok.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <LinkBtn
                        onClick={() => {
                          setPendingCompound(String(r.data!.cid));
                          navigate("compounds");
                        }}
                      >
                        {r.data!.name}
                      </LinkBtn>
                    </td>
                    <td className="mono">{r.data!.cid}</td>
                    <td className="mono">{r.data!.formula}</td>
                    {METRICS.map((m) => (
                      <td key={m.key} className="num">
                        {val(r.data![m.key] as number | string | null)}
                      </td>
                    ))}
                    <td>
                      {r.data!.hmdbAccession ? (
                        <LinkBtn onClick={() => openMetabolite(r.data!.hmdbAccession!)}>
                          {r.data!.hmdbAccession}
                        </LinkBtn>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      )}

      {failed.length > 0 && (
        <Box title="Not resolved">
          {failed.map((f, i) => (
            <Tag key={i} tone="bad">
              {f.query}
            </Tag>
          ))}
        </Box>
      )}

      {ok.length === 0 && !loading && !error && (
        <Box>
          <Empty title="Nothing compared yet" hint="Enter a list of compounds and press Compare." />
        </Box>
      )}
    </div>
  );
}
