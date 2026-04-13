import React from "react";

export function Chip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/5 text-slate-200 px-2.5 py-1 text-xs ring-1 ring-white/10">
      {text}
    </span>
  );
}
