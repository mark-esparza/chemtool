/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App shell: brand, student-first navigation, and feature routing. All feature
 * logic lives under src/features/*. Navigation is a shared store so features can
 * hand off to one another (e.g. the chemical bank → the Reaction Simulator).
 */

import React from "react";
import { Atom, FlaskConical, Search, PackageSearch, Dna, GitCompare, Sparkles, NotebookPen, LucideIcon } from "lucide-react";

import ReactionSimulator from "./features/reactions/ReactionSimulator";
import CompoundSearch from "./features/pubchem/CompoundSearch";
import ProductBreakdown from "./features/products/ProductBreakdown";
import MetaboliteExplorer from "./features/metabolites/MetaboliteExplorer";
import BatchCompare from "./features/pubchem/BatchCompare";
import MoleculeDesigner from "./features/design/MoleculeDesigner";
import LabNotebook from "./features/experiments/LabNotebook";
import { useView, navigate, ViewId } from "./store/nav";

interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  component: React.ComponentType;
}

const GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Chemistry",
    items: [
      { id: "reactions", label: "Reactions", icon: FlaskConical, component: ReactionSimulator },
      { id: "search", label: "Compound Search", icon: Search, component: CompoundSearch },
      { id: "products", label: "Product Breakdown", icon: PackageSearch, component: ProductBreakdown },
      { id: "metabolites", label: "Metabolites", icon: Dna, component: MetaboliteExplorer },
      { id: "compare", label: "Compare", icon: GitCompare, component: BatchCompare },
    ],
  },
  {
    heading: "Advanced",
    items: [
      { id: "designer", label: "Molecule Designer", icon: Sparkles, component: MoleculeDesigner },
      { id: "notebook", label: "Lab Notebook", icon: NotebookPen, component: LabNotebook },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

export default function App() {
  const view = useView();
  const Active = ALL.find((i) => i.id === view)!.component;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A355C]">
            <Atom className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">Chem Studio</div>
            <div className="text-[11px] text-slate-400">Chemistry for students</div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 p-3">
          {GROUPS.map((g) => (
            <div key={g.heading}>
              <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.heading}</div>
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const active = view === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                        active ? "bg-[#0A355C] text-white" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
          Deterministic · on-device · live PubChem
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white p-2 lg:hidden">
          {ALL.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${active ? "bg-[#0A355C] text-white" : "text-slate-600"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <main className="flex-1 overflow-y-auto p-5 sm:p-8">
          <Active />
        </main>
      </div>
    </div>
  );
}
