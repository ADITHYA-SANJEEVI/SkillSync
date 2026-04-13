import React from "react";

type Tone = "positive" | "warning" | "neutral";
export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const map = {
    positive: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20",
    warning:  "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/20",
    neutral:  "bg-slate-500/15 text-slate-200 ring-1 ring-slate-400/20",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[tone]}`}>
      {label}
    </span>
  );
}
