/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Checks the chemicals collected in the bank against HMDB, to see which of them
 * the human body also produces or carries.
 */

import React, { useState } from "react";
import { Box, Btn, Tag, Note, LinkBtn } from "../../components/ui";
import { batchMetabolites } from "../../api/client";
import type { HmdbMetabolite } from "../../types";
import { useBank, setBankHmdb, removeFromBank, clearBank, BankChemical } from "../bank/store";

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
    setLoading(true);
    setError("");
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
      if (Object.values(next).every((r) => r.status === "error")) {
        setError("HMDB is unreachable right now, so the bank could not be checked. Try again shortly.");
      }
    } catch (e: any) {
      setError(e?.message || "Bank check failed.");
    } finally {
      setLoading(false);
    }
  };

  const found = bank.filter((c) => rows[c.id]?.status === "found").length;
  const checked = bank.filter((c) => rows[c.id] && rows[c.id].status !== "error").length;

  return (
    <Box
      title={`Chemical bank (${bank.length}) checked against HMDB`}
      actions={<LinkBtn onClick={() => clearBank()}>empty bank</LinkBtn>}
      flush
    >
      <div style={{ padding: "6px 8px" }}>
        <p className="small muted" style={{ marginBottom: 6 }}>
          Which of the chemicals you have collected are also recorded human metabolites?
          {checked > 0 && ` ${found} of ${checked} checked so far are in HMDB.`}
        </p>
        {error && <Note kind="err">{error}</Note>}
        <Btn busy={loading} onClick={check} disabled={pending.length === 0}>
          {pending.length === 0
            ? "All checked"
            : `Check ${Math.min(BATCH, pending.length)}${pending.length > BATCH ? ` of ${pending.length}` : ""}`}
        </Btn>
      </div>
      <div className="scroll-x">
        <table className="grid">
          <thead>
            <tr>
              <th scope="col">Chemical</th>
              <th scope="col">Formula</th>
              <th scope="col">Added from</th>
              <th scope="col">HMDB</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {bank.map((c) => {
              const r = rows[c.id];
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="mono">{c.formula || "—"}</td>
                  <td className="small muted">{c.source || "—"}</td>
                  <td>
                    {r?.status === "found" ? (
                      <>
                        <LinkBtn onClick={() => onOpen(r.data)}>{r.data.accession}</LinkBtn>
                        <span className="small muted">
                          {" "}
                          ({r.data.biospecimens.length} biofluids, {r.data.pathways.length} pathways)
                        </span>
                      </>
                    ) : r?.status === "absent" ? (
                      <span className="muted small">not in HMDB</span>
                    ) : r?.status === "error" ? (
                      <Tag tone="bad">retry</Tag>
                    ) : c.hmdb ? (
                      <Tag tone="ok">{c.hmdb}</Tag>
                    ) : (
                      <span className="muted small">unchecked</span>
                    )}
                  </td>
                  <td>
                    <LinkBtn onClick={() => removeFromBank(c.id)}>remove</LinkBtn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Box>
  );
}
