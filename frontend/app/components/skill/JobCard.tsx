import React from "react";
import { Badge } from "./Badge";
import { Chip } from "./Chip";

type Match = {
  job_title: string;
  rationale?: string;
  overlap?: string[];
  missing?: string[];
  score_pct?: number;
  coverage_pct?: number;
  density_pct?: number;
  recommend_url?: string;
  badge?: { label: string; tone: "positive" | "warning" | "neutral" };
};

export function JobCard({ item, hero = false }: { item: Match; hero?: boolean }) {
  const pct = Math.round(item.score_pct ?? 0);
  return (
    <div className={`rounded-2xl p-5 backdrop-blur-md shadow-xl ring-1 ring-white/10 bg-gradient-to-br from-white/6 to-white/[0.02] transition
      hover:ring-violet-400/25 hover:shadow-violet-500/10 ${hero ? "border border-violet-500/20" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-100">{hero ? "Best Fit: " : ""}{item.job_title}</h3>
          {item.badge?.label && <Badge label={item.badge.label} tone={item.badge.tone} />}
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-slate-100">{pct}%</div>
          <div className="text-xs text-slate-400">match</div>
        </div>
      </div>

      {item.rationale && <p className="mt-3 text-sm text-slate-300">{item.rationale}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {item.overlap && item.overlap.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Overlap</p>
            <div className="flex flex-wrap gap-2">
              {item.overlap.slice(0, 10).map((s, i) => <Chip key={i} text={s} />)}
            </div>
          </div>
        )}
        {item.missing && item.missing.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Gaps</p>
            <div className="flex flex-wrap gap-2">
              {item.missing.slice(0, 10).map((s, i) => <Chip key={i} text={s} />)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-slate-400">
          Coverage {Math.round(item.coverage_pct ?? 0)}%  •  Density {Math.round(item.density_pct ?? 0)}%
        </div>
        {item.recommend_url && (
          <a href={item.recommend_url}
             className="text-violet-300 hover:text-violet-200 underline underline-offset-4">
            Get a learning plan
          </a>
        )}
      </div>
    </div>
  );
}
