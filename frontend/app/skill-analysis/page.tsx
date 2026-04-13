"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeResumeMatch } from "@/lib/apiClient";

/* ======================= Types ======================= */
type BadgeTone = "positive" | "warning" | "neutral";
type Badge = { label: string; tone: BadgeTone };

type MatchItem = {
  job_title: string;
  rationale?: string;
  overlap?: string[];
  missing?: string[];
  coverage_pct?: number;
  density_pct?: number;
  score_pct?: number;
  badge?: Badge;
  recommend_url?: string;
};

type SprintItem = { day_range: string; focus: string; deliverable: string; metric: string };

type ResultPayload = {
  mode?: string;
  ui?: { headline?: string; badge?: Badge; cta?: string };
  source?: { source?: string; filename?: string; length?: number };
  resume_profile?: { skill_count?: number; skills?: string[]; notes?: string };
  matches?: MatchItem[];
  best_fit?: MatchItem & { expected_skills?: string[]; reason?: string };
  target_request?: { job_name?: string };
  target_report?: MatchItem & { expected_skills?: string[]; reason?: string };
  guidance?: {
    summary?: string;
    strengths?: string[];
    risks?: string[];
    insights?: string[];
    quick_wins?: string[];
    project_ideas?: string[];
    sprint_14_days?: SprintItem[];
    interview_warmups?: string[];
    keyword_mirrors?: string[];
    resume_edits?: string[];
    outreach_scripts?: string[];
    reading_list?: string[];
  };
  tip?: string;
};

/* ======================= Small UI atoms ======================= */
function ToneBadge({ badge }: { badge?: Badge }) {
  if (!badge?.label) return null;
  const tone =
    badge.tone === "positive"
      ? "bg-emerald-500/15 text-emerald-300"
      : badge.tone === "warning"
      ? "bg-amber-500/15 text-amber-300"
      : "bg-slate-500/15 text-slate-300";
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tone}`}>{badge.label}</span>;
}

function Pill({ text, dim = false }: { text: string; dim?: boolean }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs border ${
        dim ? "bg-white/5 text-slate-400 border-white/10" : "bg-white/10 text-slate-200 border-white/10"
      }`}
    >
      {text}
    </span>
  );
}

function StatLine({ coverage, density }: { coverage?: number; density?: number }) {
  const c = coverage != null ? Math.round(coverage) : null;
  const d = density != null ? Math.round(density) : null;
  return (
    <p className="text-xs text-slate-400 mt-3">
      {`Coverage ${c ?? "—"}%`} • {`Density ${d ?? "—"}%`}
    </p>
  );
}

function Headline({ text }: { text?: string }) {
  if (!text) return null;
  const parts = text.split("**");
  return (
    <h2 className="text-2xl md:text-3xl font-semibold text-slate-100">
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}
    </h2>
  );
}

/* ======= Pretty ring & bars ======= */
function Ring({ value = 0, label = "" }: { value?: number; label?: string }) {
  const r = 30, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value)), dash = (v / 100) * c;
  return (
    <div className="flex items-center gap-3">
      <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
        <circle cx="44" cy="44" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
        <circle
          cx="44" cy="44" r={r} stroke="url(#grad)" strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90 44 44)"
        />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <text x="44" y="48" textAnchor="middle" className="fill-slate-100" style={{ fontSize: 18, fontWeight: 800 }}>
          {Math.round(v)}%
        </text>
      </svg>
      {label ? <div className="text-xs text-slate-400">{label}</div> : null}
    </div>
  );
}

function Bar({ value = 0, label }: { value?: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span><span>{Math.round(v)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full" style={{
          width: `${v}%`,
          background: "linear-gradient(90deg, rgba(99,102,241,.9), rgba(139,92,246,.9))"
        }} />
      </div>
    </div>
  );
}

/* ======= Radar (pure SVG, animated “fluctuation”) ======= */
type RadarAxis = { label: string; value: number }; // 0..100
function Radar({ axes }: { axes: RadarAxis[] }) {
  const N = axes.length;
  const R = 70;
  const cx = 90, cy = 90;

  function pt(i: number, valPct: number) {
    const a = (Math.PI * 2 * i) / N - Math.PI / 2;
    const r = (R * valPct) / 100;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  const pts = axes.map((ax, i) => pt(i, ax.value));
  const path = pts.map((p) => p.join(",")).join(" ");

  return (
    <svg viewBox="0 0 180 180" className="w-60 h-60">
      {/* web */}
      {[20, 40, 60, 80, 100].map((t) => (
        <polygon key={t}
          points={axes.map((_, i) => pt(i, t).join(",")).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {/* axes */}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
      })}
      {/* shape */}
      <polygon
        points={path}
        fill="url(#radGrad)"
        stroke="rgba(139,92,246,.9)"
        strokeWidth={2}
        className="animate-[pulseRadar_2.6s_ease-in-out_infinite]"
      />
      {/* labels */}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 112);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" className="fill-slate-300" style={{ fontSize: 11 }}>
            {ax.label}
          </text>
        );
      })}
      <defs>
        <radialGradient id="radGrad" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(124, 58, 237, .35)" />
          <stop offset="100%" stopColor="rgba(99,102,241,.15)" />
        </radialGradient>
      </defs>
      <style jsx>{`
        @keyframes pulseRadar {
          0%,100% { transform: scale(1); opacity: .95; }
          50%     { transform: scale(1.03); opacity: 1; }
        }
      `}</style>
    </svg>
  );
}

