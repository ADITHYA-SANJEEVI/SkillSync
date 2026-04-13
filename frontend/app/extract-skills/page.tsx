"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractSkills } from "@/lib/apiClient";

/* ======================= Types ======================= */
type Group = { name?: string; title?: string; group?: string; items?: string[]; skills?: string[] };
type ExtractResult = Record<string, any>;

/* ======================= UI atoms ======================= */
function Chip({ text, dim = false }: { text: string; dim?: boolean }) {
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

/* Static completion ring (result card) */
function Ring({ value = 100, label = "Extraction complete" }: { value?: number; label?: string }) {
  const r = 28, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value)), dash = (v / 100) * c;
  return (
    <div className="flex items-center gap-3">
      <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0">
        <defs>
          <linearGradient id="gradA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle cx="38" cy="38" r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="none" />
        <circle
          cx="38" cy="38" r={r} stroke="url(#gradA)" strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90 38 38)" />
      </svg>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

/* Overlay loader (only thing that spins) */
function AuroraLoader({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" />
      <div className="relative z-10 w-[min(92vw,520px)] rounded-3xl border border-white/10 bg-neutral-900/90 p-7 shadow-2xl">
        <div className="relative mx-auto h-28 w-28">
          <div
            className="absolute inset-0 rounded-full blur-xl opacity-70 animate-[spin_3s_linear_infinite]"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(99,102,241,.28), rgba(139,92,246,.28), rgba(99,102,241,.28))",
            }}
          />
          <div
            className="absolute inset-2 rounded-full blur-[10px] opacity-80 animate-[spin_2s_linear_infinite_reverse]"
            style={{
              background:
                "conic-gradient(from 120deg, rgba(139,92,246,.4), rgba(167,139,250,.25), rgba(99,102,241,.35))",
            }}
          />
          <div className="absolute inset-6 rounded-full bg-white/[0.07] backdrop-blur-sm" />
          <div className="absolute -inset-2 rounded-full ring-1 ring-violet-400/20 animate-[pulse_2.6s_ease-in-out_infinite]" />
        </div>
        <p className="mt-5 text-center text-slate-200">Extracting and grouping skills…</p>
        <div className="mt-3 text-center">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* Upload hero */
function UploadHero({
  filename, onPick, onDropFile, onAnalyze, disabled,
}: {
  filename?: string | null;
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

      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100">Upload your résumé</h2>
      <p className="mt-2 text-slate-400 max-w-3xl">Accepts PDF or TXT. We’ll parse, normalize, and group your skills.</p>

      <div
        className={`mt-6 rounded-2xl border-2 border-dashed transition bg-white/[0.04] ${
          dragOver ? "border-violet-300/60 bg-white/[0.06]" : "border-white/15 hover:border-white/25"
        }`}
        onClick={onPick}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && (f.type === "application/pdf" || f.type === "text/plain")) onDropFile(f);
        }}
        role="button"
        aria-label="Upload resume"
        title="Upload resume"
        style={{ cursor: "pointer" }}
      >
        <div className="px-6 py-8 md:px-8 md:py-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-slate-300">
              {filename ? (
                <>
                  <span className="text-slate-400 mr-1">Selected:</span> {filename}
                </>
              ) : (
                <>Drop a PDF/TXT here or click to choose.</>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onAnalyze(); }} disabled={disabled}
              className="cursor-pointer w-full md:w-auto px-5 py-2.5 rounded-xl text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 active:scale-[0.99] transition disabled:opacity-50"
            >
              Analyze now
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Tip: You can also drag &amp; drop a file onto this card.</p>
        </div>
      </div>
    </div>
  );
}

/* ======================= Unwrap + normalize ======================= */
function unwrap(x: any): any {
  if (x == null) return null;
  let v = x;
  for (const k of ["result", "data", "payload"]) {
    if (v && typeof v === "object" && k in v) v = v[k];
  }
  return v;
}

function normalizeGroups(raw: any): { groups: Group[]; fallback: Group[] } {
  const v = unwrap(raw);
  if (!v || typeof v !== "object") return { groups: [], fallback: [] };

  const vg: any = (v as any).groups;
  if (Array.isArray(vg)) return { groups: vg as Group[], fallback: [] };
  if (Array.isArray((v as any).buckets)) return { groups: (v as any).buckets as Group[], fallback: [] };

  // dict maps
  const toGroups = (obj: any): Group[] =>
    Object.entries(obj as Record<string, unknown>).map(([name, arr]) => ({
      name,
      items: Array.isArray(arr) ? (arr as string[]) : [],
    }));

  if (vg && typeof vg === "object") return { groups: toGroups(vg), fallback: [] };
  const alt = (v as any).grouped_skills || (v as any).grouped || (v as any).categories;
  if (alt && typeof alt === "object") return { groups: toGroups(alt), fallback: [] };

  // flat lists
  const flat =
    (v as any).skills ||
    (v as any).extracted_skills ||
    (v as any).extracted ||
    (v as any).entities ||
    (v as any).keywords;
  if (Array.isArray(flat)) return { groups: [{ name: "Skills", items: flat }], fallback: [] };

  // deep scan fallback
  const seen = new Set<any>();
  const fb: Group[] = [];
  function walk(node: any, prefix = "") {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    for (const [k, val] of Object.entries(node)) {
      const label = prefix ? `${prefix}.${k}` : k;
      if (Array.isArray(val) && val.every((x) => typeof x === "string") && val.length > 0 && val.length <= 400) {
        fb.push({ name: label, items: val as string[] });
      } else if (val && typeof val === "object") {
        walk(val, label);
      }
    }
  }
  walk(v);
  return { groups: [], fallback: fb };
}

