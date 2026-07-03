/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fail-closed input safety layer — refuses prompts/reactants that touch
 * dual-use chemical-weapon or illicit-synthesis territory.
 */

const DANGEROUS_TERMS = [
  "weapon", "nerve agent", "vx", "ricin", "fentanyl", "carfentanil",
  "methamphetamine", "heroin", "cocaine", "sarin", "soman", "mustard gas",
  "explosive", "explosives", "detonate", "bomb", "chemical weapon", "toxicant",
];

export function isInputSafe(prompt: string): { safe: boolean; reason?: string } {
  const lowercase = prompt.toLowerCase();
  for (const term of DANGEROUS_TERMS) {
    if (lowercase.includes(term)) {
      return {
        safe: false,
        reason: `Refused: input triggers a critical dual-use chemical risk boundary ('${term}').`,
      };
    }
  }
  return { safe: true };
}
