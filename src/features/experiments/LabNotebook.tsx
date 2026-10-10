/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A local record of what was looked up and what the user concluded. Entries are
 * the user's own: nothing is written here automatically, and the list starts
 * empty rather than seeded with an example result.
 */

import React, { useEffect, useState } from "react";
import { Box, Btn, Field, Text, Tag, Note, Empty, LinkBtn } from "../../components/ui";
import { useExperiments, addExperiment, removeExperiment } from "./store";
import { takePendingNotebookDraft } from "../../store/handoff";
import type { ExperimentOutcome } from "../../types";

const OUTCOMES: { value: ExperimentOutcome; label: string }[] = [
  { value: "success", label: "Supported" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Not supported" },
  { value: "toxic", label: "Flagged" },
];

const toneFor = (o: ExperimentOutcome): "ok" | "warn" | "bad" =>
  o === "success" ? "ok" : o === "partial" ? "warn" : "bad";

function toCsv(rows: ReturnType<typeof useExperiments>): string {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["created_at", "name", "smiles", "assay", "result", "outcome", "notes"];
  return [
    head.join(","),
    ...rows.map((e) => [q(e.createdAt), q(e.name), q(e.smiles), q(e.assay), q(e.resultValue), q(e.outcome), q(e.notes)].join(",")),
  ].join("\n");
}

export default function LabNotebook() {
  const experiments = useExperiments();
  const [name, setName] = useState("");
  const [smiles, setSmiles] = useState("");
  const [assay, setAssay] = useState("");
  const [resultValue, setResultValue] = useState("");
  const [outcome, setOutcome] = useState<ExperimentOutcome>("success");
  const [notes, setNotes] = useState("");
  const [draftFrom, setDraftFrom] = useState("");

  useEffect(() => {
    const d = takePendingNotebookDraft();
    if (d) {
      setName(d.name);
      setSmiles(d.smiles || "");
      setAssay(d.assay || "");
      setResultValue(d.resultValue || "");
      setNotes(d.notes || "");
      setDraftFrom(d.source || "another page");
    }
  }, []);

  const reset = () => {
    setName("");
    setSmiles("");
    setAssay("");
    setResultValue("");
    setNotes("");
    setOutcome("success");
    setDraftFrom("");
  };

  const save = () => {
    if (!name.trim()) return;
    addExperiment({
      name: name.trim(),
      smiles: smiles.trim(),
      assay: assay.trim() || "Unspecified",
      resultValue: resultValue.trim(),
      outcome,
      notes: notes.trim(),
    });
    reset();
  };

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(experiments)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "chemtool-notebook.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 className="title">Notebook</h2>
      <p className="lede">
        Your own record of queries run and conclusions drawn. Entries are stored in this browser
        only — they are not uploaded anywhere, and clearing site data removes them. Export to CSV to
        keep a copy.
      </p>

      <div className="cols">
        <div className="col" style={{ flex: "1 1 280px" }}>
          <Box title="Add entry">
            {draftFrom && (
              <Note kind="info" title={`Prefilled from ${draftFrom}`}>
                Review it, choose an outcome, then save. <LinkBtn onClick={reset}>Discard</LinkBtn>
              </Note>
            )}
            <Field label="Title">
              <Text value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
            </Field>
            <Field label="Structure (SMILES, optional)">
              <Text className="mono" value={smiles} onChange={(e) => setSmiles(e.target.value)} style={{ width: "100%" }} />
            </Field>
            <Field label="Method or query">
              <Text value={assay} onChange={(e) => setAssay(e.target.value)} placeholder="e.g. PubChem similarity, threshold 90%" style={{ width: "100%" }} />
            </Field>
            <Field label="Result">
              <Text value={resultValue} onChange={(e) => setResultValue(e.target.value)} style={{ width: "100%" }} />
            </Field>
            <Field label="Outcome">
              <select value={outcome} onChange={(e) => setOutcome(e.target.value as ExperimentOutcome)}>
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={{ width: "100%" }} />
            </Field>
            <Btn primary onClick={save} disabled={!name.trim()}>
              Save entry
            </Btn>
          </Box>
        </div>

        <div className="col" style={{ flex: "2 1 380px" }}>
          <Box
            title={`Entries (${experiments.length})`}
            actions={experiments.length > 0 ? <LinkBtn onClick={exportCsv}>export CSV</LinkBtn> : null}
            flush
          >
            {experiments.length === 0 ? (
              <Empty title="No entries" hint="Saved entries appear here, newest first." />
            ) : (
              <div className="scroll-x">
                <table className="grid">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Title</th>
                      <th scope="col">Method</th>
                      <th scope="col">Result</th>
                      <th scope="col">Outcome</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {experiments.map((e) => (
                      <tr key={e.id}>
                        <td className="nowrap small">{new Date(e.createdAt).toISOString().slice(0, 10)}</td>
                        <td>
                          {e.name}
                          {e.smiles && (
                            <>
                              <br />
                              <code className="small">{e.smiles}</code>
                            </>
                          )}
                          {e.notes && <div className="small muted">{e.notes}</div>}
                        </td>
                        <td>{e.assay}</td>
                        <td>{e.resultValue || "—"}</td>
                        <td>
                          <Tag tone={toneFor(e.outcome)}>{e.outcome}</Tag>
                        </td>
                        <td>
                          <LinkBtn onClick={() => removeExperiment(e.id)}>delete</LinkBtn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Box>
        </div>
      </div>
    </div>
  );
}
