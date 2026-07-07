/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Educational conditions → efficacy heuristic. Given a reaction's thermal
 * character and the chosen conditions, estimate a qualitative rate, equilibrium
 * position (yield direction), an overall efficacy score, and tuning tips.
 *
 * This is a teaching model built on textbook intuition (Arrhenius for rate, Le
 * Chatelier for equilibrium) — not rigorous kinetics/thermodynamics.
 */

export type Concentration = "low" | "normal" | "high";

export interface Conditions {
  tempC: number;
  concentration: Concentration;
  catalyst: boolean;
}

export interface Efficacy {
  ratePct: number; // 0..100
  yieldPct: number; // equilibrium position toward products, 0..100
  score: number; // overall 0..100
  rateLabel: string;
  yieldLabel: string;
  tips: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function estimateEfficacy(character: string | undefined, c: Conditions): Efficacy {
  const exo = character === "Exothermic";
  const endo = character === "Endothermic";

  // --- Rate (kinetics) ---
  // Higher temperature and a catalyst speed things up; concentration helps.
  let rate = 8 + (c.tempC - 0) * 0.42; // ~25°C→18, 100°C→50, 200°C→92
  if (c.catalyst) rate += 25;
  rate += c.concentration === "high" ? 14 : c.concentration === "low" ? -12 : 0;
  const ratePct = Math.round(clamp(rate, 3, 100));

  // --- Equilibrium position / yield (thermodynamics) ---
  let yieldPos = 55;
  // Le Chatelier: heating an exothermic reaction shifts back (lower yield);
  // heating an endothermic reaction shifts forward (higher yield).
  if (exo) yieldPos += 15 - (c.tempC - 25) * 0.22;
  if (endo) yieldPos += -12 + (c.tempC - 25) * 0.22;
  yieldPos += c.concentration === "high" ? 12 : c.concentration === "low" ? -10 : 0;
  const yieldPct = Math.round(clamp(yieldPos, 8, 96));

  const score = Math.round(ratePct * 0.5 + yieldPct * 0.5);

  const rateLabel = ratePct < 25 ? "Slow" : ratePct < 55 ? "Moderate" : ratePct < 80 ? "Fast" : "Very fast";
  const yieldLabel = yieldPct < 40 ? "Reactant-favored" : yieldPct <= 60 ? "Balanced" : "Product-favored";

  // --- Tuning tips ---
  const tips: string[] = [];
  if (ratePct < 40) tips.push(c.catalyst ? "Raise the temperature to speed up a sluggish rate." : "Add a catalyst and/or raise the temperature to speed up the rate.");
  if (endo && yieldPct < 60) tips.push("This reaction is endothermic — heating it drives the equilibrium toward products.");
  if (exo && c.tempC > 60 && yieldPct < 60) tips.push("This reaction is exothermic — cooling it favors higher yield (but slows the rate), so balance the two.");
  if (c.concentration !== "high" && yieldPct < 70) tips.push("Increase reactant concentration (or use an excess) to push toward products and speed the rate.");
  if (!c.catalyst && ratePct < 70) tips.push("A catalyst lowers the activation energy — it speeds the rate without shifting the equilibrium.");
  if (tips.length === 0) tips.push("Conditions look well-balanced for both rate and yield.");

  return { ratePct, yieldPct, score, rateLabel, yieldLabel, tips: tips.slice(0, 3) };
}
