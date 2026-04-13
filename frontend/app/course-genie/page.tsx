"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, Trash2, Wand2, Check } from "lucide-react";

/* ─────────────────────────── Config ─────────────────────────── */
const API_BASE =
  (typeof window !== "undefined" && (window as any).__API_BASE__) ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://127.0.0.1:8000";

const RECOMMEND_ENDPOINT = `${API_BASE}/api/v1/llm/ml/recommend`;      // POST text/plain  → LLM buckets/raw list
const ENRICH_ENDPOINT    = `${API_BASE}/api/v1/llm/ml/enrich-courses`;  // POST JSON       → duration/cost enrich (server scrapes JSON-LD/OGP)

const SS_KEY_TEXT   = "courseGenie.input.v1";
const SS_KEY_RESULT = "courseGenie.result.v1";
const HINT_KEY      = "courseGenie.compare.hint.shown";

/* ─────────────────────────── Types ─────────────────────────── */
type Course = {
  title: string;
  source?: string;
  duration?: string;
  cost?: string;
  link?: string;
  why?: string;
};
type Buckets = Record<string, Course[]>;

/* Visible buckets — projects/certs are silently merged into Foundations */
const ORDERED_BUCKETS = ["Quick Wins", "Foundations", "Stretch"] as const;

/* ─────────────────────────── Helpers ─────────────────────────── */
function pipeStringToCourse(s: string): Course {
  const parts = (s ?? "").split("|").map((x) => x.trim());
  const [title, source, duration, cost, link] = parts;
  return {
    title: title || (s || "Untitled"),
    ...(source ? { source } : {}),
    ...(duration ? { duration } : {}),
    ...(cost ? { cost } : {}),
    ...(link ? { link } : {}),
  };
}
function toCourse(x: any): Course {
  if (typeof x === "string") return pipeStringToCourse(x);
  if (x && typeof x === "object") {
    const title    = x.title ?? x.name ?? "Untitled";
    const source   = x.source ?? x.platform ?? x.provider;
    const duration = x.duration ?? x.hours ?? x.time ?? x.length;
    const cost     = x.cost ?? x.price ?? x.fee;
    const link     = x.link ?? x.url ?? x.href;
    const why      = x.why ?? x.reason ?? x.description;
    return {
      title: String(title),
      ...(source ? { source: String(source) } : {}),
      ...(duration ? { duration: String(duration) } : {}),
      ...(cost ? { cost: String(cost) } : {}),
      ...(link ? { link: String(link) } : {}),
      ...(why ? { why: String(why) } : {}),
    };
  }
  return { title: String(x ?? "Untitled") };
}
function normalizeBucket(data: any): Course[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(toCourse);
  if (typeof data === "object") {
    const arr =
      (Array.isArray((data as any).courses) && (data as any).courses) ||
      (Array.isArray((data as any).items) && (data as any).items) ||
      (Array.isArray((data as any).list) && (data as any).list);
    if (arr) return arr.map(toCourse);
    return [toCourse(data)];
  }
  if (typeof data === "string") return [toCourse(data)];
  return [];
}
function resolveLink(c: Course): string | undefined {
  const raw = c.link?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.toLowerCase() === "search") {
    const q = encodeURIComponent(`${c.title} ${c.source ?? ""}`.trim());
    if (c.source && /youtube/i.test(c.source)) return `https://www.youtube.com/results?search_query=${q}`;
    return `https://www.google.com/search?q=${q}`;
  }
  return raw;
}