/* ======================= Regrouping Heuristic ======================= */
/** canonicalize tokens to stable lowercase, strip punctuation variants */
function canon(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[_\-]/g, match => (match === "_" ? " " : " "));
}
function alias(s: string): string {
  const c = canon(s);
  if (c === "js") return "javascript";
  if (c === "ts") return "typescript";
  if (c === "cpp" || c === "c++") return "cpp";
  if (c === "node" || c === "nodejs" || c === "node.js") return "node.js";
  if (c === "nextjs" || c === "next js") return "next.js";
  if (c === "open cv" || c === "opencv") return "open cv";
  if (c === "ci cd" || c === "ci/cd") return "ci-cd";
  if (c === "postgres" || c === "postgresql") return "postgresql";
  return c;
}

type CanonSet = Set<string>;
const set = (arr: string[]): CanonSet => new Set(arr.map(alias));

const LANGUAGES = set([
  "python","javascript","typescript","cpp","java","c","c#","go","rust","sql","r","kotlin","scala","bash","shell"
]);

const FRONTEND = set(["react","next.js","vue","angular","svelte","astro"]);
const BACKEND  = set(["fastapi","django","flask","express","spring","laravel","rails","node.js"]);
const DATABASE = set(["postgresql","mongodb","mysql","sqlite","redis","supabase","dynamodb"]);
const DEVOPS   = set(["docker","kubernetes","terraform","aws","gcp","azure","ci-cd","github actions"]);
const SECURITY = set(["oauth","jwt","oidc"]);
const ML_AI    = set([
  "mlops","hugging face","xgboost","scikit-learn","pytorch","tensorflow","open cv",
  "artificial intelligence","machine learning","deep learning","natural language processing","nlp"
]);

/** Take whatever groups/fallback we got and produce final sections + longTail */
function regroup(groups: Group[], fallback: Group[]) {
  // collect every token we can see
  const all: string[] = [];
  const pushItems = (items?: string[]) => {
    if (!Array.isArray(items)) return;
    for (const t of items) if (t && typeof t === "string") all.push(t);
  };

  for (const g of groups) pushItems(g.items || g.skills);
  for (const f of fallback) pushItems(f.items);

  // unique preserve order
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const t of all) {
    const a = alias(t);
    if (!seen.has(a)) { seen.add(a); tokens.push(t); } // keep original casing for display
  }

  // bucketize
  const out: Record<string, string[]> = {
    Languages: [],
    Frontend: [],
    Backend: [],
    Databases: [],
    "Cloud Devops": [],
    "Security Auth": [],
    "ML AI": [],
    Other: [],
  };

  const displayToCanon = (s: string) => alias(s);

  for (const tok of tokens) {
    const a = displayToCanon(tok);

    if (LANGUAGES.has(a)) out["Languages"].push(tok);
    else if (FRONTEND.has(a)) out["Frontend"].push(tok);
    else if (BACKEND.has(a)) out["Backend"].push(tok);
    else if (DATABASE.has(a)) out["Databases"].push(tok);
    else if (DEVOPS.has(a)) out["Cloud Devops"].push(tok);
    else if (SECURITY.has(a)) out["Security Auth"].push(tok);
    else if (ML_AI.has(a)) out["ML AI"].push(tok);
    else out["Other"].push(tok);
  }

  // build long-tail by removing anything already categorized (de-dup)
  const categorizedCanon = new Set<string>();
  Object.values(out).forEach(arr => arr.forEach(x => categorizedCanon.add(alias(x))));
  const longTail = tokens.filter(t => !categorizedCanon.has(alias(t)));

  return { buckets: out, longTail };
}

