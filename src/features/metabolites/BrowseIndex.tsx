/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Somewhere to start. A clickable index of well-characterised metabolites
 * grouped by role, plus whatever you looked at recently.
 */

import { useState } from "react";
import { Box, Btn, Ext, LinkBtn } from "../../components/ui";
import { BROWSE_CATEGORIES, ALL_BROWSE_NAMES, randomMetaboliteName } from "./browseIndex";
import { useRecent, clearRecent } from "./recent";

export default function BrowseIndex({
  onPick,
  busy = false,
}: {
  onPick: (name: string) => void;
  busy?: boolean;
}) {
  const [active, setActive] = useState<string>(BROWSE_CATEGORIES[0].key);
  const recent = useRecent();

  const category = BROWSE_CATEGORIES.find((c) => c.key === active);
  const names = active === "all" ? ALL_BROWSE_NAMES : (category?.members ?? []);

  return (
    <Box title="Browse">
      {recent.length > 0 && (
        <>
          <div className="small">
            <b>Recently viewed: </b>
            {recent.map((r, i) => (
              <span key={r.accession}>
                {i > 0 && " · "}
                <LinkBtn onClick={() => onPick(r.accession)} title={r.accession} disabled={busy}>
                  {r.name}
                </LinkBtn>
              </span>
            ))}
            {" · "}
            <LinkBtn onClick={clearRecent}>clear</LinkBtn>
          </div>
          <hr />
        </>
      )}

      <div className="small" style={{ marginBottom: 6 }}>
        {BROWSE_CATEGORIES.map((c, i) => (
          <span key={c.key}>
            {i > 0 && <span className="muted"> | </span>}
            {c.key === active ? (
              <b>{c.label}</b>
            ) : (
              <LinkBtn onClick={() => setActive(c.key)}>{c.label}</LinkBtn>
            )}
          </span>
        ))}
        <span className="muted"> | </span>
        {active === "all" ? <b>All ({ALL_BROWSE_NAMES.length})</b> : <LinkBtn onClick={() => setActive("all")}>All ({ALL_BROWSE_NAMES.length})</LinkBtn>}
      </div>

      {category && <p className="small muted">{category.blurb}</p>}

      <ul className="index-list">
        {names.map((n) => (
          <li key={n}>
            <LinkBtn onClick={() => onPick(n)} disabled={busy}>
              {n}
            </LinkBtn>
          </li>
        ))}
      </ul>

      <hr />
      <div className="row">
        <Btn onClick={() => onPick(randomMetaboliteName())} disabled={busy}>
          Surprise me
        </Btn>
        <span className="small muted" style={{ alignSelf: "center" }}>
          A starting index of {ALL_BROWSE_NAMES.length} well-characterised metabolites — names are
          resolved against HMDB when you click, and the grouping is for navigation, not HMDB's own
          classification. For the full database and its filters, use{" "}
          <Ext href="https://hmdb.ca/metabolites">HMDB's browser</Ext>.
        </span>
      </div>
    </Box>
  );
}
