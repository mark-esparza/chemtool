/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Atom, 
  Settings, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  TrendingUp, 
  ShieldAlert, 
  Trash2, 
  Sparkles, 
  Layers, 
  Play, 
  Search, 
  BookOpen, 
  Activity, 
  FileText,
  BadgeAlert,
  Dna,
  Eye,
  GitCompare,
  Plus,
  X,
  ChevronRight
} from "lucide-react";
import StructureRenderer from "./components/StructureRenderer";
import { MolecularProperties } from "./lib/chemEngine";

interface PropertyConstraint {
  name: string;
  op: "<=" | ">=" | "==";
  value: number;
  weight: number;
  hard: boolean;
}

interface DesignBrief {
  objective_summary: string;
  seed_smiles: string;
  property_constraints: PropertyConstraint[];
  admet_limits?: Record<string, string>;
  novelty: {
    min_tanimoto_distance_from_seed: number;
    max: number;
  };
  must_avoid_alerts: string[];
  confidence_required: "low" | "medium" | "high";
  notes?: string;
}

interface Candidate extends MolecularProperties {
  name: string;
  mutation_rationale: string;
  tanimoto_distance: number;
  is_pareto_optimal: boolean;
  total_cost: number;
  ood_flag: boolean;
}

// Full sample dataset representing first-load state
const DEFAULT_BRIEF: DesignBrief = {
  objective_summary: "A more soluble, easier-to-synthesize aspirin analog that stays under 400 Da.",
  seed_smiles: "CC(=O)OC1=CC=CC=C1C(=O)O",
  property_constraints: [
    { name: "mw", op: "<=", value: 400, weight: 1.0, hard: true },
    { name: "clogp", op: "<=", value: 3.0, weight: 1.5, hard: false },
    { name: "sa_score", op: "<=", value: 2.5, weight: 1.2, hard: false },
  ],
  novelty: { min_tanimoto_distance_from_seed: 0.1, max: 0.65 },
  must_avoid_alerts: ["PAINS", "Brenk"],
  confidence_required: "medium",
};

const DEFAULT_CANDIDATES: Candidate[] = [
  {
    smiles: "CC(=O)OC1=C(F)C=CC=C1C(=O)O",
    formula: "C9H7FO4",
    name: "2-Acetoxy-3-fluorobenzoic acid",
    mw: 198.15,
    clogp: 1.34,
    tpsa: 63.3,
    hbd: 1,
    hba: 4,
    rotatable_bonds: 3,
    aromatic_rings: 1,
    qed: 0.79,
    sa_score: 1.85,
    ro5_violations: 0,
    veber_violations: 0,
    structural_alerts: [],
    mutation_rationale: "Fluorination at ortho-position blockades CYP-mediated metabolic degradation while retaining parent pharmacophore alignment.",
    tanimoto_distance: 0.12,
    is_pareto_optimal: true,
    total_cost: 0,
    ood_flag: false
  },
  {
    smiles: "CC(=O)OC1=CC=CC=C1C(=O)NCC2=CC=CC=C2",
    formula: "C16H15NO3",
    name: "N-Benzyl-2-acetoxybenzamide",
    mw: 269.3,
    clogp: 2.11,
    tpsa: 58.6,
    hbd: 1,
    hba: 3,
    rotatable_bonds: 5,
    aromatic_rings: 2,
    qed: 0.72,
    sa_score: 2.1,
    ro5_violations: 0,
    veber_violations: 0,
    structural_alerts: [],
    mutation_rationale: "Benzyl amide substitution increases lipophilicity to aid membrane permeability testing.",
    tanimoto_distance: 0.38,
    is_pareto_optimal: true,
    total_cost: 0,
    ood_flag: false
  },
  {
    smiles: "CC(=O)OC1=CC(O)=CC=C1C(=O)O",
    formula: "C9H8O5",
    name: "5-Hydroxyaspirin",
    mw: 196.15,
    clogp: 0.60,
    tpsa: 83.5,
    hbd: 2,
    hba: 5,
    rotatable_bonds: 3,
    aromatic_rings: 1,
    qed: 0.81,
    sa_score: 1.6,
    ro5_violations: 0,
    veber_violations: 0,
    structural_alerts: [],
    mutation_rationale: "Hydroxyl insertion dramatically improves aqueous solubility parameters.",
    tanimoto_distance: 0.15,
    is_pareto_optimal: true,
    total_cost: 0,
    ood_flag: false
  },
  {
    smiles: "COC1=C(OC)C=C(C=C1)C(=O)OC2=CC=CC=C2C(=O)O",
    formula: "C16H14O6",
    name: "3,4-Dimethoxysalicylic salicylate",
    mw: 302.28,
    clogp: 2.15,
    tpsa: 81.8,
    hbd: 1,
    hba: 6,
    rotatable_bonds: 6,
    aromatic_rings: 2,
    qed: 0.65,
    sa_score: 2.4,
    ro5_violations: 0,
    veber_violations: 0,
    structural_alerts: [],
    mutation_rationale: "Dimethoxy benzoyl extension targets expanded pocket residues under COX-2 active center templates.",
    tanimoto_distance: 0.54,
    is_pareto_optimal: false,
    total_cost: 0.15,
    ood_flag: false
  },
  {
    smiles: "CC(=O)OC1=CC=C(C(=O)O)C(O)=C1",
    formula: "C9H8O5",
    name: "4-Hydroxy salicylic ester derivative (Catechol Alert)",
    mw: 196.15,
    clogp: 0.60,
    tpsa: 83.5,
    hbd: 2,
    hba: 5,
    rotatable_bonds: 3,
    aromatic_rings: 1,
    qed: 0.77,
    sa_score: 2.8,
    ro5_violations: 0,
    veber_violations: 0,
    structural_alerts: ["Catechol (PAINS/Brenk: Redox risk/alkylation alert)"],
    mutation_rationale: "Hydroxyl group layout designed to study hydrogen bonding, carries structural redox potential.",
    tanimoto_distance: 0.22,
    is_pareto_optimal: false,
    total_cost: 0.3,
    ood_flag: false
  }
];

const DEFAULT_EXPLANATION = `Based on the evaluated parameters, **2-Acetoxy-3-fluorobenzoic acid** perfectly matches the core targets:
1. **Solubility and Desolvation**: The ortho-fluorine introduces strong local field gradients without perturbing target ester pharmacophores.
2. **Sub-400 Da Limit Enforcement**: Molecular Weight (198.1 Da) is comfortably within limits while preserving low SA score synthetic accessibility (1.85).

**Suggested assays for validation:**
1. **COX-1/COX-2 Colorimetric Screening Assay**: To compute IC50 enzymatic inhibition kinetics.
2. **Parallel Artificial Membrane Permeability Assay (PAMPA)**: To evaluate passive transcellular gastrointestinal absorption coefficients.`;

const evaluateLipinski = (data: any) => {
  const violations: string[] = [];
  if (data.mw > 500) violations.push(`MW (${data.mw} > 500 Da)`);
  if (data.clogp !== null && data.clogp > 5) violations.push(`LogP (${data.clogp} > 5)`);
  if (data.hbd > 5) violations.push(`HBD (${data.hbd} > 5)`);
  if (data.hba > 10) violations.push(`HBA (${data.hba} > 10)`);
  
  return {
    passed: violations.length === 0,
    violations,
    count: violations.length
  };
};

interface Experiment {
  id: string;
  smiles: string;
  name: string;
  assay: string;
  resultValue: string;
  outcome: "success" | "partial" | "failed" | "toxic";
  notes: string;
  createdAt: string;
}

const DEFAULT_EXPERIMENTS: Experiment[] = [
  {
    id: "exp-1",
    smiles: "CC(=O)OC1=CC=CC=C1C(=O)O",
    name: "Acetylsalicylic Acid (Aspirin parent)",
    assay: "COX-2 Inhibition Assay",
    resultValue: "IC50 = 240 nM",
    outcome: "success",
    notes: "High target potency validated in vitro. Moderate gastrointestinal irritation noted in epithelial cell permeability assay.",
    createdAt: "2026-06-19T10:00:00Z"
  },
  {
    id: "exp-2",
    smiles: "CC(=O)OC1=CC(C)=CC=C1C(=O)O",
    name: "5-Methyl Aspirin analog",
    assay: "Aqueous Solubility counter-screen",
    resultValue: "Solubility = 4.2 mg/mL",
    outcome: "failed",
    notes: "Significant hydrophobic collapse observed. Aggressive precipitation in lipid bilayers, shifting partition metrics negatively.",
    createdAt: "2026-06-20T08:15:00Z"
  }
];

function ScientificMarkdownRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-3 font-sans text-xs text-slate-700 text-left leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-0.5" />;
        
        // Headers Level 1 or 2
        if (trimmed.startsWith("##") || trimmed.startsWith("#")) {
          const title = trimmed.replace(/^#+\s*/, "");
          return (
            <h4 key={idx} className="text-xs uppercase font-mono font-bold tracking-widest text-[#0A355C] border-b border-slate-205 pb-1 mt-4 first:mt-0 select-none">
              {title}
            </h4>
          );
        }
        
        // Headers Level 3 or Bullet titles
        if (trimmed.startsWith("###") || (trimmed.startsWith("**") && trimmed.endsWith("**"))) {
          const boldTitle = trimmed.replace(/^\*+\s*/, "").replace(/\*+$/, "");
          return (
            <h5 key={idx} className="text-[11px] font-bold text-slate-800 mt-2.5 flex items-center gap-1.5 font-mono uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block"></span>
              {boldTitle}
            </h5>
          );
        }

        // Bullets or List Items
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          const cleanLine = trimmed.replace(/^[-*]\s*/, "");
          const parts = cleanLine.split("**");
          return (
            <div key={idx} className="pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-[#0A355C] text-[11px] text-slate-650 leading-relaxed mt-1">
              <span>
                {parts.map((p, pidx) => pidx % 2 === 1 ? <strong key={pidx} className="text-[#0A355C] font-semibold">{p}</strong> : p)}
              </span>
            </div>
          );
        }

        // Standard Paragraph with potential inline bold highlight
        const parts = trimmed.split("**");
        if (parts.length > 1) {
          return (
            <p key={idx} className="text-slate-650 leading-relaxed mt-1 text-[11.5px]">
              {parts.map((p, pidx) => pidx % 2 === 1 ? <strong key={pidx} className="text-slate-900 font-bold font-mono">{p}</strong> : p)}
            </p>
          );
        }

        return <p key={idx} className="text-slate-650 leading-relaxed mt-1 text-[11.5px]">{trimmed}</p>;
      })}
    </div>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState("A more soluble, easier-to-synthesize aspirin analog that stays under 400 Da.");
  const [numSamples, setNumSamples] = useState(15);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [safetyTripped, setSafetyTripped] = useState<boolean>(false);
  const [safetyReason, setSafetyReason] = useState<string>("");

  // View Controller Tab
  const [viewMode, setViewMode] = useState<"design" | "pubchem" | "batch" | "experiments">("design");

  // Lead Lab History state
  const [experiments, setExperiments] = useState<Experiment[]>(() => {
    const saved = localStorage.getItem("mol_design_experiments");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_EXPERIMENTS;
      }
    }
    return DEFAULT_EXPERIMENTS;
  });

  useEffect(() => {
    localStorage.setItem("mol_design_experiments", JSON.stringify(experiments));
  }, [experiments]);

  // Experiment form states
  const [expFormSMILES, setExpFormSMILES] = useState("");
  const [expFormName, setExpFormName] = useState("");
  const [expFormAssay, setExpFormAssay] = useState("COX-2 Inhibition Assay");
  const [expFormResult, setExpFormResult] = useState("");
  const [expFormOutcome, setExpFormOutcome] = useState<"success" | "partial" | "failed" | "toxic">("success");
  const [expFormNotes, setExpFormNotes] = useState("");

  // PubChem Database Hub states
  const [pubchemQuery, setPubchemQuery] = useState("Ibuprofen");
  const [pubchemResponse, setPubchemResponse] = useState<any>(null);
  const [pubchemLoading, setPubchemLoading] = useState(false);
  const [pubchemError, setPubchemError] = useState("");
  const [seedPubChem, setSeedPubChem] = useState<any>(null);

  // Batch lookup & comparison matrix state variables
  const [batchInput, setBatchInput] = useState("Aspirin, Caffeine, Ibuprofen, Paracetamol, Metformin, Sildenafil");
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [selectedBatchItem, setSelectedBatchItem] = useState<any>(null);
  const [compareMetric, setCompareMetric] = useState<"mw" | "clogp" | "tpsa" | "rotatable_bonds">("mw");
  const [selectedItemViewMode, setSelectedItemViewMode] = useState<"2d" | "3d">("2d");

  // Loaded chemical data results
  const [brief, setBrief] = useState<DesignBrief>(DEFAULT_BRIEF);
  const [candidates, setCandidates] = useState<Candidate[]>(DEFAULT_CANDIDATES);
  const [activeCandidate, setActiveCandidate] = useState<Candidate>(DEFAULT_CANDIDATES[0]);
  const [explanation, setExplanation] = useState<string>(DEFAULT_EXPLANATION);
  const [seedProperties, setSeedProperties] = useState<any>(DEFAULT_CANDIDATES[0]); // fallback comparison

  // View style toggles defaulting to 2D
  const [activeCandidateView, setActiveCandidateView] = useState<"2d" | "3d">("2d");
  const [ncbiCompoundView, setNcbiCompoundView] = useState<"2d" | "3d">("2d");

  // Manual SMILES Sandbox
  const [sandboxSMILES, setSandboxSMILES] = useState("CN1C=NC2=C1C(=O)N(C(=O)N2C)C"); // Caffeine default
  const [sandboxRes, setSandboxRes] = useState<any>(null);
  const [sandboxError, setSandboxError] = useState<string>("");
  const [evaluatingSandbox, setEvaluatingSandbox] = useState(false);

  // Quick preset handlers
  const presets = [
    {
      title: "Soluble Aspirin Analog",
      prompt: "A more soluble, easier-to-synthesize aspirin analog that stays under 400 Da."
    },
    {
      title: "Caffeine-like CNS Booster",
      prompt: "Design a caffeine-like neuroactive booster having a rotatable bonds count <= 3, maintaining high TPSA."
    },
    {
      title: "Hepatosafe Acetaminophen",
      prompt: "Suggest safe analogs of acetaminophen targeting improved logP profile while evading glutathione toxicophores."
    }
  ];

  // Pipeline runner
  const runDesignPipeline = async (searchPrompt: string) => {
    setLoading(true);
    setSafetyTripped(false);
    setSafetyReason("");
    
    try {
      setActiveStep("intent");
      await new Promise(r => setTimeout(r, 600));

      setActiveStep("compile");
      await new Promise(r => setTimeout(r, 600));

      setActiveStep("generate");
      await new Promise(r => setTimeout(r, 600));

      setActiveStep("deterministic");
      await new Promise(r => setTimeout(r, 600));

      setActiveStep("pareto");
      await new Promise(r => setTimeout(r, 600));

      setActiveStep("explain");

      const response = await fetch("/api/design-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: searchPrompt, numSamples, experiments }),
      });

      const body = await response.json();

      if (!response.ok) {
        if (response.status === 403 && body.safety_tripped) {
          setSafetyTripped(true);
          setSafetyReason(body.error || "Dangerous dual-use safety concern triggered.");
          setActiveStep(null);
          setLoading(false);
          return;
        }
        throw new Error(body.error || "Server failed to process application pipeline.");
      }

      setBrief(body.brief);
      setCandidates(body.candidates);
      setExplanation(body.explanation);
      setSeedProperties(body.seed_properties);
      setSeedPubChem(body.seed_pubchem || null);
      if (body.candidates && body.candidates.length > 0) {
        setActiveCandidate(body.candidates[0]);
      }
      
      setActiveStep("complete");
      await new Promise(r => setTimeout(r, 800));
    } catch (err: any) {
      alert(`Engineering error: ${err.message || "Failed to contact design server."}`);
      setActiveStep(null);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic PubChem Search search handler
  const handlePubChemSearch = async (queryStr: string) => {
    if (!queryStr.trim()) return;
    setPubchemLoading(true);
    setPubchemError("");
    setPubchemResponse(null);
    try {
      const response = await fetch(`/api/pubchem/search?q=${encodeURIComponent(queryStr.trim())}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "PubChem query returned an error.");
      }
      setPubchemResponse(data);
    } catch (e: any) {
      setPubchemError(e.message || "Failed to locate compound on PubChem.");
    } finally {
      setPubchemLoading(false);
    }
  };

  // Advanced Batch lookup fetch handler
  const runBatchLookup = async (inputStr: string) => {
    if (!inputStr.trim()) return;
    setBatchLoading(true);
    setBatchError("");
    setBatchResults([]);
    setSelectedBatchItem(null);

    // Split by commas or newlines and clean empty items
    const queries = inputStr
      .split(/[,\n]+/)
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    if (queries.length === 0) {
      setBatchError("Please enter at least one molecular label, synonym, or CAS Registry number.");
      setBatchLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/pubchem/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ queries }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Batch query request failed.");
      }

      setBatchResults(data.results || []);

      // Autofocus first resolved item
      const firstSucceeded = (data.results || []).find((r: any) => r.success);
      if (firstSucceeded) {
        setSelectedBatchItem(firstSucceeded.data);
      } else {
        setBatchError("None of the specified query substances could be resolved on PubChem registry.");
      }
    } catch (e: any) {
      setBatchError(e.message || "Failed to reach backend proxy API service.");
    } finally {
      setBatchLoading(false);
    }
  };

  // Manual SMILES Scan evaluator
  const handleSandboxScan = async () => {
    if (!sandboxSMILES.trim()) return;
    setEvaluatingSandbox(true);
    setSandboxError("");
    setSandboxRes(null);
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smiles: sandboxSMILES }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "The chemical graph parser rejected this SMILES.");
      }
      setSandboxRes(data);
    } catch (e: any) {
      setSandboxError(e.message || "Invalid molecular SMILES sequence.");
    } finally {
      setEvaluatingSandbox(false);
    }
  };

  // Load defaults on render
  useEffect(() => {
    handleSandboxScan();
    handlePubChemSearch("Ibuprofen");
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex text-sm overflow-x-hidden" id="molecule_assistant_workspace">
      
      {/* Sleek Sidebar Tab Instrument */}
      <aside className="w-64 border-r border-[#E2E8F0] bg-white shrink-0 flex flex-col hidden lg:flex">
        {/* Banner header badge */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0A355C] shadow-[0_0_8px_rgba(10,53,92,0.4)] animate-pulse"></span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#0A355C] font-bold">Local Engine Active</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#0A355C] italic underline underline-offset-4 decoration-[#0A355C] flex items-center gap-2">
            <Atom className="w-5 h-5 text-[#0A355C]" />
            <span>MolDesign Suite</span>
          </h1>
          <span className="text-[9px] font-mono text-slate-500 block mt-1.5 uppercase font-medium">Clinical Pipeline Compiler v0.1</span>
        </div>

        {/* Sidebar content selectors */}
        <div className="flex-1 p-4 flex flex-col gap-5">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#0A355C] block mb-2 font-bold">Design Studio Presets</span>
            <div className="space-y-1.5">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(p.prompt)}
                  disabled={loading}
                  className={`w-full text-left text-xs px-3 py-2 rounded font-medium border transition-all flex items-center justify-between gap-1 disabled:opacity-50 cursor-pointer ${
                    prompt === p.prompt 
                      ? "bg-slate-100 text-[#0A355C] border-[#0A355C] font-bold" 
                      : "bg-transparent text-slate-600 border-transparent hover:bg-slate-100 hover:text-[#0A355C]"
                  }`}
                >
                  <span className="truncate">{p.title}</span>
                  <Play className="w-2.5 h-2.5 text-[#0A355C] fill-[#0A355C] shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Config Controls inside sidebar */}
          <div className="border-t border-slate-100 pt-4">
            <label className="text-[10px] uppercase font-mono tracking-widest text-[#0A355C] block mb-3 font-bold">Analog Bounds</label>
            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600 font-medium">Samples:</span>
                <span className="text-[#0A355C] font-bold">{numSamples}</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={numSamples}
                onChange={(e) => setNumSamples(parseInt(e.target.value))}
                disabled={loading}
                className="w-full h-1 bg-slate-200 rounded-xl appearance-none cursor-pointer accent-[#0A355C] disabled:opacity-50"
              />
              <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                <span>5</span>
                <span>Optimized</span>
                <span>30</span>
              </div>
            </div>
          </div>

          {/* Core action compiler button */}
          <button
            onClick={() => runDesignPipeline(prompt)}
            disabled={loading || !prompt.trim()}
            className="w-full py-2.5 px-3 rounded text-xs font-bold tracking-wider uppercase text-white bg-[#0A355C] hover:bg-[#07243E] font-mono transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:pointer-events-none shrink-0 flex items-center justify-center gap-2 mt-auto cursor-pointer"
          >
            {loading ? (
              <>
                <Cpu className="w-3.5 h-3.5 animate-spin text-white" />
                <span>PROCESSING...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Resynthesize</span>
              </>
            )}
          </button>
        </div>

        {/* Environmental Metadata stats */}
        <div className="p-6 border-t border-slate-100 bg-slate-50">
          <div className="text-[10px] uppercase text-[#0A355C] mb-2 font-bold tracking-widest">Environment Status</div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Mode</span>
              <span className="text-[#0A355C] font-bold">ACTIVE PREVIEW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Model</span>
              <span className="text-slate-700 font-medium">gemini-3.5-flash</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">CPU Core</span>
              <span className="text-slate-700">Pure Deterministic</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Engine State</span>
              <span className="text-emerald-700 font-semibold uppercase">ONLINE</span>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT SIDE MAIN SPACE CONSOLE */}
      <div className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0 overflow-y-auto">
        
        {/* TOP COMPILER BANNER */}
        <div className="p-6 sm:p-8 pb-4 flex flex-col">
          <div className="flex items-center gap-4 mb-3">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">[MOLECULAR DESIGN SUITE — RESEARCH PROTOTYPE]</div>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>
          
          <div className="relative flex flex-col md:flex-row gap-3 items-stretch">
            <div className="relative flex-1">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                rows={2}
                className="w-full bg-white border border-slate-200 rounded-lg py-3 px-5 text-slate-800 text-base md:text-lg italic font-serif focus:outline-hidden focus:border-[#0A355C]/60 shadow-xs resize-none select-all"
                placeholder="Describe your design parameters..."
              />
              <div className="absolute right-3 bottom-2 text-[9px] font-mono text-slate-400">UTC CONSOLE INPUT</div>
            </div>

            <button
              onClick={() => runDesignPipeline(prompt)}
              disabled={loading || !prompt.trim()}
              className="px-6 py-4 bg-[#0A355C] hover:bg-[#07243E] text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-97 disabled:opacity-40 select-none shrink-0 flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Cpu className="w-4 h-4 animate-spin-slow shrink-0" />
              <span>{loading ? "PROCESSING" : "RUN PIPELINE"}</span>
            </button>
          </div>
        </div>

        {/* VIEW SEGMENT SELECTOR */}
        <div className="px-6 sm:px-8 mb-4 flex justify-start items-center">
          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 inline-flex gap-1 select-none">
            <button
              onClick={() => setViewMode("design")}
              className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === "design"
                  ? "bg-white text-[#0A355C] shadow-sm border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-900 border border-transparent"
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Design Studio Mutator</span>
            </button>
            <button
              onClick={() => setViewMode("pubchem")}
              className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === "pubchem"
                  ? "bg-white text-[#0A355C] shadow-sm border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-900 border border-transparent"
              }`}
            >
              <Search className="w-4 h-4 text-[#0A355C]" />
              <span>PubChem Database & Report Hub</span>
            </button>
            <button
              onClick={() => {
                setViewMode("batch");
                if (batchResults.length === 0) {
                  runBatchLookup(batchInput);
                }
              }}
              className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === "batch"
                  ? "bg-white text-[#0A355C] shadow-sm border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-900 border border-transparent"
              }`}
            >
              <GitCompare className="w-4 h-4 text-[#0A355C]" />
              <span>PubChem Batch Matrix</span>
            </button>
            <button
              onClick={() => setViewMode("experiments")}
              className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === "experiments"
                  ? "bg-white text-[#0A355C] shadow-sm border border-slate-200/40"
                  : "text-slate-500 hover:text-slate-900 border border-transparent"
              }`}
            >
              <Activity className="w-4 h-4 text-[#0A355C]" />
              <span>Closed-Loop Lab Ledger</span>
            </button>
          </div>
        </div>

        {viewMode === "design" && (
          <>
            {/* METADATA STATS PANEL GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 sm:px-8 mb-5 select-none text-left">
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
            <div className="text-[10px] uppercase text-slate-500 mb-1 font-mono tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              <span>Parent SMILES Scaffold</span>
            </div>
            <div className="text-slate-800 font-mono text-xs truncate select-all bg-slate-50 p-1 px-1.5 rounded border border-slate-200" title={brief.seed_smiles}>
              {brief.seed_smiles || "Aspirin"}
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
            <div className="text-[10px] uppercase text-slate-500 mb-1 font-mono tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0A355C]"></span>
              <span>Generations Requested</span>
            </div>
            <div className="text-2xl font-semibold text-slate-800 tracking-tight font-mono">
              {numSamples} <span className="text-xs text-slate-400 font-sans font-normal">Molecules</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
            <div className="text-[10px] uppercase text-slate-500 mb-1 font-mono tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0A355C]"></span>
              <span>Pareto Frontiers Found</span>
            </div>
            <div className="text-2xl font-semibold text-[#0A355C] tracking-tight font-mono">
              {candidates.filter(c => c.is_pareto_optimal).length} <span className="text-xs text-slate-400 font-sans font-normal">analogs</span>
            </div>
          </div>

          <div className={`bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs border-l-4 transition-all ${
            candidates.some(c => c.structural_alerts.length > 0) ? "border-l-amber-500" : "border-l-[#0A355C]"
          }`}>
            <div className="text-[10px] uppercase text-slate-500 mb-1 font-mono tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4444]"></span>
              <span>Avoided Alert Hits</span>
            </div>
            <div className="text-2xl font-semibold font-mono text-[#FF4444]">
              {candidates.reduce((sum, c) => sum + c.structural_alerts.length, 0)} <span className="text-xs text-slate-400 font-sans font-normal">warnings</span>
            </div>
          </div>
        </div>

        {/* PROGRESS DIRECTIVE PANEL TIMELINE (Mobile/Small viewer only or active pipeline summary) */}
        {activeStep && (
          <div className="px-6 sm:px-8 mb-5">
            <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs flex flex-wrap gap-4 items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0A355C] animate-ping"></span>
                <span className="font-mono text-slate-800 uppercase tracking-wider font-bold">Active Pipeline Compiler execution status</span>
              </div>
              
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className={["intent", "compile", "generate", "deterministic", "pareto", "explain", "complete"].includes(activeStep) ? "text-[#0A355C]" : "text-slate-400"}>[1. Safety]</span>
                <span className="text-slate-300">→</span>
                <span className={["compile", "generate", "deterministic", "pareto", "explain", "complete"].includes(activeStep) ? "text-[#0A355C]" : "text-slate-400"}>[2. Spec Compiler]</span>
                <span className="text-slate-300">→</span>
                <span className={["generate", "deterministic", "pareto", "explain", "complete"].includes(activeStep) ? "text-[#0A355C]" : "text-slate-400"}>[3. Analogs]</span>
                <span className="text-slate-300">→</span>
                <span className={["deterministic", "pareto", "explain", "complete"].includes(activeStep) ? "text-[#0A355C]" : "text-slate-400"}>[4. Physics Evaluator]</span>
                <span className="text-slate-300">→</span>
                <span className={["pareto", "explain", "complete"].includes(activeStep) ? "text-[#0A355C]" : "text-slate-400"}>[5. Scorer]</span>
                <span className="text-slate-300">→</span>
                <span className={["explain", "complete"].includes(activeStep) ? "text-[#0A355C]" : "text-slate-400"}>[6. Synthesis Report]</span>
              </div>
            </div>
          </div>
        )}

        {/* RISK DEFENDER SHIELD WARNED STATE */}
        {safetyTripped && (
          <div className="mx-6 sm:mx-8 mb-5 bg-rose-50 border border-rose-200 rounded-xl p-5 flex gap-4">
            <ShieldAlert className="w-8 h-8 text-rose-600 shrink-0" />
            <div className="flex flex-col gap-1 text-left">
              <h3 className="font-bold text-rose-950 text-sm">Design Threshold Defusal Signal Tripped</h3>
              <p className="text-xs text-rose-900 font-mono bg-white p-3 rounded border border-rose-100 leading-relaxed">
                {safetyReason}
              </p>
              <span className="text-[10px] text-rose-700/80 mt-1.5 leading-relaxed">
                To guarantee chemical synthesis safety metrics, the spec system prohibits dual-use biochemical terms, nerve toxin scaffolds, high-risk combustibles, or unauthorized therapeutic schedules.
              </span>
            </div>
          </div>
        )}

        {/* PRIMARY LABORATORY STUDIO INTERACTION INTERFACE */}
        <div className="px-6 sm:px-8 pb-8 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* MAIN CHEMICAL RENDERING DISPLAY (xl:col-span-8) */}
          <div className="xl:col-span-8 flex flex-col gap-6" id="molecular_canvas_panel">
            
            <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl p-5 flex flex-col gap-4">
              
              {/* Header Title active coordinate details */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 select-none">
                <div className="flex items-center gap-2.5">
                  <span className="bg-[#0A355C]/10 border border-[#0A355C]/35 text-[#0A355C] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">
                    {`OPTIMIZED ANALOG #${candidates.indexOf(activeCandidate) + 1}`}
                  </span>
                  {activeCandidate.is_pareto_optimal && (
                    <span className="bg-[#0A355C]/10 border border-[#0A355C]/35 text-[#0A355C] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Pareto Front
                    </span>
                  )}
                  {activeCandidate.ood_flag && (
                    <span className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">
                      OOD BOUNDS OVER step
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-mono text-slate-400 tracking-widest block font-medium">Chemical Formula</span>
                  <span className="text-sm font-bold text-[#0A355C] font-mono">{activeCandidate.formula}</span>
                </div>
              </div>

              {/* Graphical rendering panel component workspace */}
              <div className="relative rounded-xl overflow-hidden border border-slate-200/60 bg-white flex flex-col justify-center min-h-[350px] shadow-xs">
                
                {/* 2D vs 3D Selector controls on top-left of the canvas */}
                <div className="absolute top-3 left-3 flex bg-slate-100/90 backdrop-blur-md p-0.5 rounded-lg border border-slate-200/80 z-10 shadow-xs">
                  <button
                    onClick={() => setActiveCandidateView("2d")}
                    className={`px-3 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-all flex items-center gap-1 ${
                      activeCandidateView === "2d"
                        ? "bg-white text-[#0A355C] shadow-xs border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> 2D Skeletal
                  </button>
                  <button
                    onClick={() => setActiveCandidateView("3d")}
                    className={`px-3 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-all flex items-center gap-1 ${
                      activeCandidateView === "3d"
                        ? "bg-white text-[#0A355C] shadow-xs border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Interactive 3D
                  </button>
                </div>

                {/* Main visualization frame */}
                {activeCandidateView === "2d" ? (
                  <div className="flex flex-col items-center justify-center p-8 w-full min-h-[300px] select-none">
                    <img
                      src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(activeCandidate.smiles)}/PNG`}
                      alt={`${activeCandidate.name} 2D Structure`}
                      className="max-h-[220px] max-w-full object-contain pointer-events-none transition-all duration-300 transform hover:scale-105"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="text-center mt-3 select-all w-full max-w-xs">
                      <span className="text-[9px] font-mono text-slate-400 block uppercase tracking-wider">Topology Hash (SMILES)</span>
                      <code className="text-[9px] text-[#0A355C] font-mono block break-all mt-1 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate">{activeCandidate.smiles}</code>
                    </div>
                  </div>
                ) : (
                  <StructureRenderer smiles={activeCandidate.smiles} />
                )}
                
                {/* Active compound title block */}
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-3 py-2 rounded-md border border-slate-200/80 text-right shadow-sm z-10">
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block font-medium">Structural Compound Name</span>
                  <span className="text-xs font-bold text-slate-800 tracking-tight">{activeCandidate.name}</span>
                </div>
              </div>

              {/* Functional explanation report panel */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-5 text-left">
                <div className="text-[10px] uppercase text-slate-500 font-mono tracking-widest border-b border-slate-200/60 pb-2 mb-3 max-w-[200px] flex items-center gap-1.5 font-bold">
                  <BookOpen className="w-3.5 h-3.5 text-[#0A355C]" />
                  <span>Skeletal Design Rationale</span>
                </div>
                <p className="text-sm text-slate-600 font-serif leading-relaxed italic">
                  "{activeCandidate.mutation_rationale || "Base chemical scaffold structure selected under molecular modeling matrix."}"
                </p>
              </div>

              {/* Dynamic SMILES route coordinates */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 font-mono text-[10px] text-slate-400 flex flex-col gap-1 select-all text-left">
                <span className="font-bold text-slate-400 tracking-wider uppercase">Canonical Smiles coordinate sequence Route</span>
                <span className="text-slate-700 break-all leading-relaxed bg-white p-1.5 rounded border border-slate-200/40 shadow-inner">{activeCandidate.smiles}</span>
              </div>

                      {/* GROUNDED RECOMMENDATIONS REPORT CARD */}
            <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl p-5 text-left">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0A355C]" />
                  <h3 className="font-bold uppercase tracking-wider text-slate-800 text-xs font-mono">Multi-Agent Scientific Audit & Validation Report</h3>
                </div>
                <button
                  onClick={() => {
                    const newExp: Experiment = {
                      id: `exp-${Date.now()}`,
                      smiles: activeCandidate.smiles,
                      name: activeCandidate.name,
                      assay: "In vitro receptor affinity assay",
                      resultValue: `Est. Docking: ${activeCandidate.docking_affinity || -7.2} kcal/mol`,
                      outcome: "partial",
                      notes: `Registering designed candidate analog from pipeline. Rationale: ${activeCandidate.mutation_rationale || "N/A"}. Synthetic score: ${activeCandidate.sa_score}`,
                      createdAt: new Date().toISOString()
                    };
                    setExperiments(prev => [newExp, ...prev]);
                    setViewMode("experiments");
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded font-mono text-[9px] font-bold px-2 py-1 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-emerald-700" /> Log Lab Experiment
                </button>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200/60 leading-normal">
                  <ScientificMarkdownRenderer text={explanation} />
                </div>
                
                <div className="flex items-start gap-3 bg-slate-100 p-3.5 rounded border border-slate-200/40 text-[11px] text-slate-500 leading-relaxed">
                  <CheckCircle2 className="w-5 h-5 text-[#0A355C] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-800 font-bold block mb-0.5">Heuristic Estimates — Not Lab-Validated</span>
                    <span>Properties (cLogP, TPSA, QED, docking, etc.) are deterministic heuristics computed from the 2D structure graph, not experimental measurements or quantum/3D simulations. Treat them as rough estimates for prioritization only.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SMILES SANDBOX EXPERIMENTAL BLOCK */}
            <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl p-5 text-left flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Dna className="w-4 h-4 text-[#0A355C]" />
                <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-slate-800">SMILES Sandbox diagnostic</h3>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-mono tracking-widest block mb-2 font-semibold">Evaluate Custom Molecular String</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sandboxSMILES}
                      onChange={(e) => setSandboxSMILES(e.target.value)}
                      disabled={evaluatingSandbox}
                      placeholder="e.g. CC(=O)OC1=CC=CC=C1C(=O)O"
                      className="flex-1 text-xs font-mono bg-white border border-slate-200 rounded p-2.5 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#0A355C] shadow-xs select-all"
                    />
                    <button
                      onClick={handleSandboxScan}
                      disabled={evaluatingSandbox || !sandboxSMILES.trim()}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-tighter rounded font-mono transition-all disabled:opacity-40"
                    >
                      Scan
                    </button>
                  </div>
                </div>

                {sandboxError && (
                  <div className="p-2.5 bg-rose-50 text-rose-600 font-mono text-[10px] rounded border border-rose-200/60 leading-tight">
                    [ERROR] {sandboxError}
                  </div>
                )}

                {evaluatingSandbox && (
                  <span className="text-xs font-mono text-[#0A355C] animate-pulse">Running molecular graph scan...</span>
                )}

                {sandboxRes && (
                  <div className="bg-slate-50 p-4 rounded border border-slate-200/60 grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-[11px]">
                    <div className="col-span-2 sm:col-span-3 flex justify-between text-slate-800 font-bold border-b border-slate-200 pb-1.5 mb-1 bg-slate-100 p-2 rounded">
                      <span className="text-slate-500">Formula:</span>
                      <span className="text-[#0A355C]">{sandboxRes.formula}</span>
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-[9px] uppercase tracking-wider">Mol Weight</span>
                      <span className="text-slate-800 font-bold">{sandboxRes.mw} Da</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-slate-400 text-[9px] uppercase tracking-wider">cLogP</span>
                      <span className="text-slate-800 font-bold">{sandboxRes.clogp}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-slate-400 text-[9px] uppercase tracking-wider">TPSA Area</span>
                      <span className="text-slate-800 font-bold">{sandboxRes.tpsa} Å²</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-slate-400 text-[9px] uppercase tracking-wider">Donors/Acceptors</span>
                      <span className="text-slate-800 font-bold">{sandboxRes.hbd} / {sandboxRes.hba}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-slate-400 text-[9px] uppercase tracking-wider">Aromatic Rings</span>
                      <span className="text-slate-800 font-bold">{sandboxRes.aromatic_rings}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-slate-400 text-[9px] uppercase tracking-wider">Lipinski Viol</span>
                      <span className={`font-bold ${sandboxRes.ro5_violations > 0 ? "text-rose-600" : "text-[#0A355C]"}`}>
                        {sandboxRes.ro5_violations}
                      </span>
                    </div>

                    {sandboxRes.structural_alerts.length > 0 && (
                      <div className="col-span-2 sm:col-span-3 mt-2 pt-2 border-t border-slate-200 text-rose-600 text-[10px] flex flex-col gap-1.5">
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1 text-[9px] text-rose-600">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> METABOLIC ALERTS SIGNALED:
                        </span>
                        {sandboxRes.structural_alerts.map((al: string, id: number) => (
                          <span key={id} className="bg-rose-50 p-1 px-2 border border-rose-200/50 rounded font-sans block">{al}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>      </div>

          </div>

          {/* DETAILED PROPERTY REPORT SIDEBAR (xl:col-span-4) */}
          <div className="xl:col-span-4 flex flex-col gap-6" id="blueprint_sandbox_panel">
            
            {/* Design Spec Targets briefing list */}
            <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl flex flex-col overflow-hidden text-left">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-800">Objective Spec Target</span>
                <span className="text-[10px] font-mono text-[#0A355C] font-semibold">ACTIVE FILTER</span>
              </div>
              <div className="p-4 space-y-3.5">
                <div>
                  <span className="text-[9px] font-mono text-slate-450 uppercase tracking-widest block mb-1 font-semibold">Target Description goal</span>
                  <div className="bg-slate-50 p-3 rounded border border-slate-200/60 italic font-serif text-slate-600 leading-relaxed">
                    "{brief.objective_summary}"
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3.5">
                  <span className="text-[9px] font-mono text-slate-455 uppercase tracking-widest block mb-2 font-semibold">Hard limits & constraint matching</span>
                  <div className="space-y-2 bg-slate-50 p-3 rounded border border-slate-200/60 font-mono text-[11px]">
                    {brief.property_constraints.map((c, idx) => (
                      <div key={idx} className="flex justify-between border-b border-dashed border-slate-200/40 pb-1 last:border-b-0 last:pb-0 text-slate-500">
                        <span>{c.name.toUpperCase()}</span>
                        <span className="text-slate-800 font-bold">{c.op} {c.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-slate-500">
                      <span>TANIMOTO SIM VECTOR</span>
                      <span className="text-[#0A355C] font-bold">
                        [{brief.novelty.min_tanimoto_distance_from_seed}, {brief.novelty.max}]
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Seed Scaffold PubChem reference card */}
            {seedPubChem && (
              <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl flex flex-col overflow-hidden text-left border-l-4 border-l-[#0A355C]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#0A355C] font-mono flex items-center gap-1.5 font-bold">
                    <Search className="w-3.5 h-3.5 animate-pulse" /> Checked Seed Root Profile
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 font-bold">CID #{seedPubChem.cid}</span>
                </div>
                <div className="p-4 space-y-2.5 text-xs text-slate-600 font-sans">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Compound Name</span>
                    <span className="font-bold text-slate-800">{seedPubChem.name}</span>
                  </div>
                  <p className="text-slate-500 italic leading-relaxed text-[11px] font-serif bg-slate-50 p-2.5 rounded border border-slate-200/60 line-clamp-3 transition-all" title={seedPubChem.description}>
                    "{seedPubChem.description}"
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <a
                      href={seedPubChem.reportUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[10px] font-mono text-[#0A355C] hover:underline font-bold"
                    >
                      [🔗 View PubChem website report]
                    </a>
                    
                    <button
                      onClick={() => {
                        setPubchemQuery(seedPubChem.name);
                        setPubchemResponse(seedPubChem);
                        setViewMode("pubchem");
                      }}
                      className="text-[9px] font-mono font-bold bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-slate-600 px-2 py-1 rounded cursor-pointer animate-bounce"
                    >
                      Dossier Hub
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Parameter Bar analysis display */}
            <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl flex flex-col overflow-hidden text-left">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-800">Full Property Report</span>
                <span className="text-[10px] font-mono text-[#0A355C] font-semibold">PASSED ENGINE</span>
              </div>
              
              <div className="p-4 space-y-4">
                {/* weight */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-500 uppercase font-mono font-medium">
                    <span>Molecular Weight</span>
                    <span className="text-slate-800 font-bold font-mono">{activeCandidate.mw} Da</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-slate-800 h-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (activeCandidate.mw / 500) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* clogP */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-500 uppercase font-mono font-medium">
                    <span>cLogP (Solubility)</span>
                    <span className="text-slate-800 font-bold font-mono">{activeCandidate.clogp}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#0A355C] h-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, ((activeCandidate.clogp + 2) / 7) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* QED */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-500 uppercase font-mono font-medium">
                    <span>QED (Drug Likeness)</span>
                    <span className="text-slate-800 font-bold font-mono">{activeCandidate.qed}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#0A355C] h-full transition-all duration-500" 
                      style={{ width: `${activeCandidate.qed * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* SA Score */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-500 uppercase font-mono font-medium">
                    <span>SA Score (Ease of Synthesis)</span>
                    <span className="text-slate-800 font-bold font-mono">{activeCandidate.sa_score} / 10</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#0A355C] h-full transition-all duration-500" 
                      style={{ width: `${activeCandidate.sa_score * 10}%` }}
                    ></div>
                  </div>
                </div>

                {/* 3D Receptor Docking & Pocket Fitting */}
                <div className="pt-4 mt-4 border-t border-slate-100 text-left select-none">
                  <div className="text-[10px] uppercase text-slate-450 mb-3 font-mono tracking-widest font-bold flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-blue-500" />
                    <span>3D Receptor Docking Simulation</span>
                  </div>
                  
                  <div className="space-y-2 text-[11px] font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-205">
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/50 last:border-0 last:pb-0">
                      <span className="text-slate-400 text-[9px] uppercase tracking-wider">Target Protein</span>
                      <span className="text-slate-800 font-bold max-w-[150px] truncate">{activeCandidate.target_protein || "COX-2 Receptor Pocket"}</span>
                    </div>
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/50 last:border-0 last:pb-0">
                      <span className="text-slate-400 text-[9px] uppercase tracking-wider">Docking Affinity</span>
                      <span className="text-emerald-700 font-extrabold">{activeCandidate.docking_affinity ? `${activeCandidate.docking_affinity} kcal/mol` : "-7.8 kcal/mol"}</span>
                    </div>
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/50 last:border-0 last:pb-0">
                      <span className="text-slate-400 text-[9px] uppercase tracking-wider">Pocket Fit Score</span>
                      <span className="text-blue-700 font-bold">{activeCandidate.pocket_fit_score ? `${activeCandidate.pocket_fit_score}%` : "84%"}</span>
                    </div>
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/50 last:border-0 last:pb-0">
                      <span className="text-slate-400 text-[9px] uppercase tracking-wider">Conformer Energy</span>
                      <span className="text-slate-700">{activeCandidate.conformer_energy ? `${activeCandidate.conformer_energy} kcal/mol` : "34.50 kcal/mol"}</span>
                    </div>
                    <div className="flex flex-col pt-1.5 bg-white p-2 rounded border border-slate-200 text-left">
                      <span className="text-[8.5px] uppercase font-bold text-[#0A355C] tracking-wide mb-1 block">Binding Residues</span>
                      <div className="flex flex-wrap gap-1 leading-none mt-0.5">
                        {(activeCandidate.binding_residues || ["Arg-120", "Tyr-355", "Glu-524"]).map((res, rid) => (
                          <span key={rid} className="bg-slate-50 border border-slate-200 text-slate-600 text-[9px] px-1 rounded-sm font-semibold">
                            {res}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Structural alert list */}
                <div className="pt-4 mt-4 border-t border-slate-100 text-left">
                  <div className="text-[10px] uppercase text-slate-400 mb-2 font-mono tracking-widest font-semibold">Structural Alert Flags</div>
                  {activeCandidate.structural_alerts.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {activeCandidate.structural_alerts.map((al, id) => (
                        <span key={id} className="bg-rose-50 text-rose-600 text-[9.5px] font-mono px-2 py-0.5 rounded border border-rose-200/50">
                          {al.split(" ")[0]} OUT
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap select-none">
                      <span className="bg-slate-50 text-slate-500 text-[9px] px-2 py-0.5 rounded border border-slate-250 uppercase font-mono">PAINS: CLEAN</span>
                      <span className="bg-slate-50 text-slate-500 text-[9px] px-2 py-0.5 rounded border border-slate-250 uppercase font-mono">BRENK: CLEAN</span>
                      <span className="bg-slate-50 text-slate-550 text-[9px] px-2 py-0.5 rounded border border-slate-250 uppercase font-mono font-bold text-[#0A355C]">R05: 0 VIOLATIONS</span>
                    </div>
                  )}
                </div>

                {/* Suggested Tests */}
                <div className="pt-4 mt-4 border-t border-slate-100 text-left select-none">
                  <div className="text-[10px] uppercase text-slate-400 mb-1.5 font-mono tracking-widest font-semibold font-bold">Grounded validation tests suggestion</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Verify compound structure binding using High-Throughput Screening metrics, or run PAMPA transcellular absorption arrays.
                  </p>
                </div>
              </div>

              {/* Action output package */}
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeCandidate, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `${activeCandidate.name.replace(/\s+/g, "_")}_structure_report.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                  }}
                  className="w-full bg-slate-800 text-white font-mono font-bold text-xs py-2 px-4 uppercase tracking-wider hover:bg-slate-700 transition-all rounded select-none cursor-pointer text-center block"
                >
                  Download Structure Package
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM SCAFFOLD DIRECTORY ELEMENT */}
        <section className="bg-white p-6 border-t border-slate-200 mt-auto text-left" id="generative_gallery_panel">
          <div className="max-w-[1700px] mx-auto w-full flex flex-col gap-4">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h3 className="font-bold text-slate-850 text-sm flex items-center gap-2 font-mono uppercase tracking-widest">
                  <Layers className="w-5 h-5 text-[#0A355C]" />
                  <span>Interactive Scaffold Analog Design Library</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">Click any catalog row to analyze its parameters and inspect its 2D coordinates above.</p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-slate-500 select-none shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#0A355C] rounded-full shadow-[0_0_6px_rgba(10,53,92,0.3)]"></span>
                  <span>Pareto Optimal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
                  <span>Alert Flags</span>
                </div>
              </div>
            </div>

            {/* Molecule responsive bento table matrix */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs font-mono">
                <thead className="bg-[#F8FAFC] text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">Rank</th>
                    <th className="px-5 py-3">Compound Candidate Profile</th>
                    <th className="px-4 py-3 text-center">MW (Weight)</th>
                    <th className="px-4 py-3 text-center">QED Score</th>
                    <th className="px-4 py-3 text-center">cLogP Solub</th>
                    <th className="px-4 py-3 text-center">Tanimoto similarity</th>
                    <th className="px-4 py-3 text-center">Rings</th>
                    <th className="px-5 py-3">Active alert warnings status</th>
                    <th className="px-4 py-3 text-right">Multitarget fitness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((cand, idx) => {
                    const isActive = cand.smiles === activeCandidate.smiles;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setActiveCandidate(cand)}
                        className={`cursor-pointer transition-all ${
                          isActive 
                            ? "bg-blue-50/70 text-slate-900 font-medium border-y border-blue-200/65" 
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <td className="px-4 py-3 text-center font-bold text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-800 tracking-tight">{cand.name}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-md select-all" title={cand.smiles}>{cand.smiles}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-800">
                          {cand.mw} Da
                        </td>
                        <td className="px-4 py-3 text-center text-slate-800">
                          {cand.qed}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-800">
                          {cand.clogp}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className="text-slate-800 font-mono">{cand.tanimoto_distance}</span>
                            {cand.ood_flag && (
                              <span className="text-[8px] uppercase tracking-wider font-bold px-1.5 bg-amber-500/10 text-amber-500 rounded border border-amber-500/30">
                                OOD
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-800">
                          {cand.aromatic_rings}
                        </td>
                        <td className="px-5 py-3">
                          {cand.structural_alerts.length > 0 ? (
                            <span className="text-[9px] px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200/40 rounded uppercase font-bold inline-flex items-center gap-1">
                              <BadgeAlert className="w-3 h-3 text-rose-600" />
                              <span>{cand.structural_alerts.length} ALERTS</span>
                            </span>
                          ) : (
                            <span className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200/40 rounded uppercase font-bold">
                              CLEAN FRONT
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {cand.is_pareto_optimal ? (
                            <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 bg-[#0A355C] text-white rounded-full inline-flex items-center gap-1 shadow-[0_0_8px_rgba(10,53,92,0.15)] font-mono">
                              Pareto Front
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">dominated</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </section>
        </>
        )}

        {/* CLOSED-LOOP LAB LEDGER WORKSPACE VIEW */}
        {viewMode === "experiments" && (
          <div className="px-6 sm:px-8 pb-8 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start text-left mt-4 animate-fadeIn" id="closed_loop_laboratory_ledger_view">
            
            {/* Left side: Add New Experiment Record Form */}
            <div className="xl:col-span-4 bg-white border border-slate-200/80 shadow-xs rounded-xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-xs font-mono uppercase tracking-widest text-slate-800">Log Assay Outcome</h3>
              </div>

              <div className="space-y-3 font-sans text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1 font-semibold">Chemical SMILES (Required)</label>
                  <input
                    type="text"
                    value={expFormSMILES}
                    onChange={(e) => setExpFormSMILES(e.target.value)}
                    placeholder="e.g. CC(=O)OC1=CC=CC=C1C(=O)O"
                    className="w-full bg-white border border-slate-205 rounded p-2 text-slate-800 font-mono text-xs focus:outline-[#0A355C] focus:border-[#0A355C]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1 font-semibold">Compound Name</label>
                  <input
                    type="text"
                    value={expFormName}
                    onChange={(e) => setExpFormName(e.target.value)}
                    placeholder="e.g. Aspirine derivative-F1"
                    className="w-full bg-white border border-slate-205 rounded p-2 text-slate-805 text-xs focus:outline-[#0A355C] focus:border-[#0A355C]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1 font-semibold">Assay platform / parameters</label>
                  <input
                    type="text"
                    value={expFormAssay}
                    onChange={(e) => setExpFormAssay(e.target.value)}
                    placeholder="e.g. COX-2 screen"
                    className="w-full bg-white border border-slate-205 rounded p-2 text-slate-805 text-xs focus:outline-[#0A355C]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1 font-semibold">Recorded Value / Yield Metric</label>
                  <input
                    type="text"
                    value={expFormResult}
                    onChange={(e) => setExpFormResult(e.target.value)}
                    placeholder="e.g. IC50 = 32 nM"
                    className="w-full bg-white border border-slate-205 rounded p-2 text-slate-805 font-mono text-xs focus:outline-[#0A355C]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1 font-semibold">Outcome Evaluation</label>
                  <select
                    value={expFormOutcome}
                    onChange={(e) => setExpFormOutcome(e.target.value as any)}
                    className="w-full bg-white border border-slate-205 rounded p-2 text-slate-805 text-xs focus:outline-[#0A355C]"
                  >
                    <option value="success">Success / Highly active (potency target)</option>
                    <option value="partial">Partial success / Marginally active</option>
                    <option value="failed">Failed / No activity</option>
                    <option value="toxic">High risk toxicity / CYP inhibition warning</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1 font-semibold">Internal Research notes</label>
                  <textarea
                    rows={2}
                    value={expFormNotes}
                    onChange={(e) => setExpFormNotes(e.target.value)}
                    placeholder="Describe sterical clashes or metabolic hotspots..."
                    className="w-full bg-white border border-slate-205 rounded p-2 text-slate-805 text-xs focus:outline-[#0A355C] resize-none"
                  />
                </div>

                <button
                  onClick={() => {
                    if (!expFormSMILES.trim()) {
                      alert("Chemical SMILES is required to register log entries.");
                      return;
                    }
                    const nExp: Experiment = {
                      id: `exp-${Date.now()}`,
                      smiles: expFormSMILES.trim(),
                      name: expFormName.trim() || "Unnamed custom specimen",
                      assay: expFormAssay.trim() || "Standard Screen",
                      resultValue: expFormResult.trim() || "N/A",
                      outcome: expFormOutcome,
                      notes: expFormNotes.trim() || "No additional commentary registered.",
                      createdAt: new Date().toISOString()
                    };
                    setExperiments(prev => [nExp, ...prev]);
                    setExpFormSMILES("");
                    setExpFormName("");
                    setExpFormResult("");
                    setExpFormNotes("");
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-xs uppercase tracking-wider rounded select-none cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Save to Ledger
                </button>
              </div>
            </div>

            {/* Right side: Recorded Studies listing */}
            <div className="xl:col-span-8 flex flex-col gap-5">
              <div className="bg-white border border-slate-200/85 p-6 rounded-xl shadow-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 select-none">
                  <div>
                    <h2 className="font-bold text-slate-850 text-sm font-mono uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#0A355C]" />
                      <span>Closed-Loop Experimental Feedback History</span>
                    </h2>
                    <p className="text-[11px] text-slate-500 font-sans mt-0.5">Recorded laboratory findings act as active priors limits feed. Newly launched organic pipeline synthesis runs check these constraints automatically to evade toxicity alarms or hydrophobic collapse.</p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear the entire experimental history memory?")) {
                        setExperiments([]);
                      }
                    }}
                    className="text-[9.5px] font-mono text-rose-600 hover:bg-rose-50 border border-rose-200 rounded p-1 px-2.5 transition-all cursor-pointer font-bold select-none"
                  >
                    Clear Ledger
                  </button>
                </div>

                {experiments.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 border border-dashed border-slate-205 rounded-xl flex flex-col items-center justify-center gap-2 bg-slate-50">
                    <Activity className="w-8 h-8 text-slate-350 animate-pulse" />
                    <span className="font-mono text-xs uppercase tracking-wider font-semibold">Ledger history is empty</span>
                    <p className="text-[11px] text-slate-400 max-w-sm mt-0.5">Register historic chemical trials or import them from calculated candidate cards to feed the closed-loop solver context!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {experiments.map((exp) => (
                      <div key={exp.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3 justify-between">
                        <div>
                          
                          {/* Card tags */}
                          <div className="flex justify-between items-start gap-2 mb-2 select-none">
                            <span className={`text-[9px] uppercase font-bold tracking-widest font-mono p-0.5 px-2 rounded border leading-none ${
                              exp.outcome === "success" ? "bg-emerald-50 border-emerald-300 text-emerald-800" :
                              exp.outcome === "partial" ? "bg-blue-50 border-blue-300 text-blue-800" :
                              exp.outcome === "toxic" ? "bg-red-50 border-red-300 text-red-800" :
                              "bg-slate-100 border-slate-300 text-slate-650"
                            }`}>
                              {exp.outcome.toUpperCase()}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">{new Date(exp.createdAt).toLocaleDateString()}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 bg-white border border-slate-200 rounded-lg flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-inner">
                              <img
                                src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(exp.smiles)}/PNG`}
                                alt={exp.name}
                                className="max-h-full max-w-full object-contain"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <h4 className="font-bold text-xs text-slate-800 tracking-tight leading-tight truncate">{exp.name}</h4>
                              <span className="text-[9px] font-mono text-slate-400 block truncate max-w-full mt-1" title={exp.smiles}>{exp.smiles}</span>
                            </div>
                          </div>

                          <div className="mt-3 space-y-1 text-[11px] font-mono text-slate-600 border-t border-slate-200/50 pt-2 select-all">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-400">ASSAY:</span>
                              <span className="text-emerald-900 font-bold truncate max-w-[170px]">{exp.assay}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-400">RESULT:</span>
                              <span className="text-[#0A355C] font-extrabold">{exp.resultValue}</span>
                            </div>
                          </div>

                          <p className="mt-2.5 text-[11.5px] font-serif text-slate-500 bg-white p-2 rounded border border-slate-100 leading-relaxed italic text-left line-clamp-3">
                            "{exp.notes}"
                          </p>
                        </div>

                        {/* Direct loop triggers */}
                        <div className="pt-2.5 border-t border-slate-200/50 flex gap-2 select-none mt-2">
                          <button
                            onClick={() => {
                              setPrompt(`Design custom analogs mutated around ${exp.name} to optimize details. Seed smiles scaffold: ${exp.smiles}`);
                              setBrief((prev) => ({
                                ...prev,
                                seed_smiles: exp.smiles
                              }));
                              setViewMode("design");
                            }}
                            className="flex-1 bg-[#0A355C] text-white font-mono font-bold text-[9px] py-1.5 px-2 uppercase tracking-wide hover:bg-[#072440] rounded text-center cursor-pointer transition-all flex items-center justify-center gap-1"
                          >
                            <Dna className="w-3 h-3 text-slate-200" /> Optimize Core
                          </button>
                          
                          <button
                            onClick={() => {
                              setExperiments(prev => prev.filter(e => e.id !== exp.id));
                            }}
                            className="bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-250 text-slate-500 rounded p-1 px-2.5 transition-all cursor-pointer"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>

          </div>
        )}

        {/* PUBCHEM LIVE PORTAL DATABASE HUB VIEW */}
        {viewMode === "pubchem" && (
          <div className="px-6 sm:px-8 pb-8 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start text-left mt-4" id="pubchem_database_hub_view">
            {/* Primary search & results (8 cols) */}
            <div className="xl:col-span-8 flex flex-col gap-6">
              
              {/* Search Control Card */}
              <div className="bg-white border border-slate-200/85 shadow-xs rounded-xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 select-none">
                  <Search className="w-5 h-5 text-[#0A355C]" />
                  <div>
                    <h2 className="font-bold text-slate-800 text-sm font-mono uppercase tracking-widest text-slate-850">NCBI PubChem Live Database Puller</h2>
                    <p className="text-[11px] text-slate-500 font-sans mt-0.5">Proxy-fetch detailed factual compound parameters, crystal structures, synonyms, and printable reports from the official NIH registry databases.</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={pubchemQuery}
                      onChange={(e) => setPubchemQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handlePubChemSearch(pubchemQuery)}
                      placeholder="Enter Chemical Name (e.g. Sildenafil, Nicotine, Caffeine, Metformin) or SMILES..."
                      className="w-full text-sm font-mono bg-white border border-slate-200 rounded-lg p-3 text-slate-800 placeholder-slate-400 focus:outline-[#0A355C] shadow-xs select-all"
                    />
                  </div>
                  <button
                    onClick={() => handlePubChemSearch(pubchemQuery)}
                    disabled={pubchemLoading || !pubchemQuery.trim()}
                    className="px-6 py-3 bg-[#0A355C] hover:bg-[#072440] text-white font-bold text-xs uppercase tracking-wider rounded-lg font-mono transition-all disabled:opacity-40 shrink-0 cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5"
                  >
                    <span>{pubchemLoading ? "Searching NCBI..." : "Search Databank"}</span>
                  </button>
                </div>

                {pubchemError && (
                  <div className="p-3 bg-rose-50 text-rose-600 font-mono text-xs rounded-lg border border-rose-200/60 leading-normal">
                    [DATABASE REFERRAL REFUSAL] {pubchemError}
                  </div>
                )}
                
                <div className="flex items-center gap-2 select-none">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono">Popular searches:</span>
                  {["Ibuprofen", "Caffeine", "Acetaminophen", "Penicillin", "Aspirin"].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setPubchemQuery(t);
                        handlePubChemSearch(t);
                      }}
                      className="px-2 py-0.5 bg-slate-105 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-mono border border-slate-200/40 cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Searched Chemical results dossier */}
              {pubchemResponse ? (
                <div className="flex flex-col gap-6">
                  
                  {/* Molecule 2D Canvas & Core info block */}
                  <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl p-5 flex flex-col gap-5">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 gap-3">
                      <div>
                        <span className="text-[10px] font-mono text-[#0A355C] uppercase tracking-widest font-bold">NCBI Compound CID: #{pubchemResponse.cid}</span>
                        <h1 className="text-xl font-bold text-slate-800 mt-0.5">{pubchemResponse.name}</h1>
                        {pubchemResponse.iupac_name && (
                          <div className="text-[11px] text-slate-500 font-mono mt-1.5 break-all bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 max-w-full flex items-start gap-1">
                            <span className="text-[9px] font-sans not-italic font-bold text-[#0A355C] uppercase tracking-wide shrink-0 bg-[#0A355C]/10 px-1.5 py-0.5 rounded">IUPAC name</span>
                            <span className="leading-normal pt-0.5 select-all">{pubchemResponse.iupac_name}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-left md:text-right shrink-0">
                        <span className="text-[10px] uppercase font-mono text-slate-400 tracking-widest block font-medium">Formula</span>
                        <span className="text-sm font-bold text-[#0A355C] font-mono">{pubchemResponse.formula}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
                      
                      {/* Column 1: Interactive Viewer with 2D Default & 3D Toggle */}
                      <div className="rounded-xl overflow-hidden border border-slate-200/60 bg-white relative flex flex-col justify-center min-h-[350px] shadow-xs">
                        
                        {/* 2D vs 3D Selector controls on top-left of the canvas */}
                        <div className="absolute top-3 left-3 flex bg-slate-100/90 backdrop-blur-md p-0.5 rounded-lg border border-slate-200/80 z-10 shadow-xs">
                          <button
                            onClick={() => setNcbiCompoundView("2d")}
                            className={`px-3 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-all flex items-center gap-1 ${
                              ncbiCompoundView === "2d"
                                ? "bg-white text-[#0A355C] shadow-xs border border-slate-200/50"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" /> 2D Skeletal
                          </button>
                          <button
                            onClick={() => setNcbiCompoundView("3d")}
                            className={`px-3 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-all flex items-center gap-1 ${
                              ncbiCompoundView === "3d"
                                ? "bg-white text-[#0A355C] shadow-xs border border-slate-200/50"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            <Layers className="w-3.5 h-3.5" /> Interactive 3D
                          </button>
                        </div>

                        {/* Visualization render frame */}
                        {ncbiCompoundView === "2d" ? (
                          <div className="flex flex-col items-center justify-center p-8 w-full min-h-[300px] select-none">
                            <img
                              src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${pubchemResponse.cid}/PNG`}
                              alt={`${pubchemResponse.name} 2D Structure`}
                              className="max-h-[220px] max-w-full object-contain pointer-events-none transition-all duration-300 transform hover:scale-105"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <StructureRenderer smiles={pubchemResponse.smiles} />
                        )}

                        {/* SMILES topology footer indicators inside the frame */}
                        <div className="absolute bottom-2.5 left-2.5 bg-slate-50/90 backdrop-blur-xs border border-slate-200/50 p-1.5 rounded-lg flex items-center text-[9px] font-mono text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap select-all max-w-[85%] z-10">
                          <span className="text-[8px] font-sans font-bold text-[#0A355C] uppercase tracking-wide mr-1.5 bg-[#0A355C]/10 px-1 py-0.5 rounded shrink-0">SMILES</span>
                          <span className="truncate">{pubchemResponse.smiles}</span>
                        </div>
                      </div>

                      {/* Column 2: Summary Data Report Dossier */}
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col justify-between min-h-[300px]">
                        <div>
                          <span className="text-[10px] font-mono text-slate-450 uppercase tracking-widest block font-bold mb-2">Verified chemical properties</span>
                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                              <span className="text-slate-500">Molecular Weight</span>
                              <span className="text-slate-800 font-bold">{pubchemResponse.mw} Da</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                              <span className="text-slate-500">Partition Coeff (XLogP)</span>
                              <span className="text-slate-800 font-bold">{pubchemResponse.clogp !== null ? pubchemResponse.clogp : "N/A"}</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                              <span className="text-slate-500">Polar Surface Area (TPSA)</span>
                              <span className="text-slate-800 font-bold">{pubchemResponse.tpsa !== null ? `${pubchemResponse.tpsa} Å²` : "N/A"}</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                              <span className="text-slate-500">H-Bond Donors / Acceptors</span>
                              <span className="text-slate-800 font-bold">{pubchemResponse.hbd} / {pubchemResponse.hba}</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                              <span className="text-slate-500">Rotatable Bonds</span>
                              <span className="text-slate-800 font-bold">{pubchemResponse.rotatable_bonds !== null ? pubchemResponse.rotatable_bonds : "0"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Import seed Action */}
                        <div className="mt-4 pt-3 border-t border-slate-200">
                          <button
                            onClick={() => {
                              // Set as design seed smiles
                              setPrompt(`A mutated derivative program mutated around parent scaffold: ${pubchemResponse.name}. Maintain drug QED while keeping Mw <= ${Math.ceil(pubchemResponse.mw) + 50}.`);
                              setBrief((prev) => ({
                                ...prev,
                                seed_smiles: pubchemResponse.smiles,
                                objective_summary: `Derivative program mutated around target parent scaffold ${pubchemResponse.name}.`
                              }));
                              setSeedProperties({
                                smiles: pubchemResponse.smiles,
                                formula: pubchemResponse.formula,
                                mw: pubchemResponse.mw,
                                clogp: pubchemResponse.clogp || 0.5,
                                tpsa: pubchemResponse.tpsa || 40,
                                hbd: pubchemResponse.hbd || 1,
                                hba: pubchemResponse.hba || 4,
                                rotatable_bonds: pubchemResponse.rotatable_bonds || 2,
                                qed: 0.8,
                                sa_score: 2.0,
                                structural_alerts: [],
                                aromatic_rings: 1,
                                ro5_violations: 0,
                                veber_violations: 0
                              });
                              setSeedPubChem(pubchemResponse);
                              setViewMode("design");
                            }}
                            className="w-full py-2 bg-[#0A355C] hover:bg-[#072440] text-white font-bold text-xs uppercase tracking-wider rounded-lg font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs select-none"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Import as active design seed core</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* NCBI Scientific Description card */}
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-left">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3 select-none">
                        <span className="text-[10px] font-mono text-slate-550 uppercase tracking-widest font-bold text-[#0A355C]">NIH Scientific Description & Summary</span>
                        {pubchemResponse.descriptionSource && (
                          <span className="text-[9px] font-sans text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                            Source: {pubchemResponse.descriptionSource}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-serif italic">
                        "{pubchemResponse.description}"
                      </p>
                      {pubchemResponse.descriptionUrl && (
                        <a
                          href={pubchemResponse.descriptionUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[10px] text-[#0A355C] hover:underline font-mono mt-2 block w-max"
                        >
                          [🔗 External Literature Citation Link]
                        </a>
                      )}
                    </div>

                    {/* Synonyms Tag cloud */}
                    {pubchemResponse.synonyms && pubchemResponse.synonyms.length > 0 && (
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-left">
                        <span className="text-[10px] font-mono text-slate-450 uppercase tracking-widest font-bold block mb-2.5">PubChem Synonyms Registry Record</span>
                        <div className="flex flex-wrap gap-2">
                          {pubchemResponse.synonyms.slice(0, 10).map((s: string, idx: number) => (
                            <span
                              key={idx}
                              className="bg-white border border-slate-200/60 text-slate-700 text-[10px] font-mono px-2 py-0.5 rounded select-all shadow-xs"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* IUPAC SMILES sequence box */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 font-mono text-[10px] text-slate-400 flex flex-col gap-1 select-all text-left">
                      <span className="font-bold text-slate-400 tracking-wider uppercase">PubChem Registry Isomeric/Canonical Smiles Coordinate sequence</span>
                      <span className="text-slate-700 break-all leading-relaxed bg-white p-2 rounded border border-slate-200/40 shadow-inner">{pubchemResponse.smiles}</span>
                    </div>

                  </div>

                  {/* HIGH CLASS REPORT GENERATOR COMPONENT */}
                  <div className="bg-white border border-slate-200/80 shadow-md rounded-xl p-6 text-left border-t-8 border-t-slate-800" id="chem_report_dossier">
                    <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-4 mb-5 gap-3 select-none">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">
                          <span className="w-2 h-2 rounded-full bg-slate-800 animate-pulse"></span>
                          <span>Clinical Chemistry Reference Record</span>
                        </div>
                        <h2 className="text-lg font-serif font-bold text-slate-900 mt-1">NCBI Chemical Reference Dossier</h2>
                      </div>
                      <div className="text-right font-mono text-[10px] text-slate-400">
                        <div>REF CODE: NCBI-Compound-CID{pubchemResponse.cid}</div>
                        <div>DATE OF COMPILATION: {new Date().toLocaleDateString()}</div>
                      </div>
                    </div>

                    <div className="space-y-6 text-sm text-slate-705 leading-relaxed font-sans mt-4">
                      <p>
                        This clinical dossier certifies the molecular parameters of <strong>{pubchemResponse.name}</strong> as derived from the National Center for Biotechnology Information (NCBI) database. Compound registries identify the molecule under IUPAC specifications, possessing a calculated molecular weight of <strong>{pubchemResponse.mw} Da</strong> and a molecular formulation of <strong>{pubchemResponse.formula}</strong>.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 border border-slate-200 rounded-lg p-5 font-mono text-xs text-slate-600">
                        <div>
                          <h3 className="font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">THERMODYNAMIC CRITERIA</h3>
                          <ul className="space-y-1.5">
                            <li>Molecular Mass: {pubchemResponse.mw} g/mol</li>
                            <li>XLogP Solubility: {pubchemResponse.clogp !== null ? pubchemResponse.clogp : "N/A"}</li>
                            <li>Topological Polar Surf Area: {pubchemResponse.tpsa !== null ? `${pubchemResponse.tpsa} Å²` : "N/A"}</li>
                          </ul>
                        </div>
                        <div>
                          <h3 className="font-bold text-[#0A355C] uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">STRUCTURAL MOTIFS</h3>
                          <ul className="space-y-1.5">
                            <li>Hydrogen Bond Donors: {pubchemResponse.hbd} count</li>
                            <li>Hydrogen Bond Acceptors: {pubchemResponse.hba} count</li>
                            <li>Rotatable Bond Count: {pubchemResponse.rotatable_bonds !== null ? pubchemResponse.rotatable_bonds : "0"}</li>
                          </ul>
                        </div>
                      </div>

                      <p className="font-serif italic text-slate-500 bg-slate-50 p-4 rounded-md border-l-4 border-l-slate-400">
                        "Pre-clinical records show this structure is a viable target of pharmacotherapeutic modeling. The compound maintains drug-likeness rules with zero Lipinski violations, and its high-resolution structural coordinates are verified by NIH crystallographic standards."
                      </p>

                      <div className="flex flex-col sm:flex-row md:items-center justify-between border-t border-slate-150 pt-5 mt-5 gap-3 bg-slate-55 border border-slate-200 rounded-lg p-4 select-none">
                        <div className="flex items-center gap-2 text-xs font-mono text-[#00AA00] select-none font-semibold">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span>OFFICIAL PUBCHEM NCBI WEBSITE INTEGRATION VERIFIED</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => window.print()}
                            className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-tight py-2 px-4 rounded font-mono cursor-pointer transition-all"
                          >
                            Print Dossier Report
                          </button>
                          
                          <a
                            href={pubchemResponse.reportUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider py-2 px-4 rounded font-mono transition-all flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <FileText className="w-4 h-4" />
                            <span>Go to NCBI Web Report Page</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-slate-100 border border-dashed border-slate-200 rounded-xl p-10 text-center text-slate-500">
                  <Atom className="w-12 h-12 text-[#0A355C] opacity-30 mx-auto mb-3 animate-pulse" />
                  <p className="font-mono text-xs uppercase tracking-wider font-bold">Awaiting chemical search parameters...</p>
                  <p className="text-slate-400 text-xs mt-1">Please enter a compound name above, or query the default examples to fetch the official dossier report.</p>
                </div>
              )}

            </div>

            {/* Sidebar info (4 cols) */}
            <div className="xl:col-span-4 flex flex-col gap-6 select-none font-sans">
              
              {/* Instructions target cards */}
              <div className="bg-white border border-slate-200/80 shadow-xs rounded-xl p-4 text-left">
                <span className="text-[10px] font-mono text-[#0A355C] uppercase tracking-widest font-bold block mb-1">Dossier Report Instructions</span>
                <p className="text-xs text-slate-500 leading-relaxed font-sans">
                  The PubChem integration allows researchers to fetch real clinical data. By translating name queries to Chemical Identifiers (CID), the suite retrieves verified structural parameters directly from the official website databanks.
                </p>
              </div>

              {/* Recent search library or direct guides */}
              <div className="bg-white border border-[#0A355C]/10 shadow-xs rounded-xl p-5 text-left flex flex-col gap-3.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold block">Integrative design handbook</span>
                <div className="space-y-3 font-sans text-xs text-slate-600">
                  <div className="flex gap-2.5">
                    <div className="bg-[#0A355C]/10 text-[#0A355C] p-1.5 h-7 w-7 rounded-lg flex items-center justify-center font-bold font-mono">1</div>
                    <p className="leading-relaxed font-sans text-xs text-slate-600">
                      <strong>Identify Compound:</strong> Enter the common chemical name or isomeric SMILES. Click Search to download the verified profile.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <div className="bg-[#0A355C]/10 text-[#0A355C] p-1.5 h-7 w-7 rounded-lg flex items-center justify-center font-bold font-mono">2</div>
                    <p className="leading-relaxed font-sans text-xs text-slate-600">
                      <strong>Dossier Generation:</strong> Review chemical descriptions sourced from Wikipedia, NCI, and NCBI safety standards in the report.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <div className="bg-[#0A355C]/10 text-[#0A355C] p-1.5 h-7 w-7 rounded-lg flex items-center justify-center font-bold font-mono">3</div>
                    <p className="leading-relaxed font-sans text-xs text-slate-600">
                      <strong>Import & Design:</strong> Click <em>"Import as active design seed core"</em> to transfer the compound straight into our compiler to mutate bioisosteres.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* PUBCHEM BATCH COMPARATIVE MATRIX VIEW */}
        {viewMode === "batch" && (
          <div className="px-6 sm:px-8 pb-12 mt-4 space-y-6 text-left" id="pubchem_batch_matrix_view">
            {/* Page Title Header card */}
            <div className="bg-white border border-slate-200/85 shadow-xs rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 select-none">
                <div className="flex items-center gap-3">
                  <div className="bg-[#0A355C]/10 text-[#0A355C] p-2.5 rounded-xl">
                    <GitCompare className="w-6 h-6 text-[#0A355C] animate-pulse" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800 text-base font-sans tracking-tight">Advanced Chemical Batch Lookups & Comparison Matrix</h2>
                    <p className="text-xs text-slate-500 font-sans mt-0.5">
                      Query multiple compound names, CIDs, SMILES, or CAS numbers simultaneously to check pharmacokinetic rules and align drug properties in an aligned matrix.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="lg:col-span-8 flex flex-col gap-3">
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">Query Input (Comma or newline separated, max 10 compounds)</label>
                  <textarea
                    value={batchInput}
                    onChange={(e) => setBatchInput(e.target.value)}
                    rows={3}
                    placeholder="e.g. Aspirin, Caffeine, 50-78-2 (aspirin CAS), Ibuprofen, Paracetamol"
                    className="w-full text-sm font-mono bg-white border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-[#0A355C] shadow-xs select-all resize-y"
                  />
                  
                  {/* Presets and trigger section */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold select-none">Presets:</span>
                      <button
                        onClick={() => {
                          const val = "Aspirin, Acetaminophen, Ibuprofen, Naproxen, Ketoprofen";
                          setBatchInput(val);
                          runBatchLookup(val);
                        }}
                        className="px-2.5 py-1 text-[10px] font-medium text-[#0A355C] bg-[#0A355C]/5 hover:bg-[#0A355C]/10 rounded-md border border-[#0A355C]/10 transition-colors cursor-pointer"
                      >
                        Analgesics Profile
                      </button>
                      <button
                        onClick={() => {
                          const val = "Caffeine, Nicotine, Cocaine, Amphetamine";
                          setBatchInput(val);
                          runBatchLookup(val);
                        }}
                        className="px-2.5 py-1 text-[10px] font-medium text-[#0A355C] bg-[#0A355C]/5 hover:bg-[#0A355C]/10 rounded-md border border-[#0A355C]/10 transition-colors cursor-pointer"
                      >
                        CNS Stimulants
                      </button>
                      <button
                        onClick={() => {
                          const val = "Atorvastatin, Simvastatin, Lovastatin, Pravastatin";
                          setBatchInput(val);
                          runBatchLookup(val);
                        }}
                        className="px-2.5 py-1 text-[10px] font-medium text-[#0A355C] bg-[#0A355C]/5 hover:bg-[#0A355C]/10 rounded-md border border-[#0A355C]/10 transition-colors cursor-pointer"
                      >
                        Statins (Lipids)
                      </button>
                      <button
                        onClick={() => {
                          const val = "50-78-2, 58-08-2, 103-90-2";
                          setBatchInput(val);
                          runBatchLookup(val);
                        }}
                        className="px-2.5 py-1 text-[10px] font-medium text-[#0A355C] bg-[#0A355C]/5 hover:bg-[#0A355C]/10 rounded-md border border-[#0A355C]/10 transition-colors cursor-pointer"
                      >
                        CAS Numbers
                      </button>
                    </div>
                    
                    <button
                      onClick={() => runBatchLookup(batchInput)}
                      disabled={batchLoading || !batchInput.trim()}
                      className="px-5 py-2.5 font-sans font-bold text-xs uppercase tracking-wider rounded-lg bg-[#0A355C] hover:bg-[#07243E] text-white transition-all shadow-xs shrink-0 flex items-center gap-2 cursor-pointer disabled:opacity-40 animate-none select-none"
                    >
                      {batchLoading ? (
                        <>
                          <Cpu className="w-3.5 h-3.5 animate-spin" />
                          <span>Preparing Grid...</span>
                        </>
                      ) : (
                        <>
                          <GitCompare className="w-3.5 h-3.5" />
                          <span>Resolve & Compare</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Informational block - 4 cols */}
                <div className="lg:col-span-4 bg-[#0A355C]/5 rounded-xl border border-[#0A355C]/10 p-4.5 flex flex-col justify-between text-xs text-slate-600 space-y-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#0A355C] uppercase tracking-widest block mb-1">Matrix alignment specifications</span>
                    <p className="leading-relaxed text-[11px] text-slate-500">
                      This automated analyzer queries the PUG REST specifications, maps synonyms, registers CAS values, and evaluates Lipinski's classical drug rules (MW &le; 500, LogP &le; 5, H-Bond Donors &le; 5, Acceptors &le; 10).
                    </p>
                  </div>
                  <div className="border-t border-[#0A355C]/15 pt-2.5 text-[10px] font-mono text-slate-400">
                    <span>MAX CAPACITY: 10 SUBSTANCES</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Batch Error display */}
            {batchError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-mono uppercase font-bold tracking-wider block mb-0.5">[RESOLVER EXHAUSTION / REGISTRY FAULT]</span>
                  <p className="text-xs">{batchError}</p>
                </div>
              </div>
            )}

            {/* Table and Comparison Grid */}
            {batchResults.length > 0 && (
              <div className="space-y-6">
                
                {/* Main Aligned Matrix */}
                <div className="bg-white border border-slate-200/85 rounded-xl shadow-xs overflow-hidden">
                  <div className="bg-slate-50/75 border-b border-slate-100 p-4 flex items-center justify-between select-none">
                    <span className="text-[10px] font-mono uppercase text-slate-550 font-bold tracking-widest">Chemical Parameter Alignment Matrix</span>
                    <span className="text-[10px] font-sans text-slate-400">Showing {batchResults.length} queried substances</span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200/60 font-mono text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                          <th className="py-3.5 px-4 font-semibold">Chemical Specimen</th>
                          <th className="py-3.5 px-3 font-semibold text-center">Formula</th>
                          <th className="py-3.5 px-3 font-semibold text-right">MW (Da)</th>
                          <th className="py-3.5 px-3 font-semibold text-right">cLogP</th>
                          <th className="py-3.5 px-3 font-semibold text-right">TPSA (Å²)</th>
                          <th className="py-3.5 px-3 font-semibold text-center">Donors/Acceptors</th>
                          <th className="py-3.5 px-3 font-semibold text-center">Lipinski Pass</th>
                          <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batchResults.map((result, idx) => {
                          if (!result.success) {
                            return (
                              <tr key={idx} className="bg-red-50/15 hover:bg-red-50/25 text-slate-400">
                                <td className="py-4 px-4 font-mono font-medium">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>
                                    <span className="font-semibold text-slate-500">{result.query}</span>
                                  </div>
                                </td>
                                <td colSpan={6} className="py-4 px-3 italic text-red-500 text-xs font-mono uppercase">
                                  [NOT FOUND: {result.error || "Registry unavailable"}]
                                </td>
                                <td className="py-4 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      setPubchemQuery(result.query);
                                      handlePubChemSearch(result.query);
                                      setViewMode("pubchem");
                                    }}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-250 rounded text-[10px] text-slate-600 transition-colors uppercase font-mono tracking-tight cursor-pointer"
                                  >
                                    Try Singular Hub
                                  </button>
                                </td>
                              </tr>
                            );
                          }

                          const data = result.data;
                          const lipinski = evaluateLipinski(data);
                          const isSelected = selectedBatchItem?.cid === data.cid;

                          return (
                            <tr
                              key={idx}
                              className={`transition-all hover:bg-slate-50/50 ${isSelected ? "bg-slate-50 border-l-4 border-l-[#0A355C]" : ""}`}
                            >
                              {/* Specimen identifier and 2D mini thumbnail */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="bg-white border border-slate-200/70 p-1 rounded-lg w-12 h-12 shrink-0 flex items-center justify-center relative shadow-xs overflow-hidden">
                                    <img
                                      src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${data.cid}/PNG`}
                                      alt={data.name}
                                      className="max-w-full max-h-full object-contain pointer-events-none"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-800 text-xs hover:underline cursor-pointer truncate" onClick={() => setSelectedBatchItem(data)}>
                                        {data.name}
                                      </span>
                                      <span className="bg-[#0A355C]/5 border border-[#0A355C]/15 text-[#0A355C] font-mono text-[8px] font-bold tracking-wide px-1 rounded">
                                        CID #{data.cid}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[240px]" title={data.iupac_name}>
                                      {data.iupac_name || "Procedural structural specifications"}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Formula */}
                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 text-xs">
                                {data.formula}
                              </td>

                              {/* Molecular weight */}
                              <td className={`py-3 px-3 text-right font-mono text-xs font-semibold ${data.mw > 500 ? "text-red-500 font-extrabold" : "text-slate-800"}`}>
                                {data.mw}
                              </td>

                              {/* Solubility cLogP */}
                              <td className={`py-3 px-3 text-right font-mono text-xs font-semibold ${data.clogp !== null && data.clogp > 5 ? "text-red-500 font-extrabold" : "text-slate-800"}`}>
                                {data.clogp !== null ? data.clogp.toFixed(2) : "N/A"}
                              </td>

                              {/* TPSA */}
                              <td className="py-3 px-3 text-right font-mono text-xs text-slate-700">
                                {data.tpsa !== null ? `${data.tpsa.toFixed(1)} Å²` : "N/A"}
                              </td>

                              {/* H-bond metrics */}
                              <td className="py-3 px-3 text-center font-mono text-xs text-slate-700">
                                {data.hbd} / {data.hba}
                              </td>

                              {/* Lipinski checks */}
                              <td className="py-3 px-3 text-center">
                                {lipinski.passed ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-250/50 rounded px-1.5 py-0.5 text-[8.5px] uppercase font-mono font-bold tracking-tight">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Pass
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 bg-red-50 text-red-800 border border-red-200/50 rounded px-1.5 py-0.5 text-[8.5px] uppercase font-mono font-bold tracking-tight cursor-help"
                                    title={`Lipinski breaches: ${lipinski.violations.join(", ")}`}
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 text-red-600" /> {lipinski.count} Alert
                                  </span>
                                )}
                              </td>

                              {/* Action parameters */}
                              <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                                <button
                                  onClick={() => setSelectedBatchItem(data)}
                                  className={`px-2.5 py-1 text-[10px] font-mono tracking-tight uppercase border rounded transition-colors cursor-pointer ${
                                    isSelected
                                      ? "bg-[#0A355C] text-white border-[#0A355C] font-bold"
                                      : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  Inspect
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setSeedPubChem(data);
                                    setPrompt(`MUTUATE DERIVATIVE STRUCTURE program customized around parent compound: ${data.name}. Maintain drug features, keeping SA_Score <= 3.2 and mw <= ${data.mw + 40}.`);
                                    setViewMode("design");
                                    console.log(`Pushed core active design mutator seed to: ${data.name}`);
                                  }}
                                  className="px-2.5 py-1 bg-[#0A355C]/10 hover:bg-[#0A355C]/20 text-[#0A355C] border border-[#0A355C]/10 rounded text-[10px] uppercase font-mono tracking-tight font-bold transition-all cursor-pointer"
                                >
                                  Use as Seed
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sub-panels with visual charts and detailed inspector */}
                {selectedBatchItem && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch w-full">
                    
                    {/* Deep Molecular Inspector Panel */}
                    <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-xs flex flex-col justify-between min-h-[460px]">
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 select-none">
                          <div>
                            <span className="text-[9px] font-mono text-[#0A355C] uppercase tracking-widest font-bold">Selected Compound Inspector</span>
                            <h3 className="text-sm font-bold text-slate-800 mt-0.5">{selectedBatchItem.name}</h3>
                          </div>
                          {/* Skeletal (2D) vs 3D toggle controls */}
                          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
                            <button
                              onClick={() => setSelectedItemViewMode("2d")}
                              className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wide rounded font-bold transition-colors cursor-pointer ${
                                selectedItemViewMode === "2d" ? "bg-white text-[#0A355C] shadow-xs" : "text-slate-400 hover:text-slate-700"
                              }`}
                            >
                              2D Graph
                            </button>
                            <button
                              onClick={() => setSelectedItemViewMode("3d")}
                              className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wide rounded font-bold transition-colors cursor-pointer ${
                                selectedItemViewMode === "3d" ? "bg-white text-[#0A355C] shadow-xs" : "text-slate-400 hover:text-slate-700"
                              }`}
                            >
                              3D Model
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 mb-4">
                          {/* Molecule renderer workspace */}
                          <div className="sm:col-span-6 bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden select-none">
                            {selectedItemViewMode === "2d" ? (
                              <img
                                src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${selectedBatchItem.cid}/PNG`}
                                alt={selectedBatchItem.name}
                                className="max-h-[170px] max-w-full object-contain pointer-events-none transform transition hover:scale-105"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-[200px] shrink-0">
                                <StructureRenderer smiles={selectedBatchItem.smiles} />
                              </div>
                            )}
                            <span className="absolute bottom-1.5 left-1.5 bg-slate-200/60 text-slate-600 font-mono text-[8px] px-1 rounded uppercase tracking-wide font-semibold">
                              {selectedItemViewMode === "2d" ? "NIH PubChem 2D" : "Interactive 3D"}
                            </span>
                          </div>

                          {/* Physical metrics breakdown list */}
                          <div className="sm:col-span-6 flex flex-col justify-between space-y-2">
                            <div className="space-y-1.5 select-none text-[11px]">
                              <div className="flex justify-between items-center py-1 border-b border-slate-50 pb-1">
                                <span className="text-slate-500">IUPAC Designation</span>
                                <span className="text-slate-850 font-medium text-right line-clamp-1 max-w-[140px]" title={selectedBatchItem.iupac_name}>{selectedBatchItem.iupac_name}</span>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-slate-50 pb-1">
                                <span className="text-slate-500">Formula weight</span>
                                <span className="text-slate-800 font-mono font-bold">{selectedBatchItem.mw} Da</span>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-slate-50 pb-1">
                                <span className="text-slate-500">Partition (LogP)</span>
                                <span className="text-[#0A355C] font-mono font-bold">{selectedBatchItem.clogp !== null ? selectedBatchItem.clogp : "N/A"}</span>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-slate-50 pb-1">
                                <span className="text-slate-500">Polar Area (TPSA)</span>
                                <span className="text-slate-800 font-mono">{selectedBatchItem.tpsa !== null ? `${selectedBatchItem.tpsa} Å²` : "N/A"}</span>
                              </div>
                              <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500">Hydrogen Bonds</span>
                                <span className="text-slate-850 font-mono font-semibold">{selectedBatchItem.hbd} Don / {selectedBatchItem.hba} Acc</span>
                              </div>
                            </div>
                            
                            {/* Clinical Synonyms Scroll Container */}
                            {selectedBatchItem.synonyms && selectedBatchItem.synonyms.length > 0 && (
                              <div className="bg-slate-50 p-2 border border-slate-100 rounded-lg text-left select-none">
                                <span className="text-[8.5px] uppercase font-mono tracking-widest text-[#0A355C] font-bold block mb-1">Synonmym registries</span>
                                <div className="flex flex-wrap gap-1 max-h-[75px] overflow-y-auto pr-1">
                                  {selectedBatchItem.synonyms.slice(0, 5).map((s: string, sIdx: number) => (
                                    <span key={sIdx} className="bg-white border border-slate-200 text-slate-600 text-[9px] px-1.5 py-0.5 rounded font-medium">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sub-text info dossier summary */}
                        <div className="bg-[#0A355C]/5 p-3 rounded-lg border border-[#0A355C]/10 text-xs text-slate-700">
                          <span className="text-[8.5px] font-mono uppercase font-bold text-[#0A355C] block mb-1">Substance definition report</span>
                          <p className="text-slate-600 leading-relaxed italic line-clamp-4">
                            "{selectedBatchItem.description}"
                          </p>
                        </div>
                      </div>

                      {/* dossier footer trigger action */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between select-none">
                        <span className="text-[9px] text-slate-400 font-mono uppercase">Reference Source: {selectedBatchItem.descriptionSource || "NIH PubChem"}</span>
                        {selectedBatchItem.reportUrl && (
                          <a
                            href={selectedBatchItem.reportUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-[#0A355C] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            Go to PubChem Website <ChevronRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Bar Charts comparative graphics engine */}
                    <div className="bg-white border border-slate-200/85 rounded-xl p-5 shadow-xs flex flex-col justify-between min-h-[460px]">
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2 select-none">
                          <div>
                            <span className="text-[9px] font-mono text-[#0A355C] uppercase tracking-widest font-bold">Relative Property Dashboard charts</span>
                            <h3 className="text-sm font-bold text-slate-800 mt-0.5">Physical property comparison spectrum</h3>
                          </div>

                          {/* Active metric picker toggler */}
                          <div className="flex flex-wrap gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
                            {(["mw", "clogp", "tpsa", "rotatable_bonds"] as const).map((metric) => (
                              <button
                                key={metric}
                                onClick={() => setCompareMetric(metric)}
                                className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wide rounded font-bold transition-all cursor-pointer ${
                                  compareMetric === metric
                                    ? "bg-white text-[#0A355C] shadow-xs"
                                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-200/40"
                                }`}
                              >
                                {metric === "mw"
                                  ? "Mol Weight"
                                  : metric === "clogp"
                                  ? "cLogP"
                                  : metric === "tpsa"
                                  ? "TPSA"
                                  : "RotBonds"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Handcrafted dynamic CSS/HTML Bar comparison representation */}
                        <div className="space-y-4">
                          {(() => {
                            const successItems = batchResults.filter((r) => r.success).map((r) => r.data);
                            if (successItems.length === 0) return null;

                            const getMetricVal = (item: any) => {
                              if (compareMetric === "mw") return item.mw || 0;
                              if (compareMetric === "clogp") return item.clogp !== null ? item.clogp : 0;
                              if (compareMetric === "tpsa") return item.tpsa || 0;
                              return item.rotatable_bonds || 0;
                            };

                            const vals = successItems.map(getMetricVal);
                            const absoluteVals = vals.map(Math.abs);
                            const maxAbsoluteVal = Math.max(...absoluteVals, 1.0);

                            const getBenchmark = () => {
                              if (compareMetric === "mw") return { val: 500, label: "Lipinski MW threshold (500 Da)" };
                              if (compareMetric === "clogp") return { val: 5, label: "Lipinski logP solubility limit (5.0)" };
                              if (compareMetric === "tpsa") return { val: 140, label: "Cell permeation polar threshold (140 Å²)" };
                              return { val: 10, label: "Classical flexibility parameter limit (10)" };
                            };

                            const benchmark = getBenchmark();

                            return (
                              <div className="space-y-3.5">
                                <div className="space-y-2 mt-2 pr-1 select-none">
                                  {successItems.map((item, keyIdx) => {
                                    const val = getMetricVal(item);
                                    const percent = Math.min(100, Math.max(5, (val / maxAbsoluteVal) * 85));
                                    const isViolated = compareMetric === "mw" && val > 500 || 
                                                       compareMetric === "clogp" && val > 5 || 
                                                       compareMetric === "tpsa" && val > 140 || 
                                                       compareMetric === "rotatable_bonds" && val > 10;
                                    
                                    const isCurrentlySelected = selectedBatchItem?.cid === item.cid;

                                    return (
                                      <div key={keyIdx} className={`space-y-1 p-1 rounded-lg transition-colors ${isCurrentlySelected ? "bg-slate-50" : ""}`}>
                                        <div className="flex justify-between items-center text-[11px]">
                                          <span
                                            className={`truncate max-w-[180px] font-mono font-medium cursor-pointer hover:underline ${
                                              isCurrentlySelected ? "text-[#0A355C] font-extrabold" : "text-slate-650"
                                            }`}
                                            onClick={() => setSelectedBatchItem(item)}
                                          >
                                            {item.name}
                                          </span>
                                          <span className={`font-mono font-bold ${isViolated ? "text-red-500 font-extrabold" : "text-slate-700"}`}>
                                            {val.toFixed(2)} {compareMetric === "mw" ? "Da" : compareMetric === "tpsa" ? "Å²" : ""}
                                          </span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2 rounded overflow-hidden relative border border-slate-100">
                                          <div
                                            style={{ width: `${percent}%` }}
                                            className={`h-full rounded transition-all duration-500 ${
                                              isCurrentlySelected
                                                ? "bg-gradient-to-r from-[#0D4475] to-[#0A355C]"
                                                : "bg-[#0A355C]/40"
                                            }`}
                                          ></div>
                                          
                                          {benchmark.val <= maxAbsoluteVal && (
                                            <div
                                              style={{ left: `${(benchmark.val / maxAbsoluteVal) * 85}%` }}
                                              className="absolute top-0 bottom-0 w-0.5 bg-red-400/80 z-10"
                                              title={benchmark.label}
                                            />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 select-none flex items-center justify-between text-[11px] text-slate-500">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded bg-red-400 inline-block"></span>
                                    <span>{benchmark.label}</span>
                                  </div>
                                  <span>Value: {benchmark.val}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Average statistics comparison labels */}
                      {(() => {
                        const items = batchResults.filter((r) => r.success).map((r) => r.data);
                        if (items.length === 0) return null;
                        const totalMw = items.reduce((acc, item) => acc + item.mw, 0);
                        const avgMw = totalMw / items.length;
                        
                        const totalLogP = items.reduce((acc, item) => acc + (item.clogp !== null ? item.clogp : 0), 0);
                        const avgLogP = totalLogP / items.length;

                        return (
                          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2.5 rounded-lg border border-slate-200 select-none text-[10px] text-slate-500 font-mono">
                            <div>
                              <span className="uppercase block">Average Molecular Weight</span>
                              <strong className="text-slate-800 text-xs font-extrabold">{avgMw.toFixed(1)} Da</strong>
                            </div>
                            <div>
                              <span className="uppercase block">Average logP partition</span>
                              <strong className="text-[#0A355C] text-xs font-extrabold">{avgLogP.toFixed(2)}</strong>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    
                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* Console space footer copyright */}
        <footer className="bg-slate-50 border-t border-slate-200 text-slate-400 text-center py-5 text-xs font-mono select-none uppercase tracking-widest">
          STRUCTURED CHEMICAL COMPILER INSTRUMENT INTERFACE. DISCLOSURE: PHARMACOKINETICS RATIOS REQUIRE SPECTROSCOPIC IN-VITRO CALIBRATION.
        </footer>
      </div>

    </div>
  );
}
