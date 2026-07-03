/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multi-objective Pareto-front selection for the molecule design pipeline.
 */

/**
 * Given a cost matrix (rows = candidates, cols = objectives to minimize),
 * return a boolean mask marking the Pareto-optimal (non-dominated) rows.
 */
export function getParetoFrontMask(costs: number[][]): boolean[] {
  const n = costs.length;
  if (n === 0) return [];
  const isOptimal = new Array(n).fill(true);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      // Candidate j dominates i if it is <= in every objective and < in at least one.
      let strictlyBetterInSome = false;
      let jDominatesI = true;
      const length = costs[i].length;
      for (let k = 0; k < length; k++) {
        if (costs[j][k] > costs[i][k]) {
          jDominatesI = false;
          break;
        }
        if (costs[j][k] < costs[i][k]) {
          strictlyBetterInSome = true;
        }
      }
      if (jDominatesI && strictlyBetterInSome) {
        isOptimal[i] = false;
        break;
      }
    }
  }
  return isOptimal;
}
