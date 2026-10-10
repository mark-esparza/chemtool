/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { Box, Btn, Field, Text, Note, Busy, Empty } from "../../components/ui";
import { searchMetabolite } from "../../api/client";
import type { HmdbMetabolite } from "../../types";
import { takePendingMetabolite } from "../../store/handoff";
import MetaboliteRecord from "./MetaboliteRecord";
import BankProfile from "./BankProfile";

export default function MetaboliteExplorer() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<HmdbMetabolite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const top = useRef<HTMLDivElement>(null);

  const run = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await searchMetabolite(q.trim()));
    } catch (e: any) {
      setError(e?.message || "Metabolite search failed.");
    } finally {
      setLoading(false);
    }
  };

  /** Show a record already retrieved (e.g. by the bank profile) without re-fetching. */
  const open = (m: HmdbMetabolite) => {
    setQuery(m.name);
    setError("");
    setResult(m);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const pending = takePendingMetabolite();
    if (pending) run(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={top}>
      <h2 className="title">Metabolite records</h2>
      <p className="lede">
        Retrieves any entry in the Human Metabolome Database by common name or HMDB accession —
        where the compound occurs in the body, reported normal concentrations, associated diseases,
        the pathways it participates in, the enzymes and transporters that act on it, and its
        identifiers in other databases. The whole database is in scope; nothing is restricted to a
        preselected list.
      </p>

      <Box title="Query">
        <div className="row">
          <div className="grow">
            <Field label="Metabolite" hint="Common name or HMDB accession (5- or 7-digit form).">
              <Text
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="Common name or HMDB accession"
                style={{ width: "100%" }}
              />
            </Field>
          </div>
          <Btn primary busy={loading} onClick={() => run()} disabled={!query.trim()}>
            Retrieve
          </Btn>
        </div>
      </Box>

      {error && <Note kind="err" title="Retrieval failed">{error}</Note>}
      {loading && !result && <Busy label="Querying HMDB…" />}

      {result && <MetaboliteRecord m={result} />}

      {!loading && !result && !error && (
        <Box>
          <Empty title="No metabolite loaded" hint="Enter a name or HMDB accession above." />
        </Box>
      )}

      <BankProfile onOpen={open} />
    </div>
  );
}
