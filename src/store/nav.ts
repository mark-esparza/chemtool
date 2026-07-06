/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App navigation as a shared store, so any feature can navigate to another view
 * (e.g. the chemical bank sending compounds to the Reaction Simulator).
 */

import { useSyncExternalStore } from "react";

export type ViewId = "reactions" | "search" | "products" | "metabolites" | "compare" | "designer" | "notebook" | "guide";

let current: ViewId = "reactions";
const listeners = new Set<() => void>();

export function navigate(view: ViewId) {
  if (view === current) {
    // Force a re-mount notification even when navigating to the current view.
    listeners.forEach((l) => l());
    return;
  }
  current = view;
  listeners.forEach((l) => l());
}

export function useView(): ViewId {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current
  );
}
