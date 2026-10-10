/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Structural analog search: retrieve the PubChem 2D-similarity neighborhood of
 * a seed compound, filter it on computed descriptors, and show PubChem's own
 * values beside the on-device ones so the two can be compared.
 */

import React, { useEffect, useState } from "react";
import { Box, Btn, Field, Text, Num, Tag, Note, Busy, Empty, KeyVals, Ext, LinkBtn, val } from "../../components/ui";
import { searchAnalogs, evaluateSmiles } from "../../api/client";
import { takePendingAnalogSeed, setPendingCompound } from "../../store/handoff";
import { navigate } from "../../store/nav";
import { addToBank } from "../bank/store";
import type { AnalogFilters, AnalogResult, AnalogCandidate, MolecularProperties } from "../../types";

const NO_FILTERS: AnalogFilters = {
  mwMax: null, logpMax: null, tpsaMax: null, hbdMax: null, hbaMax: null, rotMax: null, lipinskiOnly: false,
};

const numField = (v: number | null) => (v === null ? "" : String(v));
const parseField = (s: string): number | null => (s.trim() === "" ? null : Number(s));

function csv(result: AnalogResult): string {
  const head = [
    "cid", "name", "formula", "smiles", "tanimoto_distance", "passes", "pareto_optimal",
    "pubchem_mw", "pubchem_xlogp", "pubchem_tpsa", "pubchem_hbd", "pubchem_hba", "pubchem_rotatable",
    "computed_mw", "computed_logp_estimate", "computed_tpsa", "computed_hbd", "computed_hba",
    "computed_rotatable", "computed_ring_count", "lipinski_violations", "functional_groups",
  ];
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = result.candidates.map((c) =>
    [
      c.cid, q(c.name), q(c.formula), q(c.smiles), c.tanimotoDistance ?? "", c.passes, c.paretoOptimal,
      c.pubchem.mw ?? "", c.pubchem.xlogp ?? "", c.pubchem.tpsa ?? "", c.pubchem.hbd ?? "", c.pubchem.hba ?? "", c.pubchem.rotatableBonds ?? "",
      c.computed?.mw ?? "", c.computed?.logp_estimate ?? "", c.computed?.tpsa ?? "", c.computed?.hbd ?? "", c.computed?.hba ?? "",
      c.computed?.rotatable_bonds ?? "", c.computed?.ring_count ?? "", c.computed?.ro5_violations ?? "",
      q(c.computed?.functional_groups.join("; ") ?? ""),
    ].join(",")
  );
  const header = [
    `# chemtool analog search`,
    `# seed,${result.seed.name} (CID ${result.seed.cid})`,
    `# similarity_threshold,${result.query.threshold}`,
    `# max_records,${result.query.maxRecords}`,
    `# retrieved_at,${result.query.retrievedAt}`,
    `# source,PubChem PUG-REST fastsimilarity_2d`,
  ];
  return [...header, head.join(","), ...rows].join("\n");
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Flags a disagreement worth a reader's attention between the two sources. */
function divergence(c: AnalogCandidate): string | null {
  if (!c.computed) return null;
  const d: string[] = [];
  if (c.pubchem.mw !== null && Math.abs(c.pubchem.mw - c.computed.mw) > 1.0) d.push("mass");
  if (c.pubchem.tpsa !== null && Math.abs(c.pubchem.tpsa - c.computed.tpsa) > 10) d.push("TPSA");
  if (c.pubchem.hbd !== null && c.pubchem.hbd !== c.computed.hbd) d.push("HBD");
  if (c.pubchem.rotatableBonds !== null && Math.abs(c.pubchem.rotatableBonds - c.computed.rotatable_bonds) > 1) d.push("rot. bonds");
  return d.length ? d.join(", ") : null;
}

export default function AnalogSearch() {
  const [seed, setSeed] = useState("");
  const [threshold, setThreshold] = useState(90);
  const [maxRecords, setMaxRecords] = useState(25);
  const [filters, setFilters] = useState<AnalogFilters>(NO_FILTERS);
  const [result, setResult] = useState<AnalogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  // Standalone descriptor calculator for a pasted structure.
  const [smiles, setSmiles] = useState("");
  const [calc, setCalc] = useState<MolecularProperties | null>(null);
  const [calcErr, setCalcErr] = useState("");

  const run = async (s = seed) => {
    if (!s.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setOpen(null);
    try {
      setResult(await searchAnalogs(s.trim(), threshold, maxRecords, filters));
    } catch (e: any) {
      setError(e?.message || "Analog search failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const pending = takePendingAnalogSeed();
    if (pending) {
      setSeed(pending);
      run(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const evaluate = async () => {
    if (!smiles.trim()) return;
    setCalcErr("");
    setCalc(null);
    try {
      setCalc(await evaluateSmiles(smiles.trim()));
    } catch (e: any) {
      setCalcErr(e?.message || "That structure could not be parsed.");
    }
  };

  const setF = (k: keyof AnalogFilters, v: number | null | boolean) =>
    setFilters((f) => ({ ...f, [k]: v } as AnalogFilters));

  const bound = (k: keyof AnalogFilters, label: string) => (
    <td>
      <Num
        value={numField(filters[k] as number | null)}
        onChange={(e) => setF(k, parseField(e.target.value))}
        placeholder="—"
        aria-label={label}
        style={{ width: 70 }}
      />
    </td>
  );

  return (
    <div>
      <h2 className="title">Structural analogs</h2>
      <p className="lede">
        Retrieves compounds whose 2D fingerprint similarity to the seed meets the Tanimoto threshold,
        using PubChem's <span className="mono">fastsimilarity_2d</span> service. Every candidate is a
        compound already deposited in PubChem with its own CID — nothing here is a generated or
        hypothetical structure. Use it to ask which known compounds sit closest to a structure of
        interest, then read the record of any that look relevant.
      </p>

      <Box title="Query">
        <div className="row">
          <div className="grow">
            <Field label="Seed compound" hint="Name, CID or SMILES. Resolved against PubChem first.">
              <Text
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                style={{ width: "100%" }}
              />
            </Field>
          </div>
          <Field label="Threshold (%)" hint="Tanimoto, 50–100">
            <Num value={threshold} min={50} max={100} onChange={(e) => setThreshold(Number(e.target.value))} style={{ width: 70 }} />
          </Field>
          <Field label="Max records" hint="1–100">
            <Num value={maxRecords} min={1} max={100} onChange={(e) => setMaxRecords(Number(e.target.value))} style={{ width: 70 }} />
          </Field>
          <Btn primary busy={loading} onClick={() => run()} disabled={!seed.trim()}>
            Search
          </Btn>
        </div>

        <fieldset style={{ marginTop: 6 }}>
          <legend>Descriptor filters (optional, upper bounds)</legend>
          <p className="small muted" style={{ marginBottom: 4 }}>
            Applied to the on-device computed values. Leave a box empty to ignore that property.
            Setting two or more bounds also reports the Pareto-optimal subset — the candidates not
            beaten on every bounded property at once.
          </p>
          <div className="scroll-x">
            <table className="grid" style={{ width: "auto" }}>
              <thead>
                <tr>
                  <th scope="col">Mass</th>
                  <th scope="col">logP est.</th>
                  <th scope="col">TPSA</th>
                  <th scope="col">HBD</th>
                  <th scope="col">HBA</th>
                  <th scope="col">Rot. bonds</th>
                  <th scope="col">Lipinski</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {bound("mwMax", "Maximum molecular mass")}
                  {bound("logpMax", "Maximum logP estimate")}
                  {bound("tpsaMax", "Maximum TPSA")}
                  {bound("hbdMax", "Maximum hydrogen bond donors")}
                  {bound("hbaMax", "Maximum hydrogen bond acceptors")}
                  {bound("rotMax", "Maximum rotatable bonds")}
                  <td>
                    <label className="small nowrap">
                      <input
                        type="checkbox"
                        checked={filters.lipinskiOnly}
                        onChange={(e) => setF("lipinskiOnly", e.target.checked)}
                      />{" "}
                      0 violations
                    </label>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </fieldset>
      </Box>

      {error && <Note kind="err" title="Search failed">{error}</Note>}
      {loading && <Busy label="Querying PubChem similarity service…" />}

      {result && (
        <>
          <Box title={`Seed: ${result.seed.name} (CID ${result.seed.cid})`}>
            <KeyVals
              rows={[
                ["Formula", <span className="mono">{result.seed.formula}</span>],
                ["SMILES", <code>{result.seed.smiles}</code>],
                ["Retrieved", new Date(result.query.retrievedAt).toUTCString()],
                [
                  "Query",
                  `fastsimilarity_2d, threshold ${result.query.threshold}%, max ${result.query.maxRecords} records`,
                ],
                [
                  "Returned",
                  `${result.counts.retrieved} compounds — ${result.counts.passing} pass the filters` +
                    (result.counts.notScored > 0 ? `, ${result.counts.notScored} not scorable on-device` : "") +
                    (result.query.paretoObjectives.length
                      ? `, ${result.counts.paretoOptimal} Pareto-optimal on ${result.query.paretoObjectives.join(" / ")}`
                      : ""),
                ],
                [
                  "HMDB",
                  result.seed.hmdbAccession ? <Tag tone="ok">{result.seed.hmdbAccession}</Tag> : null,
                ],
              ]}
            />
            {result.query.truncated && (
              <p className="small muted" style={{ marginTop: 6 }}>
                PubChem returned more matches than the record cap; raise "max records" or the
                threshold to see the rest of the neighborhood.
              </p>
            )}
            <hr />
            <div className="row">
              <Btn onClick={() => download(`chemtool-analogs-CID${result.seed.cid}.csv`, csv(result))}>
                Download CSV
              </Btn>
              <Ext href={result.seed.url}>Seed record on PubChem</Ext>
            </div>
          </Box>

          <Box title="Neighborhood" flush>
            {result.candidates.length === 0 ? (
              <Empty
                title="No compounds at this threshold"
                hint="Lower the similarity threshold to widen the neighborhood."
              />
            ) : (
              <div className="scroll-x">
                <table className="grid">
                  <thead>
                    <tr>
                      <th scope="col">CID</th>
                      <th scope="col">Name</th>
                      <th scope="col">Formula</th>
                      <th scope="col" className="num" title="1 - Tanimoto on this tool's own fingerprint">FP dist.</th>
                      <th scope="col" className="num">Mass</th>
                      <th scope="col" className="num">XLogP3</th>
                      <th scope="col" className="num">TPSA</th>
                      <th scope="col" className="num">HBD</th>
                      <th scope="col" className="num">HBA</th>
                      <th scope="col">Status</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.candidates.map((c) => {
                      const div = divergence(c);
                      return (
                        <React.Fragment key={c.cid}>
                          <tr className={!c.passes ? "fail" : c.paretoOptimal ? "flag" : undefined}>
                            <td className="mono">{c.cid}</td>
                            <td>{c.name || <span className="muted">unnamed</span>}</td>
                            <td className="mono">{val(c.formula)}</td>
                            <td className="num">{val(c.tanimotoDistance, 3)}</td>
                            <td className="num">{val(c.pubchem.mw)}</td>
                            <td className="num">{val(c.pubchem.xlogp)}</td>
                            <td className="num">{val(c.pubchem.tpsa)}</td>
                            <td className="num">{val(c.pubchem.hbd)}</td>
                            <td className="num">{val(c.pubchem.hba)}</td>
                            <td>
                              {c.passes ? <Tag tone="ok">pass</Tag> : <Tag>filtered</Tag>}
                              {c.paretoOptimal && <Tag tone="warn">Pareto</Tag>}
                              {c.computeError && <Tag tone="bad">not scored</Tag>}
                              {div && <Tag tone="warn">differs: {div}</Tag>}
                            </td>
                            <td className="nowrap">
                              <LinkBtn onClick={() => setOpen(open === c.cid ? null : c.cid)}>
                                {open === c.cid ? "hide" : "detail"}
                              </LinkBtn>
                            </td>
                          </tr>
                          {open === c.cid && (
                            <tr>
                              <td colSpan={11} style={{ background: "#ffffff" }}>
                                <div className="cols">
                                  <div className="col" style={{ flex: "0 0 150px" }}>
                                    <div className="struct" style={{ textAlign: "center" }}>
                                      <img
                                        src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${c.cid}/PNG`}
                                        alt={`Structure of CID ${c.cid}`}
                                        style={{ maxWidth: "100%", maxHeight: 140 }}
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  </div>
                                  <div className="col">
                                    <table className="grid" style={{ width: "auto" }}>
                                      <thead>
                                        <tr>
                                          <th scope="col">Descriptor</th>
                                          <th scope="col" className="num">PubChem</th>
                                          <th scope="col" className="num">On-device</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td>Molecular mass</td>
                                          <td className="num">{val(c.pubchem.mw)}</td>
                                          <td className="num">{val(c.computed?.mw)}</td>
                                        </tr>
                                        <tr>
                                          <td>logP (XLogP3 vs estimate)</td>
                                          <td className="num">{val(c.pubchem.xlogp)}</td>
                                          <td className="num">{val(c.computed?.logp_estimate)}</td>
                                        </tr>
                                        <tr>
                                          <td>TPSA</td>
                                          <td className="num">{val(c.pubchem.tpsa)}</td>
                                          <td className="num">{val(c.computed?.tpsa)}</td>
                                        </tr>
                                        <tr>
                                          <td>H-bond donors</td>
                                          <td className="num">{val(c.pubchem.hbd)}</td>
                                          <td className="num">{val(c.computed?.hbd)}</td>
                                        </tr>
                                        <tr>
                                          <td>H-bond acceptors</td>
                                          <td className="num">{val(c.pubchem.hba)}</td>
                                          <td className="num">{val(c.computed?.hba)}</td>
                                        </tr>
                                        <tr>
                                          <td>Rotatable bonds</td>
                                          <td className="num">{val(c.pubchem.rotatableBonds)}</td>
                                          <td className="num">{val(c.computed?.rotatable_bonds)}</td>
                                        </tr>
                                        <tr>
                                          <td>Rings (total / aromatic)</td>
                                          <td className="num">—</td>
                                          <td className="num">
                                            {val(c.computed?.ring_count)} / {val(c.computed?.aromatic_rings)}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td>Lipinski / Veber violations</td>
                                          <td className="num">—</td>
                                          <td className="num">
                                            {val(c.computed?.ro5_violations)} / {val(c.computed?.veber_violations)}
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>

                                    {c.computed && c.computed.functional_groups.length > 0 && (
                                      <p style={{ marginTop: 6 }}>
                                        <span className="small muted">Functional groups found in the structure graph:</span>
                                        <br />
                                        {c.computed.functional_groups.map((g) => (
                                          <Tag key={g}>{g}</Tag>
                                        ))}
                                      </p>
                                    )}
                                    {c.computeError && (
                                      <p className="small muted" style={{ marginTop: 6 }}>
                                        On-device descriptors unavailable: {c.computeError}. PubChem's
                                        values are shown unchanged; no substitute figures were generated.
                                      </p>
                                    )}
                                    {!c.passes && (
                                      <p className="small muted" style={{ marginTop: 6 }}>
                                        Filtered out: {c.failedFilters.join("; ")}.
                                      </p>
                                    )}
                                    {c.smiles && (
                                      <p style={{ marginTop: 6 }}>
                                        <code>{c.smiles}</code>
                                      </p>
                                    )}
                                    <div className="row" style={{ marginTop: 6 }}>
                                      <Btn
                                        onClick={() => {
                                          setPendingCompound(String(c.cid));
                                          navigate("compounds");
                                        }}
                                      >
                                        Open record
                                      </Btn>
                                      <Btn
                                        onClick={() =>
                                          addToBank({
                                            id: String(c.cid),
                                            name: c.name || `CID ${c.cid}`,
                                            formula: c.formula || "",
                                            smiles: c.smiles || undefined,
                                            cid: c.cid,
                                            mw: c.pubchem.mw ?? undefined,
                                            source: `analog of ${result.seed.name}`,
                                          })
                                        }
                                        disabled={!c.formula}
                                      >
                                        Add to bank
                                      </Btn>
                                      <Ext href={c.url}>PubChem</Ext>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Box>

          <Note title="What this result does and does not show">
            Membership in this list is decided by PubChem's fingerprint similarity to the seed.
            Compounds with similar fingerprints often behave differently, and compounds with low
            similarity can share a binding mode, so this is a retrieval result, not evidence of
            shared activity. No affinity, target, toxicity or synthetic route is predicted anywhere
            in this tool.
            {" "}
            The <b>FP dist.</b> column is computed here from this tool's own substructure
            fingerprint, which is coarser than PubChem's: it frequently gives distinct compounds the
            same score, and a distance of 0.000 means "indistinguishable to this fingerprint", not
            "the same structure". Compare structures directly before relying on it.
          </Note>
        </>
      )}

      {!result && !loading && !error && (
        <Box>
          <Empty title="No search run yet" hint="Enter a seed compound above and press Search." />
        </Box>
      )}

      <Box title="Descriptor calculator">
        <p className="small muted">
          Computes descriptors on-device from any SMILES string, including structures that are not in
          PubChem. Unparseable input is reported as an error rather than given placeholder values.
        </p>
        <div className="row">
          <div className="grow">
            <Field label="SMILES">
              <Text
                className="mono"
                value={smiles}
                onChange={(e) => setSmiles(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && evaluate()}
                placeholder="SMILES string"
                style={{ width: "100%" }}
              />
            </Field>
          </div>
          <Btn onClick={evaluate} disabled={!smiles.trim()}>
            Compute
          </Btn>
        </div>
        {calcErr && <Note kind="err">{calcErr}</Note>}
        {calc && (
          <KeyVals
            rows={[
              ["Formula", <span className="mono">{calc.formula}</span>],
              ["Molecular mass", `${calc.mw} g/mol`],
              ["logP (estimate)", String(calc.logp_estimate)],
              ["TPSA", `${calc.tpsa} Å²`],
              ["H-bond donors / acceptors", `${calc.hbd} / ${calc.hba}`],
              ["Rotatable bonds", String(calc.rotatable_bonds)],
              ["Rings (total / aromatic)", `${calc.ring_count} / ${calc.aromatic_rings}`],
              ["Lipinski / Veber violations", `${calc.ro5_violations} / ${calc.veber_violations}`],
              [
                "Functional groups",
                calc.functional_groups.length ? calc.functional_groups.map((g) => <Tag key={g}>{g}</Tag>) : "none detected",
              ],
            ]}
          />
        )}
      </Box>
    </div>
  );
}