/* ======================= Glorious Loader ======================= */
function GlamLoader({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div className="relative z-10 rounded-3xl border border-white/10 bg-neutral-900/90 p-8 shadow-2xl">
        {/* morphing glass pill */}
        <div className="relative mx-auto h-16 w-72 rounded-full overflow-hidden bg-white/[0.06]">
          <div className="absolute inset-0 animate-[sheen_2.2s_ease-in-out_infinite] opacity-90"
               style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)" }} />
          {/* orbiting dots */}
          {[0,1,2].map((k)=>(
            <div key={k}
              className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full"
              style={{
                left: "10%",
                animation: `orbit${k} 1.8s ${k*0.25}s ease-in-out infinite`,
                background: k===0?"#8b5cf6":k===1?"#6366f1":"#a78bfa",
                boxShadow: "0 0 18px rgba(139,92,246,.7)"
              }} />
          ))}
        </div>

        <p className="mt-5 text-center text-slate-200">Scoring your resume…</p>
        <div className="mt-3 text-center">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
          >
            Cancel
          </button>
        </div>

        <style jsx>{`
          @keyframes sheen {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes orbit0 {
            0% { transform: translate(0,-50%); }
            50% { transform: translate(220%,-50%); }
            100% { transform: translate(0,-50%); }
          }
          @keyframes orbit1 {
            0% { transform: translate(30%,-50%); }
            50% { transform: translate(250%,-50%); }
            100% { transform: translate(30%,-50%); }
          }
          @keyframes orbit2 {
            0% { transform: translate(60%,-50%); }
            50% { transform: translate(280%,-50%); }
            100% { transform: translate(60%,-50%); }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ======================= Empty-state hero ======================= */
function EmptyHero({
  filename, jobName, setJobName, onPick, onDropFile, onAnalyze, disabled,
}: {
  filename?: string | null;
  jobName: string;
  setJobName: (v: string) => void;
  onPick: () => void;
  onDropFile: (f: File) => void;
  onAnalyze: () => void;
  disabled: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-3xl p-8 md:p-10 border border-white/10 bg-gradient-to-b from-white/[0.02] to-white/[0.01]">
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100">Upload a resume to get started</h2>
      <p className="mt-2 text-slate-400 max-w-3xl">We’ll extract your skills, rank best-fit roles, and generate guided next steps.</p>

      <div
        className={`mt-6 rounded-2xl border-2 border-dashed transition bg-white/[0.04] ${
          dragOver ? "border-violet-300/60 bg-white/[0.06]" : "border-white/15 hover:border-white/25"
        }`}
        onClick={onPick}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files?.[0]; if (f && f.type === "application/pdf") onDropFile(f);
        }}
        role="button" aria-label="Upload resume" title="Upload resume" style={{ cursor: "pointer" }}
      >
        <div className="px-6 py-8 md:px-8 md:py-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-slate-300">
              {filename ? (<><span className="text-slate-400 mr-1">Selected:</span> {filename}</>) : (<>Drop a PDF here or click to choose.</>)}
            </div>
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <input
                type="text" placeholder="Optional: job name" value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                onClick={(e) => e.stopPropagation()} onFocus={(e) => e.stopPropagation()}
                className="cursor-text border border-white/10 rounded-xl bg-white/5 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              />
              <button
                onClick={(e) => { e.stopPropagation(); onAnalyze(); }} disabled={disabled}
                className="cursor-pointer w-full md:w-auto px-5 py-2.5 rounded-xl text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 active:scale-[0.99] transition disabled:opacity-50"
              >
                Analyze Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== PAGE ============================== */
export default function SkillAnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobName, setJobName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClear, setShowClear] = useState(false);
  const hiddenPickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { try {
    const raw = sessionStorage.getItem("skillAnalysisResult");
    if (raw) setResult(JSON.parse(raw));
  } catch {} }, []);

  const openPicker = useCallback(() => hiddenPickerRef.current?.click(), []);
  const handleDropFile = useCallback((f: File) => setFile(f), []);

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const data = await analyzeResumeMatch(file, jobName);
      setResult(data);
      sessionStorage.setItem("skillAnalysisResult", JSON.stringify(data));
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally { setLoading(false); }
  }

  function clearResults() {
    sessionStorage.removeItem("skillAnalysisResult");
    setResult(null); setFile(null); setJobName("");
    if (hiddenPickerRef.current) hiddenPickerRef.current.value = "";
    setShowClear(false);
  }

  const matches: MatchItem[] = useMemo(() => result?.matches ?? [], [result]);
  const target = result?.target_report;

  /* ===== Build radar metrics ===== */
  const radarAxes: RadarAxis[] | null = useMemo(() => {
    if (target) {
      const overlapPct =
        target.overlap && target.expected_skills && target.expected_skills.length > 0
          ? (100 * target.overlap.length) / target.expected_skills.length
          : (target.coverage_pct ?? 0);
      const gapInv = target.missing && target.expected_skills && target.expected_skills.length > 0
        ? Math.max(0, 100 - (100 * target.missing.length) / target.expected_skills.length)
        : Math.max(0, 100 - (target.coverage_pct ?? 0));
      return [
        { label: "Coverage", value: target.coverage_pct ?? 0 },
        { label: "Density",  value: target.density_pct  ?? 0 },
        { label: "Overlap",  value: Math.min(100, overlapPct) },
        { label: "Gaps↓",    value: Math.min(100, gapInv) },
        { label: "Score",    value: target.score_pct    ?? 0 },
      ];
    }
    if (result?.best_fit) {
      return [
        { label: "Coverage", value: result.best_fit.coverage_pct ?? 0 },
        { label: "Density",  value: result.best_fit.density_pct  ?? 0 },
        { label: "Score",    value: result.best_fit.score_pct    ?? 0 },
        { label: "Signals",  value: 70 },  // pleasant placeholder dimension to keep shape stars
        { label: "Readiness",value: 65 },
      ];
    }
    return null;
  }, [target, result]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      {/* Title + Clear */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
          Skill Analysis
        </h1>
        {result && (
          <button
            onClick={() => setShowClear(true)}
            className="cursor-pointer rounded-xl px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
          >
            Clear results
          </button>
        )}
      </div>

      {/* Hidden native picker */}
      <input
        ref={hiddenPickerRef}
        id="resume-picker"
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="hidden"
      />

      {/* Empty State */}
      {!result && !loading && (
        <div className="mt-10">
          <EmptyHero
            filename={file?.name || null}
            jobName={jobName}
            setJobName={setJobName}
            onPick={openPicker}
            onDropFile={handleDropFile}
            onAnalyze={handleAnalyze}
            disabled={loading || !file}
          />
        </div>
      )}

      {/* Headline + summary */}
      {result && (
        <div className="mt-10">
          <Headline text={result.ui?.headline || "Your best-fit roles (ranked)"} />
          <p className="mt-2 text-slate-400">
            {result.guidance?.summary ||
              "We computed overlap, density and coverage to rank roles for you."}
          </p>
        </div>
      )}

      {/* Target Role (job_name path) */}
      {target && (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="min-w-0 md:flex-1">
              <div className="text-lg md:text-xl font-semibold text-slate-100">
                Target Role: {target.job_title}
              </div>
              <div className="mt-2"><ToneBadge badge={result?.ui?.badge || target.badge} /></div>

              {target.overlap?.length ? (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Overlap</div>
                  <div className="flex flex-wrap gap-2">{target.overlap.map((t, i) => <Pill key={i} text={t} />)}</div>
                </div>
              ) : null}

              {target.missing?.length ? (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Gaps</div>
                  <div className="flex flex-wrap gap-2">{target.missing.map((t, i) => <Pill key={i} text={t} dim />)}</div>
                </div>
              ) : null}

              <div className="mt-5 grid sm:grid-cols-2 gap-4">
                <Bar value={target.coverage_pct} label="Coverage" />
                <Bar value={target.density_pct} label="Density" />
              </div>

              <div className="mt-5">
                {target.recommend_url && (
                  <a href={target.recommend_url} className="cursor-pointer text-violet-300 hover:text-violet-200 underline underline-offset-4">
                    Get a learning plan
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <Ring value={target.score_pct ?? 0} label="Overall match" />
              {radarAxes ? <Radar axes={radarAxes} /> : null}
            </div>
          </div>
        </div>
      )}

      {/* Best Fit (no job_name) */}
      {!target && result?.best_fit && (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 md:flex-1">
              <div className="text-lg md:text-xl font-semibold text-slate-100">Best Fit: {result.best_fit.job_title}</div>
              <div className="mt-2"><ToneBadge badge={result.ui?.badge || result.best_fit.badge} /></div>
              {result.best_fit.rationale && <p className="mt-4 text-slate-300">{result.best_fit.rationale}</p>}
              {Array.isArray(result.best_fit.overlap) && result.best_fit.overlap.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">{result.best_fit.overlap.map((t, i) => <Pill key={i} text={t} />)}</div>
              )}
              <StatLine coverage={result.best_fit.coverage_pct} density={result.best_fit.density_pct} />
            </div>
            <div className="flex flex-col items-center gap-4">
              <Ring value={result.best_fit.score_pct ?? 0} label="Overall match" />
              {radarAxes ? <Radar axes={radarAxes} /> : null}
            </div>
          </div>
        </div>
      )}

      {/* Matches Grid */}
      {!target && (result?.matches?.length ?? 0) > 0 && (
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {matches.map((m, idx) => (
            <div key={idx} className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 hover:bg-white/[0.04] transition shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-slate-100">{m.job_title}</div>
                  <div className="mt-1"><ToneBadge badge={m.badge} /></div>
                </div>
              </div>
              {m.rationale && <p className="mt-3 text-slate-300">{m.rationale}</p>}
              {Array.isArray(m.overlap) && m.overlap.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Overlap</div>
                  <div className="flex flex-wrap gap-2">{m.overlap.map((t, i) => <Pill key={i} text={t} />)}</div>
                </div>
              )}
              {Array.isArray(m.missing) && m.missing.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Gaps</div>
                  <div className="flex flex-wrap gap-2">{m.missing.map((t, i) => <Pill key={i} text={t} dim />)}</div>
                </div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-3 items-center">
                <Bar value={m.coverage_pct ?? 0} label="Coverage" />
                <Bar value={m.density_pct ?? 0} label="Density" />
                <Ring value={m.score_pct ?? 0} />
              </div>
              {m.recommend_url && (
                <div className="mt-4">
                  <a href={m.recommend_url} className="cursor-pointer text-violet-300 hover:text-violet-200 underline underline-offset-4">
                    Get a learning plan
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Guidance — “bouncy buckets” */}
      {result?.guidance && (
        <div className="mt-10 space-y-8">
          <GuidanceBuckets g={result.guidance} />
        </div>
      )}

      {/* Error */}
      {error && <p className="mt-6 text-red-400">{error}</p>}

      {/* Loader */}
      {loading && <GlamLoader onCancel={() => setLoading(false)} />}

      {/* Clear Modal */}
      {showClear && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative z-10 mx-auto mt-[20vh] w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/90 p-6 shadow-2xl">
            <div className="text-lg font-semibold text-slate-100">Clear saved analysis?</div>
            <p className="mt-2 text-slate-400 text-sm">This removes your uploaded file, job name, and saved results from this session.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowClear(false)}
                className="cursor-pointer rounded-xl px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition">Keep results</button>
              <button onClick={clearResults}
                className="cursor-pointer rounded-xl px-4 py-2 text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400">Clear now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= Guidance Buckets ======================= */
function Section({
  title, items, icon,
}: { title: string; items?: string[]; icon?: React.ReactNode }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-2xl p-5 border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div className="font-semibold text-slate-100">{title}</div>
      </div>
      <ul className="grid sm:grid-cols-2 gap-2">
        {items.map((t, i) => (
          <li key={i} className="text-sm text-slate-300">
            • {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sprint({ list }: { list?: SprintItem[] }) {
  if (!list || list.length === 0) return null;
  return (
    <div className="rounded-2xl p-5 border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition">
      <div className="font-semibold text-slate-100 mb-3">14-day Sprint</div>
      <div className="grid sm:grid-cols-3 gap-3">
        {list.map((s, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 hover:translate-y-[-2px] transition">
            <div className="text-xs text-slate-400">{s.day_range}</div>
            <div className="text-sm text-slate-200 mt-1">{s.focus}</div>
            <div className="text-xs text-slate-400 mt-1">Deliverable: {s.deliverable}</div>
            <div className="text-xs text-slate-400">Metric: {s.metric}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuidanceBuckets({ g }: { g: ResultPayload["guidance"] }) {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        <Section title="Strengths" items={g?.strengths} />
        <Section title="Risks" items={g?.risks} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Section title="Quick Wins" items={g?.quick_wins} />
        <Section title="Project Ideas" items={g?.project_ideas} />
      </div>

      <Sprint list={g?.sprint_14_days} />

      <div className="grid md:grid-cols-2 gap-6">
        <Section title="Interview Warmups" items={g?.interview_warmups} />
        <Section title="Keyword Mirrors" items={g?.keyword_mirrors} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Section title="Resume Edits" items={g?.resume_edits} />
        <Section title="Outreach Scripts" items={g?.outreach_scripts} />
      </div>

      <Section title="Reading List" items={g?.reading_list} />
    </>
  );
}
