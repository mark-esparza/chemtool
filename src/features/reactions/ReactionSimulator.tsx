/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reaction balancing. The products come from a knowledge base of common
 * reaction patterns or a deterministic classifier; the stoichiometry is solved
 * and then verified by re-counting atoms on both sides. The earlier
 * "condition optimization" sliders, which turned temperature and a catalyst
 * toggle into invented yield percentages, have been removed: no kinetics or
 * thermodynamics calculation backed them.
 */

import React, { useEffect, useState } from "react";
import { Box, Btn, Field, Text, Tag, Note, Busy, Empty, KeyVals, val } from "../../components/ui";
import { Markdown } from "../../components/ui/Markdown";
import { simulateReaction } from "../../api/client";
import { takePendingReactants, setPendingNotebookDraft } from "../../store/handoff";
import { navigate } from "../../store/nav";
import type { ReactionResult } from "../../types";

const PRESETS = [
  { title: "Methane combustion", input: "CH4 + O2", conditions: "Ignition, excess O2" },
  { title: "Neutralization", input: "HCl + NaOH", conditions: "" },
  { title: "Precipitation", input: "AgNO3 + NaCl", conditions: "Aqueous" },
  { title: "Decomposition", input: "KClO3", conditions: "Heat, MnO2 catalyst" },
];

export default function ReactionSimulator() {
  const [input, setInput] = useState("CH4 + O2");
  const [conditions, setConditions] = useState("");
  const [result, setResult] = useState<ReactionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [safety, setSafety] = useState("");

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
    const pending = takePendingReactants();
    run(pending && pending.length > 0 ? pending.join(" + ") : input, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const log = () => {
    if (!result) return;
    setPendingNotebookDraft({
      name: result.equation,
      assay: "Balanced equation (chemtool)",
      resultValue: result.balanced ? "Balanced and verified" : "Not balanced",
      notes: `Reaction type: ${result.reaction_type}. Source: ${result.source}.${
        result.conditions ? ` Conditions: ${result.conditions}.` : ""
      }`,
      source: "Reactions",
    });
    navigate("notebook");
  };

  return (
    <div>
      <h2 className="title">Reaction balancing</h2>
      <p className="lede">
        Enter reactants by name, formula or SMILES. Products are proposed from a pattern knowledge
        base, the equation is balanced by solving the atom-conservation system, and the result is
        verified by re-counting every element on both sides. A reaction that cannot be balanced is
        reported as such rather than adjusted to look balanced.
      </p>

      <Box title="Query">
        <div className="row">
          <div className="grow">
            <Field label="Reactants" hint="Separate with + or a comma.">
              <Text
                className="mono"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                style={{ width: "100%" }}
              />
            </Field>
          </div>
          <div className="grow">
            <Field label="Conditions (optional)">
              <Text
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="heat, catalyst, aqueous…"
                style={{ width: "100%" }}
              />
            </Field>
          </div>
          <Btn primary busy={loading} onClick={() => run()} disabled={!input.trim()}>
            Balance
          </Btn>
        </div>
        <div className="small muted">
          Examples:{" "}
          {PRESETS.map((p, i) => (
            <React.Fragment key={p.title}>
              {i > 0 && " · "}
              <button
                className="link"
                onClick={() => {
                  setInput(p.input);
                  setConditions(p.conditions);
                  run(p.input, p.conditions);
                }}
              >
                {p.title}
              </button>
            </React.Fragment>
          ))}
        </div>
      </Box>

      {safety && <Note kind="err" title="Request refused">{safety}</Note>}
      {error && <Note kind="err" title="Simulation failed">{error}</Note>}
      {loading && <Busy label="Balancing…" />}

      {result && (
        <>
          <Box title="Equation">
            <p className="mono" style={{ fontSize: 15 }}>
              {result.equation}
            </p>
            <p>
              {result.balanced ? <Tag tone="ok">balanced and verified</Tag> : <Tag tone="bad">not balanced</Tag>}
              <Tag>{result.reaction_type}</Tag>
              <Tag>{result.energetics.character}</Tag>
              <Tag>source: {result.source}</Tag>
              {result.assumed_combustion && <Tag tone="warn">combustion in air assumed</Tag>}
            </p>
            {!result.balanced && result.balance_reason && (
              <Note kind="info" title="Why it is not balanced">{result.balance_reason}</Note>
            )}
            {!result.reaction_occurs && result.reason && (
              <Note kind="info" title="No reaction predicted">{result.reason}</Note>
            )}
            {result.resolved_reactants && result.resolved_reactants.length > 0 && (
              <p className="small muted">
                Inputs resolved as:{" "}
                {result.resolved_reactants
                  .map((r) => `${r.input} → ${r.formula || "unresolved"} (${r.source})`)
                  .join("; ")}
              </p>
            )}
          </Box>

          {result.species.length > 0 && (
            <Box title="Species" flush>
              <div className="scroll-x">
                <table className="grid">
                  <thead>
                    <tr>
                      <th scope="col">Role</th>
                      <th scope="col" className="num">Coeff.</th>
                      <th scope="col">Formula</th>
                      <th scope="col">State</th>
                      <th scope="col" className="num">Molar mass</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.species.map((s, i) => (
                      <tr key={i}>
                        <td>{s.role}</td>
                        <td className="num">{s.coefficient}</td>
                        <td className="mono">{s.formula}</td>
                        <td>{s.state || "—"}</td>
                        <td className="num">{val(s.molarMass, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Box>
          )}

          <Box title="Interpretation">
            <KeyVals
              rows={[
                ["Observations", result.observations],
                ["Conditions", result.conditions],
                ["Mechanism", result.mechanism],
                ["Hazards", result.hazards],
                [
                  "Energetics",
                  `${result.energetics.character} — ${result.energetics.note}`,
                ],
              ]}
            />
            <Note kind="info" title="Scope of this estimate">
              The energetic character is a qualitative label attached to the reaction class, not a
              calculated enthalpy for your specific conditions. Yield, rate, selectivity, solvent
              effects and side reactions are not modelled.
            </Note>
            <Btn onClick={log}>Record in notebook</Btn>
          </Box>

          {result.report && (
            <Box title="Report">
              <Markdown text={result.report} />
            </Box>
          )}
        </>
      )}

      {!result && !loading && !error && !safety && (
        <Box>
          <Empty title="No reaction entered" hint="Enter reactants above and press Balance." />
        </Box>
      )}
    </div>
  );
}
