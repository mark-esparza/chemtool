/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight Markdown renderer for the analysis reports (headings, bullets,
 * inline bold, inline `code`). Calm typographic styling.
 */

import React from "react";

function inline(text: string, keyBase: string) {
  // Split on **bold** and `code`, keeping delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={`${keyBase}-${i}`} className="font-semibold text-slate-900">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code key={`${keyBase}-${i}`} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-[#0A355C]">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-600">
      {lines.map((line, idx) => {
        const t = line.trim();
        if (!t) return <div key={idx} className="h-1" />;
        if (t === "---") return <hr key={idx} className="my-3 border-slate-100" />;

        if (t.startsWith("## ")) {
          return (
            <h4 key={idx} className="mt-4 border-b border-slate-100 pb-1 text-xs font-semibold uppercase tracking-wide text-[#0A355C] first:mt-0">
              {inline(t.replace(/^##\s*/, ""), `h${idx}`)}
            </h4>
          );
        }
        if (t.startsWith("# ")) {
          return (
            <h3 key={idx} className="mt-2 text-sm font-bold text-slate-800">
              {inline(t.replace(/^#\s*/, ""), `h1${idx}`)}
            </h3>
          );
        }
        if (t.startsWith("- ") || t.startsWith("* ")) {
          return (
            <div key={idx} className="relative pl-4 text-[13px] before:absolute before:left-1 before:text-[#0A355C] before:content-['•']">
              {inline(t.replace(/^[-*]\s*/, ""), `li${idx}`)}
            </div>
          );
        }
        if (/^\s*\*\s/.test(line)) {
          return (
            <div key={idx} className="pl-7 text-[12px] text-slate-500">
              {inline(t.replace(/^\*\s*/, ""), `li2${idx}`)}
            </div>
          );
        }
        return (
          <p key={idx} className="text-[13px]">
            {inline(t, `p${idx}`)}
          </p>
        );
      })}
    </div>
  );
}
