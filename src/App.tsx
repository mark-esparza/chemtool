/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App shell: masthead, text navigation bar, and feature routing. Navigation is
 * a shared store so features can hand off to one another (a compound record
 * opening its metabolite entry, a metabolite seeding an analog search).
 */

import React from "react";

import CompoundSearch from "./features/pubchem/CompoundSearch";
import BatchCompare from "./features/pubchem/BatchCompare";
import MetaboliteExplorer from "./features/metabolites/MetaboliteExplorer";
import AnalogSearch from "./features/analogs/AnalogSearch";
import ReactionSimulator from "./features/reactions/ReactionSimulator";
import LabNotebook from "./features/experiments/LabNotebook";
import Methods from "./features/guide/Methods";
import { useView, navigate, ViewId } from "./store/nav";

const NAV: { id: ViewId; label: string; component: React.ComponentType }[] = [
  { id: "compounds", label: "Compounds", component: CompoundSearch },
  { id: "analogs", label: "Analogs", component: AnalogSearch },
  { id: "metabolites", label: "Metabolites", component: MetaboliteExplorer },
  { id: "compare", label: "Compare", component: BatchCompare },
  { id: "reactions", label: "Reactions", component: ReactionSimulator },
  { id: "notebook", label: "Notebook", component: LabNotebook },
  { id: "methods", label: "Methods", component: Methods },
];

export default function App() {
  const view = useView();
  const Active = (NAV.find((i) => i.id === view) ?? NAV[0]).component;

  return (
    <div className="page">
      <div className="masthead">
        <h1>Chemtool</h1>
        <div className="tagline">
          Compound, metabolite and analog retrieval from public chemical databases
        </div>
      </div>

      <div className="navbar">
        {NAV.map((item, i) => (
          <React.Fragment key={item.id}>
            {/* Spaces around the separator give the line a break opportunity,
                so the bar wraps instead of overflowing on a narrow screen. */}
            {i > 0 && <span className="sep"> | </span>}
            {view === item.id ? (
              <a className="here" href="#" aria-current="page" onClick={(e) => e.preventDefault()}>
                {item.label}
              </a>
            ) : (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.id);
                }}
              >
                {item.label}
              </a>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="content">
        <Active />
      </div>

      <div className="footer">
        Data retrieved live from PubChem (NIH/NLM) and the Human Metabolome Database.
        Descriptors are either reported by the source database or computed on-device from the
        structure, and are labelled as such throughout. See{" "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("methods");
          }}
        >
          Methods
        </a>{" "}
        for how each value is produced and what it does not establish.
      </div>
    </div>
  );
}