/* Extract embedded JSON from noisy text */
function extractJsonString(raw: string): string | null {
  if (!raw) return null;
  const fence = /```(?:json|javascript|js)?\s*([\s\S]*?)```/i.exec(raw);
  if (fence?.[1]) return fence[1].trim();
  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1).trim();
  const m = /"courses"\s*:\s*\[(?:[\s\S]*?)\]/i.exec(raw);
  if (m?.[0]) return `{ ${m[0]} }`;
  return null;
}
function unescapeJsonLikeString(s: string): string {
  try {
    const decoded = JSON.parse(`"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
    return String(decoded);
  } catch {
    return s.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
}

/* Bucketize flat list */
function bucketizeFlatList(courses: Course[]): Buckets {
  const out: Buckets = {
    "Quick Wins": [],
    Foundations: [],
    Projects: [],
    Certifications: [],
    Stretch: [],
  };
  const txt = (s?: string) => (s ?? "").toLowerCase();
  const has = (s: string, words: string[]) => words.some((w) => s.includes(w));
  for (const c0 of courses) {
    const c = { ...c0, link: resolveLink(c0) };
    const t = txt(c.title), s = txt(c.source);
    if (has(t, ["specialization", "nanodegree", "professional certificate", "certification", "certificate"])) { out["Certifications"].push(c); continue; }
    if (has(t, ["project", "capstone", "build", "workshop", "lab"]) || has(s, ["project"])) { out["Projects"].push(c); continue; }
    if (has(t, ["intro", "introduction", "basics", "crash", "quick", "micro", "primer", "101"]) || has(s, ["kaggle", "youtube", "mode"])) { out["Quick Wins"].push(c); continue; }
    if (has(t, ["advanced", "expert", "deep", "systems", "optimization", "at scale"])) { out["Stretch"].push(c); continue; }
    if (has(t, ["fundamentals", "foundation", "core", "essentials", "for everyone"])) { out["Foundations"].push(c); continue; }
    out["Foundations"].push(c);
  }
  return out;
}

/* Parse raw → buckets (handles reply wrappers) */
function parseBuckets(raw: string): Buckets {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { "Quick Wins": [], Foundations: [], Projects: [], Certifications: [], Stretch: [] };

  try {
    const outer = JSON.parse(trimmed);
    if (typeof outer?.reply === "string") {
      const unescaped = unescapeJsonLikeString(outer.reply);
      const innerMaybe = extractJsonString(unescaped) ?? unescaped;
      try {
        const inner = JSON.parse(innerMaybe);
        if (Array.isArray(inner?.courses)) return bucketizeFlatList(normalizeBucket(inner.courses));
        const out: Buckets = {}; for (const [k, v] of Object.entries(inner)) out[k] = normalizeBucket(v);
        return out;
      } catch {}
    }
    if (Array.isArray(outer?.courses)) return bucketizeFlatList(normalizeBucket(outer.courses));
    const keys = Object.keys(outer || {});
    if (keys.some((k) => ["Quick Wins","Foundations","Projects","Certifications","Stretch"].includes(k))) {
      const out: Buckets = {}; for (const [k, v] of Object.entries(outer)) out[k] = normalizeBucket(v); return out;
    }
    for (const k of ["data","result","message","text"]) {
      const val = (outer as any)?.[k];
      if (typeof val === "string") {
        const unescaped = unescapeJsonLikeString(val);
        const innerMaybe = extractJsonString(unescaped) ?? unescaped;
        try {
          const inner = JSON.parse(innerMaybe);
          if (Array.isArray(inner?.courses)) return bucketizeFlatList(normalizeBucket(inner.courses));
          const out: Buckets = {}; for (const [kk, vv] of Object.entries(inner)) out[kk] = normalizeBucket(vv); return out;
        } catch {}
      }
    }
  } catch {}

  const jsonMaybe = extractJsonString(trimmed);
  if (jsonMaybe) {
    try {
      const obj = JSON.parse(jsonMaybe);
      if (Array.isArray((obj as any).courses)) return bucketizeFlatList(normalizeBucket((obj as any).courses));
      const out: Buckets = {}; for (const [k, v] of Object.entries(obj)) out[k] = normalizeBucket(v); return out;
    } catch {}
  }

  try {
    const out: Buckets = {};
    const lines = trimmed.split(/\r?\n/);
    let current: string | null = null;
    for (const rawLine of lines) {
      const line = rawLine.trim(); if (!line) continue;
      const hd = /^#{1,6}\s+(.+)$/.exec(line);
      if (hd) { current = hd[1].trim(); if (!out[current]) out[current] = []; continue; }
      if (/^[-*]\s+/.test(line) && current) out[current].push(pipeStringToCourse(line.replace(/^[-*]\s+/, "").trim()));
    }
    const any = Object.values(out).some((a) => a.length);
    if (any) return out;
  } catch {}

  return bucketizeFlatList([pipeStringToCourse(trimmed)]);
}

/* Hide Projects/Certifications by merging into Foundations */
function collapseBuckets(b: Buckets | null): Buckets | null {
  if (!b) return b;
  const merged = { ...b };
  if (!merged["Foundations"]) merged["Foundations"] = [];
  for (const key of ["Projects", "Certifications"] as const) {
    if (Array.isArray(merged[key]) && merged[key].length) {
      merged["Foundations"] = [...merged["Foundations"], ...merged[key]];
    }
    merged[key] = [];
  }
  return merged;
}

/* Inference helpers (fallbacks only) */
function inferLevel(title = ""): string {
  const t = title.toLowerCase();
  if (/(intro|introduction|beginner|basics|101|foundations|fundamentals)/.test(t)) return "Intro";
  if (/(advanced|expert|deep|ii|2)/.test(t)) return "Advanced";
  return "General";
}
function inferFormat(source = "", title = ""): string {
  const s = `${source} ${title}`.toLowerCase();
  if (/youtube|video/.test(s)) return "Video";
  if (/kaggle|micro|lab|workshop|project/.test(s)) return "Micro-course";
  return "Course";
}
function platformEmoji(source = ""): string {
  const s = source?.toLowerCase() || "";
  if (/coursera/.test(s)) return "🎓";
  if (/udemy/.test(s)) return "📘";
  if (/edx/.test(s)) return "🏛️";
  if (/kaggle/.test(s)) return "📊";
  if (/youtube/.test(s)) return "▶️";
  if (/linkedin/.test(s)) return "💼";
  return "📚";
}
function inferDurationFrom(texts: string[]): string | undefined {
  const blob = texts.filter(Boolean).join(" ").toLowerCase();
  const m =
    blob.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/) ||
    blob.match(/\b(\d+(?:\.\d+)?)\s*(weeks?|wks?)\b/) ||
    blob.match(/\b(\d+(?:\.\d+)?)\s*(days?)\b/);
  if (!m) return undefined;
  const val = m[1];
  const unit = m[2].replace(/s$/, "");
  return `${val} ${unit}${val !== "1" && !/^\d+\.\d+$/.test(val) ? "s" : ""}`;
}
function inferCostFrom(source = "", link = ""): string | undefined {
  const s = `${source} ${link}`.toLowerCase();
  if (/youtube|kaggle|mode\.com/.test(s)) return "Free";
  if (/coursera/.test(s)) return "Free to audit / Paid certificate";
  if (/edx/.test(s)) return "Free to audit / Paid certificate";
  if (/udemy/.test(s)) return "Paid (often discounted)";
  if (/linkedin/.test(s)) return "Paid (subscription)";
  return undefined;
}
function enrichLocal(c: Course): Course {
  const duration = c.duration || inferDurationFrom([c.title, c.why ?? ""]);
  const cost     = c.cost     || inferCostFrom(c.source, c.link ?? "");
  return { ...c, ...(duration ? { duration } : {}), ...(cost ? { cost } : {}) };
}

/* ─────────────────────────── Loader Overlay (Prism only) ─────────────────────────── */
/** Prism Sweep: premium glass pill with angled sheen + subtle dot-fill */
/** Prism Sweep — gradient blue dots (indigo→violet), no yellow */
function PrismSweep({ label = "Curating your learning path..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5">
      <div
        aria-hidden="true"
        className="relative w-[360px] max-w-[86vw] h-12 rounded-full border border-white/12 bg-white/[0.06] backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_0_1px_rgba(255,255,255,0.12)] overflow-hidden"
      >
        {/* Moving sheen, tinted to theme */}
        <div className="absolute -inset-1 [background:linear-gradient(115deg,transparent_35%,rgba(129,140,248,0.25)_50%,transparent_65%)] animate-[sheen_2.2s_linear_infinite]" />

        {/* Theme dots (indigo→violet) */}
        <div className="absolute inset-0 grid grid-cols-18 place-items-center px-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, rgba(129,140,248,0.95), rgba(167,139,250,0.95))", // indigo-400 → violet-400
                boxShadow:
                  "0 0 10px rgba(129,140,248,0.35), 0 0 18px rgba(167,139,250,0.25)",
                animation: "dotfill 1400ms ease-in-out infinite",
                animationDelay: `${i * 70}ms`,
              }}
            />
          ))}
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="px-4 py-1.5 rounded-full border border-white/12 bg-white/8 text-white/90 text-sm"
      >
        {label}
      </div>
    </div>
  );
}


/** Fullscreen overlay: sits UNDER taskbar/compare dock (z-30; taskbar is ≥ z-40) */
function LoaderOverlay({
  show,
  message = "Curating your learning path...",
}: {
  show: boolean;
  message?: string;
}) {
  if (!show) return null;
  return (
    <div
      aria-busy="true"
      aria-describedby="loader-hint"
      className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none"
    >
      {/* subtle backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(54,57,127,0.22),rgba(10,10,10,0.65))] backdrop-blur-sm" />
      {/* content */}
      <div className="relative z-[1] pointer-events-auto">
        <PrismSweep label={message} />
        <p id="loader-hint" className="mt-2 text-[11px] text-white/70 text-center">
          Safe to navigate with the taskbar.
        </p>
      </div>

      <style jsx>{`
        @keyframes sheen {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }
        @keyframes dotfill {
          0%, 60% { background: rgba(255,255,255,0.15); transform: scale(1); }
          30% { background: rgba(255,255,255,0.75); transform: scale(1.25); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────── UI: Compare Dock & Modal ─────────────────────────── */
function CompareDock({
  count,
  onCompare,
  onClear,
}: { count: number; onCompare: () => void; onClear: () => void }) {
  const enabled = count === 2;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="cursor-default rounded-full border border-white/12 bg-white/[0.08] backdrop-blur-md px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)] flex items-center gap-2">
        <span className="text-sm text-white/90 px-2 py-1 rounded-full border border-white/10 bg-white/5">{count} selected</span>
        <button
          onClick={onCompare}
          disabled={!enabled}
          className={`cursor-pointer px-4 py-2 rounded-full text-sm text-white transition
            ${enabled
              ? "bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 animate-[pulse_2.4s_ease-in-out_infinite]"
              : "bg-white/10 text-white/60"}`}
        >
          Compare
        </button>
        <button
          onClick={onClear}
          className="cursor-pointer px-3 py-2 rounded-full text-sm text-white/80 border border-white/10 hover:bg-white/10"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
function Row({ label, a, b }: { label: string; a?: string; b?: string }) {
  const diff = (a ?? "") !== (b ?? "");
  const cls = diff ? "underline decoration-indigo-400/60" : "";
  return (
    <div className="grid grid-cols-3 gap-3 py-2 text-sm">
      <div className="text-white/70">{label}</div>
      <div className={`text-white/90 ${cls}`}>{a ?? "—"}</div>
      <div className={`text-white/90 ${cls}`}>{b ?? "—"}</div>
    </div>
  );
}
function CompareModal({ a, b, onClose }: { a: Course; b: Course; onClose: () => void }) {
  const rows = [
    ["Summary", a.why, b.why],
    ["Duration", a.duration, b.duration],
    ["Cost", a.cost, b.cost],
    ["Level", inferLevel(a.title), inferLevel(b.title)],
    ["Format", inferFormat(a.source, a.title), inferFormat(b.source, b.title)],
    ["Platform", a.source, b.source],
  ] as const;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto max-w-5xl mt-10 mb-10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] border border-white/12 rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white/95">Compare Courses</h3>
          <button onClick={onClose} className="cursor-pointer text-white/80 hover:text-white">✕</button>
        </div>

        <div className="grid md:grid-cols-2 gap-0">
          {[a, b].map((c, i) => (
            <div key={i} className="p-6 border-white/10 md:[&:not(:last-child)]:border-r">
              <div className="flex items-center justify-between">
                <div className="text-white/95 font-semibold leading-snug pr-3">{c.title}</div>
                {c.link ? (
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400"
                  >
                    <ExternalLink size={12} /> Open
                  </a>
                ) : null}
              </div>
              <div className="mt-1 text-sm text-white/75">{platformEmoji(c.source)} {c.source ?? "—"}</div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4">
          {rows.map(([label, av, bv], i) => (
            <div key={i} style={{ animation: `stagger .4s ease both`, animationDelay: `${i * 40}ms` }}>
              <Row label={label} a={av} b={bv} />
              <div className="h-px bg-white/8" />
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes stagger { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0);} }
      `}</style>
    </div>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */
export default function CourseGeniePage() {
  const [input, setInput] = useState<string>("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [buckets, setBuckets] = useState<Buckets | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compare state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [comparePair, setComparePair] = useState<[Course, Course] | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Enrichment state
  const [enriching, setEnriching] = useState(false);
  const [enrichedMap, setEnrichedMap] = useState<Record<string, { duration?: string; cost?: string }>>({});

  useEffect(() => {
    try {
      const savedText = sessionStorage.getItem(SS_KEY_TEXT);
      const savedResult = sessionStorage.getItem(SS_KEY_RESULT);
      if (savedText) setInput(savedText);
      if (savedResult) setBuckets(collapseBuckets(parseBuckets(savedResult)));
    } catch {}
  }, []);
  useEffect(() => { try { sessionStorage.setItem(SS_KEY_TEXT, input || ""); } catch {} }, [input]);

  // hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && selectedIds.length === 2) {
        e.preventDefault();
        triggerCompare();
      } else if (e.key === "Escape" && comparePair) {
        e.preventDefault();
        setComparePair(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, comparePair]);

  const hasAny = useMemo(
    () => !!buckets && Object.values(buckets).some((arr) => Array.isArray(arr) && arr.length),
    [buckets]
  );

  async function handleRecommend() {
    setError(null); setLoading(true);
    try {
      const url = `${RECOMMEND_ENDPOINT}?ai=1&temperature=0.2&max_tokens=1200`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: input || "" });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      sessionStorage.setItem(SS_KEY_RESULT, text);
      const parsed = collapseBuckets(parseBuckets(text));
      setBuckets(parsed);
      setSelectedIds([]);
      // kick off enrichment (non-blocking)
      void enrichFromBackend(parsed);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch recommendations.");
    } finally { setLoading(false); }
  }

  function actuallyClear() {
    setConfirmClear(false);
    try { sessionStorage.removeItem(SS_KEY_TEXT); sessionStorage.removeItem(SS_KEY_RESULT); } catch {}
    setInput(""); setBuckets(null); setSelectedFilter("all"); setSelectedIds([]);
    setEnrichedMap({});
  }

  function idFor(bucket: string, idx: number, c: Course) {
    return `${bucket}::${idx}::${c.title}::${c.link ?? ""}`;
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      let next = [...prev];
      if (next.includes(id)) next = next.filter((x) => x !== id);
      else next.push(id);
      if (!localStorage.getItem(HINT_KEY) && next.length === 1) {
        setShowHint(true);
        setTimeout(() => setShowHint(false), 2400);
        try { localStorage.setItem(HINT_KEY, "1"); } catch {}
      }
      if (next.length > 2) {
        next = next.slice(-2);
        setShowToast("Compare works with 2 courses — kept your newest two.");
        setTimeout(() => setShowToast(null), 1800);
      }
      return next;
    });
  }

  function courseKey(c: Course) {
    return `${(c.link || "").trim()}::${c.title.trim()}`;
  }

  async function enrichFromBackend(b: Buckets | null) {
    if (!b) return;
    // Collect unique linked courses
    const all: Course[] = [];
    for (const bucket of ORDERED_BUCKETS) {
      const arr = normalizeBucket(b[bucket]);
      for (const c0 of arr) {
        const link = resolveLink(c0);
        if (link) all.push({ ...c0, link });
      }
    }
    if (!all.length) return;

    setEnriching(true);
    try {
      const res = await fetch(ENRICH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses: all }),
      });
      if (!res.ok) throw new Error(`enrich ${res.status}`);
      const data = await res.json();
      const map: Record<string, { duration?: string; cost?: string }> = {};
      const enrichedList: Course[] = Array.isArray(data?.courses) ? data.courses : [];
      for (const c of enrichedList) {
        const key = courseKey(c);
        map[key] = { duration: c.duration, cost: c.cost };
      }
      setEnrichedMap(map);
    } catch {
      // ignore if backend route doesn’t exist — UI falls back to heuristics
    } finally {
      setEnriching(false);
    }
  }

  function getDisplayCourse(base: Course): Course {
    const c0 = enrichLocal({ ...base, link: resolveLink(base) });
    const hit = enrichedMap[courseKey(c0)];
    if (!hit) return c0;
    return {
      ...c0,
      ...(hit.duration ? { duration: hit.duration } : {}),
      ...(hit.cost ? { cost: hit.cost } : {}),
    };
  }

  function triggerCompare() {
    if (!buckets || selectedIds.length !== 2) return;
    const lookup: Course[] = [];
    for (const bucket of ORDERED_BUCKETS) {
      for (const [i, c0] of normalizeBucket(buckets[bucket]).entries()) {
        const c = getDisplayCourse(c0);
        const id = idFor(bucket, i, c);
        if (selectedIds.includes(id)) lookup.push(c);
      }
    }
    if (lookup.length === 2) setComparePair([lookup[0], lookup[1]]);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      {/* Loader overlay: shows over page, under taskbar (z-30) */}
      <LoaderOverlay show={loading || enriching} message="Curating your learning path..." />

      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent flex items-center gap-2">
          <BookOpen size={36} className="text-teal-300" />
          Course Genie
        </h1>
        <p className="text-slate-400">Paste your goals. We’ll craft a bucketed plan.</p>
      </div>

      {/* Input + Actions */}
      <div className="mt-6 grid gap-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          placeholder={`e.g.\naiming for data scientist; weak in X & Y; 6–8 hrs/week`}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400/40 transition-shadow shadow-[inset_0_0_0_rgba(0,0,0,0)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.25)] cursor-text"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRecommend}
            disabled={loading}
            className="cursor-pointer inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
          >
            <Wand2 size={16} className="mr-2" />
            Recommend Courses
          </button>
          <button
            onClick={() => setConfirmClear(true)}
            className="cursor-pointer inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-white/15 bg-white/8 text-white hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
          >
            <Trash2 size={16} className="mr-2" />
            Clear
          </button>
          {error ? <span className="text-rose-300/90 text-sm">⚠ {error}</span> : null}
        </div>
      </div>

      {/* Filters — centered */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="w-full flex justify-center">
          <div className="flex flex-wrap gap-2">
            {(["all", ...ORDERED_BUCKETS] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSelectedFilter(f as string)}
                className={`cursor-pointer px-4 py-2 rounded-2xl text-sm border transition ${
                  selectedFilter === f
                    ? "bg-white/10 text-slate-100 border-white/15 shadow-[0_0_0_3px_rgba(99,102,241,0.25)]"
                    : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/8"
                } focus:outline-none focus:ring-2 focus:ring-indigo-400/60`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-10 mt-8">
        {!hasAny && !loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-slate-300">
            No courses yet. Paste your goals above and hit “Recommend Courses”.
          </div>
        )}

        {!loading && buckets &&
          ORDERED_BUCKETS.map((bucket, idx) => {
            const show = selectedFilter === "all" || selectedFilter === bucket;
            if (!show) return null;
            const courses: Course[] = normalizeBucket(buckets[bucket]).map((c) =>
              getDisplayCourse({ ...c, link: resolveLink(c) })
            );
            if (courses.length === 0) return null;

            return (
              <section
                key={bucket}
                className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.045] to-white/[0.02] p-5 md:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                style={{ animation: "fadeup 420ms ease both", animationDelay: `${idx * 70}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-[rgba(255,255,255,0.95)]">{bucket}</h2>
                  <span className="px-3 py-1 rounded-full text-xs border border-white/15 bg-white/5 text-slate-300">
                    {courses.length} {courses.length === 1 ? "course" : "courses"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((course, i) => {
                    const id = idFor(bucket, i, course);
                    const selected = selectedIds.includes(id);

                    const metaRow = (icon: string, value?: string) => (
                      <p className={`flex items-center gap-1 ${value ? "text-white/80" : "text-white/45"}`}>
                        <span>{icon}</span>
                        {value ? (
                          <span>{value}</span>
                        ) : (
                          <span className="inline-block w-28 h-3 rounded bg-white/10 animate-pulse" />
                        )}
                      </p>
                    );

                    return (
                      <div
                        key={id}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("a[data-open-btn]")) return;
                          toggleSelect(id);
                        }}
                        className={`relative rounded-2xl border border-white/10 bg-white/[0.035] p-6 hover:bg-white/[0.06] transition shadow-[0_6px_18px_rgba(0,0,0,0.25)] flex flex-col min-h-[260px] cursor-pointer
                          ${selected ? "shadow-[0_0_0_3px_rgba(99,102,241,0.35)]" : ""}`}
                        style={{ animation: "fadeup 420ms ease both", animationDelay: `${idx * 80 + i * 40}ms` }}
                      >
                        {/* Select pill */}
                        <button
                          aria-label={selected ? "Deselect" : "Select for compare"}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(id); }}
                          className={`cursor-pointer absolute top-3 right-3 rounded-full w-7 h-7 flex items-center justify-center border
                            ${selected
                              ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-white/20"
                              : "bg-white/10 text-white/70 border-white/20 hover:bg-white/20"}`}
                        >
                          {selected ? <Check size={16} /> : <span className="block w-3 h-3 rounded-full border border-indigo-300/70" />}
                        </button>

                        <div className="flex-1">
                          <h3 className="font-semibold text-[rgba(255,255,255,0.94)] leading-snug pr-8">
                            {course.title}
                          </h3>
                          <div className="text-xs text-[rgba(255,255,255,0.75)] space-y-1 mt-2">
                            {course.source && <p>{platformEmoji(course.source)} {course.source}</p>}
                            {metaRow("⏱️", course.duration || (enriching ? undefined : course.duration))}
                            {metaRow("💰", course.cost     || (enriching ? undefined : course.cost))}
                            {course.why && <p className="text-white/80">💡 {course.why}</p>}
                          </div>
                        </div>

                        {course.link ? (
                          <a
                            data-open-btn
                            href={course.link}
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer mt-4 inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 transition-transform bouncy-btn focus:outline-none focus:ring-2 focus:ring-indigo-400/60 active:scale-[0.99] shadow-[0_0_0_0_rgba(0,0,0,0)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.25)]"
                          >
                            <ExternalLink size={14} className="mr-2" />
                            Open
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
      </div>

      {/* Compare Dock */}
      {selectedIds.length > 0 && (
        <CompareDock
          count={selectedIds.length}
          onCompare={triggerCompare}
          onClear={clearSelection}
        />
      )}

      {/* First-time hint (bottom-center) */}
      {showHint && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
          <div className="px-4 py-2 rounded-full border border-white/12 bg-white/12 backdrop-blur-md text-white/90 text-sm shadow-lg animate-[fadeup_.3s_ease_both]">
            Select <b>2</b> courses to compare ✨
          </div>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="px-4 py-2 rounded-full border border-white/12 bg-white/10 backdrop-blur-md text-white/90 text-sm shadow-lg">
            {showToast}
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {comparePair && (
        <CompareModal
          a={comparePair[0]}
          b={comparePair[1]}
          onClose={() => setComparePair(null)}
        />
      )}

      {/* Confirm modal */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setConfirmClear(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white/95">Clear courses?</h3>
            <p className="mt-2 text-sm text-white/80">This will remove your input and current recommendations.</p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmClear(false)}
                className="cursor-pointer px-4 py-2 rounded-xl border border-white/15 bg-white/8 text-white hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
              >
                Cancel
              </button>
              <button
                onClick={actuallyClear}
                className="cursor-pointer px-4 py-2 rounded-xl text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeup { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .bouncy-btn { transition: transform 220ms ease, filter 220ms ease; will-change: transform; }
        .bouncy-btn:hover { transform: translateY(-2px) scale(1.02); filter: drop-shadow(0 6px 22px rgba(99,102,241,0.25)); }
      `}</style>
    </div>
  );
}
