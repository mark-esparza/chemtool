/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Plain UI primitives. Every one maps onto an ordinary HTML element with a
 * class from index.css — no icon set, no utility classes, no runtime styling.
 */

import React from "react";

// --- Containers -------------------------------------------------------------
export function Box({
  title,
  actions,
  children,
  flush = false,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div className="box">
      {(title || actions) && (
        <div className="boxhead">
          <span>{title}</span>
          {actions && <span>{actions}</span>}
        </div>
      )}
      <div className={flush ? "boxbody flush" : "boxbody"}>{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

// --- Controls ---------------------------------------------------------------
export function Btn({
  children,
  primary = false,
  busy = false,
  ...rest
}: { primary?: boolean; busy?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={primary ? "primary" : undefined} disabled={busy || rest.disabled}>
      {busy ? "Working…" : children}
    </button>
  );
}

/** A button that reads as a hyperlink, for in-page navigation actions. */
export function LinkBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className="link">
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="fld">
      {label && <span className="lbl">{label}</span>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Text(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} />;
}

export function Num(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" {...props} />;
}

// --- Display ----------------------------------------------------------------
type Tone = "plain" | "ok" | "warn" | "bad";

export function Tag({ tone = "plain", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={tone === "plain" ? "tag" : `tag ${tone}`}>{children}</span>;
}

/** Two-column label/value table. Rows with a null value are dropped. */
export function KeyVals({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (shown.length === 0) return null;
  return (
    <table className="kv">
      <tbody>
        {shown.map(([k, v], i) => (
          <tr key={i}>
            <td className="k">{k}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Note({ kind = "info", title, children }: { kind?: "info" | "err"; title?: string; children: React.ReactNode }) {
  return (
    <div className={`note ${kind}`}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export function Busy({ label }: { label?: string }) {
  return <div className="busy">{label || "Working…"}</div>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <span className="t">{title}</span>
      {hint}
    </div>
  );
}

/** External link, marked so readers can see it leaves the app. */
export function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

/** Formats a number for a data cell; shows an em dash when absent. */
export function val(v: number | string | null | undefined, digits?: number): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return digits === undefined ? String(v) : v.toFixed(digits);
  return v;
}
