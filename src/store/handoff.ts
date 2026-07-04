/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One-shot handoff payloads between features. A feature sets a payload and
 * navigates; the destination feature consumes (takes) it once on mount.
 */

let pendingReactants: string[] | null = null;
let pendingCompound: string | null = null;

export function setPendingReactants(reactants: string[]) {
  pendingReactants = reactants;
}
export function takePendingReactants(): string[] | null {
  const r = pendingReactants;
  pendingReactants = null;
  return r;
}

export function setPendingCompound(query: string) {
  pendingCompound = query;
}
export function takePendingCompound(): string | null {
  const q = pendingCompound;
  pendingCompound = null;
  return q;
}
