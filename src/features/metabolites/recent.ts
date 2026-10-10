/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Recently viewed metabolites, so going back to something you looked at two
 * minutes ago does not mean retyping its name. Stored in this browser only.
 */

import { useSyncExternalStore } from "react";

export interface RecentMetabolite {
  accession: string;
  name: string;
}

const KEY = "chemtool_recent_metabolites";
const CAP = 12;

let recent: RecentMetabolite[] = load();
const listeners = new Set<() => void>();

function load(): RecentMetabolite[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is RecentMetabolite => !!r && typeof r.accession === "string" && typeof r.name === "string")
      .slice(0, CAP);
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(recent));
  } catch {
    /* private mode or blocked storage: the list just will not survive a reload */
  }
  listeners.forEach((l) => l());
}

/** Record a view, moving an already-seen metabolite back to the front. */
export function noteViewed(entry: RecentMetabolite) {
  if (!entry.accession) return;
  recent = [entry, ...recent.filter((r) => r.accession !== entry.accession)].slice(0, CAP);
  persist();
}

export function clearRecent() {
  recent = [];
  persist();
}

/** Current list, for non-React callers and tests. */
export function getRecent(): RecentMetabolite[] {
  return recent;
}

export function useRecent(): RecentMetabolite[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => recent,
    () => recent
  );
}
