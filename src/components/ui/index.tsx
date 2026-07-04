/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Small, calm UI primitives shared across every feature. One source of truth for
 * the app's look — replaces dozens of hand-copied Tailwind panel shells.
 */

import React from "react";
import { LucideIcon, Loader2 } from "lucide-react";

const ACCENT = "#0A355C";

// --- Panel ------------------------------------------------------------------
export function Panel({
  title,
  icon: Icon,
  actions,
  children,
  className = "",
  padded = true,
}: {
  title?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-[color:var(--accent)]" style={{ ["--accent" as any]: ACCENT }} />}
            {title && <h3 className="truncate text-sm font-semibold text-slate-800">{title}</h3>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

// --- Button -----------------------------------------------------------------
type ButtonVariant = "primary" | "secondary" | "ghost";
export function Button({
  variant = "primary",
  loading = false,
  icon: Icon,
  children,
  className = "",
  ...rest
}: {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: LucideIcon;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none px-4 py-2.5 cursor-pointer";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-[#0A355C] text-white hover:bg-[#082943] shadow-sm",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

// --- Field / inputs ---------------------------------------------------------
export function Field({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none focus:border-[#0A355C] focus:ring-2 focus:ring-[#0A355C]/10";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className || ""}`} />;
}

// --- Badge ------------------------------------------------------------------
type Tone = "slate" | "blue" | "green" | "amber" | "rose" | "sky";
const tones: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  blue: "bg-[#0A355C]/10 text-[#0A355C] border-[#0A355C]/20",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
};
export function Badge({ tone = "slate", icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

// --- Stat tile --------------------------------------------------------------
export function StatTile({ label, value, unit, tone = "slate" }: { label: string; value: React.ReactNode; unit?: string; tone?: Tone }) {
  const color = tone === "rose" ? "text-rose-600" : tone === "green" ? "text-emerald-600" : tone === "blue" ? "text-[#0A355C]" : "text-slate-800";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${color}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

// --- Misc -------------------------------------------------------------------
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin text-[#0A355C]" />
      {label}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon?: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      {Icon && <Icon className="h-8 w-8 text-slate-300" />}
      <div className="text-sm font-medium text-slate-600">{title}</div>
      {hint && <div className="max-w-sm text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{children}</div>;
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
        active ? "border-[#0A355C] bg-[#0A355C]/10 text-[#0A355C]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
