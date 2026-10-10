/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Minimal Markdown renderer for generated reports: headings, bullets, inline
 * bold and inline `code`. Plain elements only; styling comes from index.css.
 */

import React from "react";

function inline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={`${keyBase}-${i}`}>{p.slice(1, -1)}</code>;
    return <React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (bullets.length === 0) return;
    out.push(
      <ul className="plain" key={`ul-${key}`}>
        {bullets.map((b, i) => (
          <li key={i}>{inline(b, `${key}-${i}`)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = String(i);
    if (/^\s*[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    flush(key);
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const body = line.replace(/^#+\s*/, "");
      out.push(
        React.createElement(
          level <= 2 ? "h3" : "h4",
          { key, style: { margin: "10px 0 4px", fontSize: level <= 2 ? 13 : 12 } },
          inline(body, key)
        )
      );
    } else if (line === "---") {
      out.push(<hr key={key} />);
    } else if (line.trim() !== "") {
      out.push(<p key={key}>{inline(line, key)}</p>);
    }
  });
  flush("end");

  return <div>{out}</div>;
}