/* ======================= Page ======================= */
export default function ExtractSkillsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClear, setShowClear] = useState(false);
  const hiddenPickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("extractSkillsResult");
      if (raw) setResult(JSON.parse(raw));
    } catch {}
  }, []);

  const openPicker = useCallback(() => hiddenPickerRef.current?.click(), []);
  const handleDropFile = useCallback((f: File) => setFile(f), []);

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const data = await extractSkills(file);
      setResult(data as ExtractResult);
      sessionStorage.setItem("extractSkillsResult", JSON.stringify(data));
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  function clearResults() {
    sessionStorage.removeItem("extractSkillsResult");
    setResult(null); setFile(null);
    if (hiddenPickerRef.current) hiddenPickerRef.current.value = "";
    setShowClear(false);
  }

  const { groups, fallback } = useMemo(() => normalizeGroups(result), [result]);

  // NEW: smart regroup + long-tail
  const regrouped = useMemo(() => regroup(groups, fallback), [groups, fallback]);

  // Turn regrouped buckets into visual sections
  const visualSections = useMemo(
    () =>
      ([
        "Backend",
        "Cloud Devops",
        "Databases",
        "Frontend",
        "Languages",
        "ML AI",
        "Security Auth",
        "Other",
      ] as const).map((title) => ({
        title,
        items: regrouped.buckets[title] || [],
      })),
    [regrouped.buckets]
  );

  // Long-tail (flat) already deduped against sections
  const longTail = regrouped.longTail;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      {/* Title + Endpoint + Clear */}
      <div className="flex items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
            Extract Skills
          </h1>
          <p className="mt-2 text-xs md:text-sm text-slate-500">
            POST to <span className="underline decoration-dotted">http://localhost:8000/api/v1/llm/ml/extract-skills</span>
          </p>
        </div>
        {result && (
          <button
            onClick={() => setShowClear(true)}
            className="cursor-pointer rounded-2xl px-4 py-2 border border-violet-400/30 text-slate-100
                       bg-gradient-to-r from-white/5 to-white/5 hover:from-white/10 hover:to-white/10
                       shadow-[0_0_0_1px_rgba(139,92,246,0.18),_0_10px_30px_rgba(0,0,0,0.35)]
                       transition"
          >
            Clear results
          </button>
        )}
      </div>

      {/* Hidden input */}
      <input
        ref={hiddenPickerRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="hidden"
      />

      {/* Empty state */}
      {!result && !loading && (
        <div className="mt-10">
          <UploadHero
            filename={file?.name || null}
            onPick={openPicker}
            onDropFile={handleDropFile}
            onAnalyze={handleAnalyze}
            disabled={loading || !file}
          />
        </div>
      )}

      {/* Summary card */}
      {result && (
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 md:flex-1">
              <div className="text-lg md:text-xl font-semibold text-slate-100">
                {result?.ui?.headline || "Parsed skills"}
              </div>
              {result?.source?.filename && (
                <p className="mt-1 text-sm text-slate-400">
                  Source: {result.source.filename}
                  {typeof result?.source?.length === "number" ? ` • ${result.source.length} chars` : ""}
                </p>
              )}
              {result?.notes && <p className="mt-3 text-slate-300">{result.notes}</p>}
              {(result?.ui?.tip || (result as any)?.tip) && (
                <p className="mt-2 text-xs text-slate-500">{result?.ui?.tip || (result as any)?.tip}</p>
              )}
            </div>
            <Ring value={100} />
          </div>
        </div>
      )}

      {/* Organized sections (smart regrouped) */}
      {result && (
        <div className="mt-10 space-y-8">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Skills</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {visualSections.map((sec) => (
              <div
                key={sec.title}
                className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 hover:bg-white/[0.04] transition shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
              >
                <div className="mb-3 font-semibold text-slate-100">{sec.title}</div>
                {sec.items.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sec.items.map((t, i) => (
                      <Chip key={i} text={t} />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">No items.</div>
                )}
              </div>
            ))}
          </div>

          {/* Long-tail (flat) */}
          {longTail.length > 0 && (
            <section className="mt-10">
              <h3 className="text-2xl md:text-3xl font-bold text-slate-100 mb-4">Long-Tail Skills</h3>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                <div className="text-slate-200 font-medium mb-3">Flat</div>
                <div className="flex flex-wrap gap-2">
                  {longTail.map((t, i) => (
                    <Chip key={i} text={t} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Raw viewer & errors */}
      {result && <RawViewer data={unwrap(result)} />}
      {error && <p className="mt-6 text-red-400">{error}</p>}

      {/* Loader & clear modal */}
      {loading && <AuroraLoader onCancel={() => setLoading(false)} />}
      {showClear && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative z-10 mx-auto mt-[20vh] w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/90 p-6 shadow-2xl">
            <div className="text-lg font-semibold text-slate-100">Clear saved extraction?</div>
            <p className="mt-2 text-slate-400 text-sm">
              This removes your uploaded file and parsed results from this session.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowClear(false)}
                className="cursor-pointer rounded-xl px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
              >
                Keep
              </button>
              <button
                onClick={clearResults}
                className="cursor-pointer rounded-xl px-4 py-2 text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400"
              >
                Clear now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Raw JSON viewer (unchanged) ---------------- */
function RawViewer({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <div className="mt-8">
      <button
        onClick={() => setOpen(!open)}
        className="cursor-pointer rounded-xl px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
      >
        {open ? "Hide raw response" : "View raw response"}
      </button>
      {open && (
        <pre className="mt-3 max-h-[42vh] overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-slate-300">
{JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
