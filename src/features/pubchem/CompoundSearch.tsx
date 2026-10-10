/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { Box, Btn, Field, Text, Tag, Note, Busy, Empty, KeyVals, Ext, val } from "../../components/ui";
import { searchCompound } from "../../api/client";
import { takePendingCompound, setPendingReactants, setPendingAnalogSeed } from "../../store/handoff";
import { navigate } from "../../store/nav";
import { useBank, addToBank } from "../bank/store";
import { openMetabolite } from "../metabolites/actions";
import type { PubChemCompound } from "../../types";

export default function CompoundSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PubChemCompound | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bank = useBank();
  const banked = !!result && bank.some((c) => c.cid === result.cid);

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
    const pending = takePendingCompound();
    if (pending) run(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bankIt = () => {
    if (!result?.formula) return;
    addToBank({
      id: String(result.cid),
      name: result.name,
      formula: result.formula,
      smiles: result.smiles || undefined,
      cid: result.cid,
      mw: result.mw,
      source: "PubChem",
      hmdb: result.hmdbAccession || undefined,
    });
  };

  return (
    <div>
      <h2 className="title">Compound lookup</h2>
      <p className="lede">
        Retrieves a compound record from the live PubChem PUG-REST service by name, formula, SMILES
        or CID. Names are resolved through PubChem's own autocomplete, so misspellings are corrected
        to the nearest deposited compound. All descriptors below are PubChem's.
      </p>

      <Box title="Query">
        <div className="row">
          <div className="grow">
            <Field label="Compound">
              <Text
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="Name, formula, SMILES or CID"
                style={{ width: "100%" }}
              />
            </Field>
          </div>
          <Btn primary busy={loading} onClick={() => run()} disabled={!query.trim()}>
            Search
          </Btn>
        </div>
      </Box>

      {error && <Note kind="err" title="Lookup failed">{error}</Note>}
      {loading && !result && <Busy label="Querying PubChem…" />}

      {result && (
        <>
          <Box
            title={`${result.name} — CID ${result.cid}`}
            actions={result.hmdbAccession ? <Tag tone="ok">Human metabolite</Tag> : null}
          >
            <div className="cols">
              <div className="col" style={{ flex: "0 0 180px" }}>
                <div className="struct" style={{ textAlign: "center" }}>
                  <img
                    src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${result.cid}/PNG`}
                    alt={`Structure of ${result.name}`}
                    style={{ maxWidth: "100%", maxHeight: 170 }}
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              <div className="col">
                <KeyVals
                  rows={[
                    ["Formula", <span className="mono">{result.formula}</span>],
                    ["Molar mass", `${val(result.mw)} g/mol`],
                    ["IUPAC name", result.iupac_name],
                    ["XLogP3", val(result.clogp)],
                    ["TPSA", result.tpsa === null ? "—" : `${result.tpsa} Å²`],
                    ["H-bond donors / acceptors", `${val(result.hbd)} / ${val(result.hba)}`],
                    ["Rotatable bonds", val(result.rotatable_bonds)],
                    ["HMDB", result.hmdbAccession],
                  ]}
                />
                {result.smiles && (
                  <p style={{ marginTop: 6 }}>
                    <span className="small muted">SMILES</span>
                    <br />
                    <code>{result.smiles}</code>
                  </p>
                )}
              </div>
            </div>

            <hr />
            <div className="row">
              <Btn onClick={bankIt} disabled={!result.formula || banked}>
                {banked ? "In bank" : "Add to bank"}
              </Btn>
              <Btn
                onClick={() => {
                  setPendingAnalogSeed(String(result.cid));
                  navigate("analogs");
                }}
              >
                Find analogs
              </Btn>
              {result.formula && (
                <Btn
                  onClick={() => {
                    setPendingReactants([result.formula]);
                    navigate("reactions");
                  }}
                >
                  Use in reaction
                </Btn>
              )}
              {result.hmdbAccession && (
                <Btn onClick={() => openMetabolite(result.hmdbAccession!)}>
                  Metabolite record ({result.hmdbAccession})
                </Btn>
              )}
            </div>
          </Box>

          {result.description && result.description !== "No description available in PubChem." && (
            <Box title="Description">
              <p>{result.description}</p>
              {result.descriptionSource && (
                <p className="small muted">
                  Source: {result.descriptionSource}
                  {result.descriptionUrl && (
                    <>
                      {" — "}
                      <Ext href={result.descriptionUrl}>reference</Ext>
                    </>
                  )}
                </p>
              )}
            </Box>
          )}

          {result.synonyms?.length > 0 && (
            <Box title="Synonyms">
              {result.synonyms.slice(0, 10).map((s, i) => (
                <Tag key={i}>{s}</Tag>
              ))}
            </Box>
          )}

          <p className="small">
            <Ext href={result.reportUrl}>Full PubChem record for CID {result.cid}</Ext>
          </p>
        </>
      )}

      {!loading && !result && !error && (
        <Box>
          <Empty title="No compound loaded" hint="Enter a name, formula, SMILES string or CID above." />
        </Box>
      )}
    </div>
  );
}
