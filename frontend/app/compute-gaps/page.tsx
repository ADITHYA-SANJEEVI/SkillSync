"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

/* ========================= Persistence Keys ========================= */
const K_RESULT = "computeGaps.result.v1";
const K_RESUME_NAME = "computeGaps.resumeName.v1";
const K_JD_NAME = "computeGaps.jdName.v1";

/* ========================= Helpers ========================= */
function mdToHtml(md: string): string {
  let s = (md ?? "").replace(/\r\n/g, "\n");
  s = s.replace(/^\s*######\s+(.*)$/gm, "<h6>$1</h6>");
  s = s.replace(/^\s*#####\s+(.*)$/gm, "<h5>$1</h5>");
  s = s.replace(/^\s*####\s+(.*)$/gm, "<h4>$1</h4>");
  s = s.replace(/^\s*###\s+(.*)$/gm, "<h3>$1</h3>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/^\s*\d+\.\s+(.*)$/gm, "<li>$1</li>");
  s = s.replace(/^\s*[-–—*]\s+(.*)$/gm, "<li>$1</li>");
  s = s.replace(/(?:\s*<li>.*?<\/li>\s*)+/gs, (block) => {
    const inside = block.replace(/\s+/g, " ").trim();
    return `<ul>${inside}</ul>`;
  });
  const lines = s.split("\n");
  const wrapped = lines
    .map((line) => {
      if (!line.trim()) return "";
      if (/^<(h[3-6]|ul|li|strong|br|p)/i.test(line.trim())) return line;
      return `<p>${line.trim()}</p>`;
    })
    .join("\n");
  return wrapped.replace(/\n{2,}/g, "\n<br/>\n");
}

/* ---------- Parse minimal Markdown ---------- */
function parseAiMarkdown(md: string) {
  const text = (md || "").replace(/\r\n/g, "\n");

  const catsIdx = text.search(/^\s*\*\*?\s*Gap\s+Categories\s*\*\*?/im);
  let categories: { name: string; items: string[] }[] = [];
  if (catsIdx !== -1) {
    const after = text.slice(catsIdx);
    const stop = after.search(/\n\s*\n\s*(?:#+|\*\*)/m);
    const block = stop === -1 ? after : after.slice(0, stop);
    const lines = block.split("\n");
    let current: { name: string; items: string[] } | null = null;
    for (const raw of lines) {
      const l = raw.trim();
      const mHead = l.match(/^\d+\.\s+(.*)$/);
      const mBullet = l.match(/^[-–—]\s+(.*)$/) || l.match(/^[*]\s+(.*)$/);
      if (mHead) {
        if (current) categories.push(current);
        current = { name: mHead[1].trim(), items: [] };
      } else if (mBullet && current) {
        current.items.push(mBullet[1].trim());
      }
    }
    if (current) categories.push(current);
  }

  const planIdx = text.search(/^\s*#{3,6}\s+.*Plan.*$/im);
  let planSteps: string[] = [];
  if (planIdx !== -1) {
    const after = text.slice(planIdx);
    const stop = after.search(/^\s*#{3,6}\s+/m);
    const block = stop === -1 ? after : after.slice(0, stop);
    const matches = [...block.matchAll(/^\s*\d+\.\s+(.*)$/gm)];
    planSteps = matches.map((m) => m[1].trim());
  }

  const totalCategoryItems = categories.reduce((a, c) => a + c.items.length, 0);
  const totalPlanSteps = planSteps.length;

  return {
    categories,
    planSteps,
    totals: {
      categories: categories.length,
      categoryItems: totalCategoryItems,
      planSteps: totalPlanSteps,
      allItems: totalCategoryItems + totalPlanSteps,
    },
    html: mdToHtml(text),
  };
}

/* ---------- Token matching ---------- */
function deriveMetricsFromText(text: string | null) {
  if (!text) return null;
  const lower = text.toLowerCase();

  const dict = {
    "Technical Skills": [
      "python","fastapi","react","sqlalchemy","docker","aws","tensorflow","redux","context","api","mlops",
    ],
    "DevOps & CI/CD": ["docker","github actions","ci","cd","pipeline","deployment","kubernetes"],
    "ML / AI": ["ml","machine learning","ai","model","train","deploy","tensor","scikit","sklearn"],
    "Soft Skills": ["communication","teamwork","leadership","collaboration","problem solving","initiative"],
    Cloud: ["aws","azure","gcp","heroku","ec2","cloud"],
    Databases: ["sql","postgres","mongodb","database","schema","orm"],
  };

  const results: { name: string; score: number; matches: string[] }[] = [];
  for (const [cat, keywords] of Object.entries(dict)) {
    const matches = keywords.filter((k) => lower.includes(k));
    const score = matches.length / keywords.length;
    results.push({ name: cat, score, matches });
  }
  const avg = results.reduce((a, b) => a + b.score, 0) / results.length;
  return { results, overall: avg };
}

/* ========================= UI atoms ========================= */
const ACCENT = ["#7c7cf8", "#6e74ff", "#6a5df3", "#8a5cf3", "#9a6df8", "#6f5cf0"];

function Card({ children, className, title, subtitle }: any) {
  return (
    <div
      className={[
        "rounded-3xl border border-white/10",
        "bg-white/[0.03] hover:bg-white/[0.05] transition",
        "shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
        "flex flex-col", className || ""
      ].join(" ")}
    >
      {(title || subtitle) && (
        <div className="px-6 pt-5 pb-2">
          {title && <h3 className="text-lg md:text-xl font-semibold text-slate-100">{title}</h3>}
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
      )}
      <div className="p-6 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: any }) {
  return (
    <div className="px-4 py-2 rounded-xl bg-white/6 border border-white/10 text-slate-200">
      <span className="text-sm text-slate-400 mr-2">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Toast({ show, text }: { show: boolean; text: string }) {
  return (
    <div
      aria-live="polite"
      className={[
        "fixed left-1/2 -translate-x-1/2 bottom-8 z-[60]",
        "transition-all duration-300",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none",
      ].join(" ")}
    >
      <div className="px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-xl">
        <div className="relative">
          <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-indigo-500/30 to-violet-500/30 blur-md -z-10" />
          <span className="text-slate-100 text-sm font-medium">{text}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Glam Loader (same as Skill Analysis) ---------- */
function GlamLoader({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div className="relative z-10 rounded-3xl border border-white/10 bg-neutral-900/90 p-8 shadow-2xl">
        <div className="relative mx-auto h-16 w-80 rounded-full overflow-hidden bg-white/[0.06]">
          <div
            className="absolute inset-0 animate-[sheen_2.2s_ease-in-out_infinite] opacity-90"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)" }}
          />
          {[0, 1, 2].map((k) => (
            <div
              key={k}
              className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full"
              style={{
                left: "10%",
                animation: `orbit${k} 1.8s ${k * 0.25}s ease-in-out infinite`,
                background: k === 0 ? "#8b5cf6" : k === 1 ? "#6366f1" : "#a78bfa",
                boxShadow: "0 0 18px rgba(139,92,246,.7)",
              }}
            />
          ))}
        </div>
        <p className="mt-5 text-center text-slate-200">Analyzing your gaps…</p>
        <div className="mt-3 text-center">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
          >
            Cancel
          </button>
        </div>
        <style jsx>{`
          @keyframes sheen { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }
          @keyframes orbit0 { 0% { transform: translate(0,-50%);} 50% { transform: translate(220%,-50%);} 100% { transform: translate(0,-50%);} }
          @keyframes orbit1 { 0% { transform: translate(30%,-50%);} 50% { transform: translate(250%,-50%);} 100% { transform: translate(30%,-50%);} }
          @keyframes orbit2 { 0% { transform: translate(60%,-50%);} 50% { transform: translate(280%,-50%);} 100% { transform: translate(60%,-50%);} }
        `}</style>
      </div>
    </div>
  );
}

/* ========================= Page ========================= */
export default function ComputeGapsPage() {
  const [resume, setResume] = useState<File | null>(null);
  const [jd, setJd] = useState<File | null>(null);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [jdName, setJdName] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const [showToast, setShowToast] = useState(false);
  const [resumeKey, setResumeKey] = useState(0);
  const [jdKey, setJdKey] = useState(0);

  useEffect(() => {
    try {
      const savedResult = localStorage.getItem(K_RESULT);
      if (savedResult) setResult(JSON.parse(savedResult));
      const rn = localStorage.getItem(K_RESUME_NAME);
      const jn = localStorage.getItem(K_JD_NAME);
      if (rn) setResumeName(rn);
      if (jn) setJdName(jn);
    } catch {}
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      try {
        if (e.key === K_RESULT && e.newValue) setResult(JSON.parse(e.newValue));
        if (e.key === K_RESUME_NAME) setResumeName(e.newValue);
        if (e.key === K_JD_NAME) setJdName(e.newValue);
      } catch {}
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    try {
      if (result) localStorage.setItem(K_RESULT, JSON.stringify(result));
    } catch {}
  }, [result]);

  useEffect(() => {
    try {
      if (resumeName != null) localStorage.setItem(K_RESUME_NAME, resumeName);
    } catch {}
  }, [resumeName]);

  useEffect(() => {
    try {
      if (jdName != null) localStorage.setItem(K_JD_NAME, jdName);
    } catch {}
  }, [jdName]);

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 3500);
    return () => clearTimeout(t);
  }, [showToast]);

  async function handleAnalyze() {
    if (!resume || !jd) {
      setError("Please upload both résumé and job description.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("resume_file", resume);
      fd.append("role_file", jd);
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
      const res = await fetch(`${base}/api/v1/llm/ml/compute-gaps`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
      setResumeName(resume.name);
      setJdName(jd.name);
      setShowToast(true);
    } catch (e: any) {
      setError(e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setResume(null);
    setJd(null);
    setResult(null);
    setError(null);
    setResumeName(null);
    setJdName(null);
    setShowToast(false);
    try {
      localStorage.removeItem(K_RESULT);
      localStorage.removeItem(K_RESUME_NAME);
      localStorage.removeItem(K_JD_NAME);
    } catch {}
    setResumeKey((k) => k + 1);
    setJdKey((k) => k + 1);
  }

  const parsed = result?.ai ? parseAiMarkdown(result.ai) : null;
  const metrics = result?.ai ? deriveMetricsFromText(result.ai) : null;

  const barData =
    metrics?.results?.map((r) => ({ name: r.name, scorePct: Math.round(r.score * 100) })) ||
    parsed?.categories?.map((c) => ({ name: c.name, scorePct: Math.min(100, c.items.length * 10) })) ||
    [];

  const radarData =
    metrics?.results?.map((r) => ({ subject: r.name, weight: Math.round(r.score * 100) })) ||
    parsed?.categories?.map((c) => ({ subject: c.name, weight: Math.min(100, Math.max(5, c.items.length * 10)) })) ||
    [];

  const pieData =
    metrics && parsed?.totals
      ? [
          { name: "Coverage Index", value: Math.round(metrics.overall * 100) },
          { name: "Gap Items", value: parsed.totals.categoryItems || 0 },
        ]
      : metrics
      ? [{ name: "Coverage Index", value: Math.round(metrics.overall * 100) }]
      : [];

  return (
    <div className="p-6 md:p-10 max-w-6xl xl:max-w-7xl mx-auto text-slate-100">
      {/* Title */}
      <div className="text-left">
        <h1 className="text-[40px] md:text-[52px] leading-tight font-extrabold bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
          Compute Gaps
        </h1>
      </div>

      {/* Uploads */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="relative overflow-hidden rounded-3xl p-5 border border-white/10 bg-gradient-to-b from-white/[0.02] to-white/[0.01]">
          <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="text-lg font-semibold text-slate-100 mb-3">Candidate Résumé</div>

          <label className="block cursor-pointer">
            <div className="rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.04] hover:border-white/25 transition px-5 py-4 text-center text-[15px] font-medium min-h-[64px] flex items-center justify-center">
              {resume ? `Selected: ${resume.name}` : resumeName ? `Selected: ${resumeName}` : "Upload Résumé (PDF/TXT)"}
            </div>
            <input
              key={resumeKey}
              type="file"
              accept=".pdf,.txt"
              onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setResume(f);
                if (f) setResumeName(f.name);
              }}
              hidden
            />
          </label>
        </div>

        <div className="relative overflow-hidden rounded-3xl p-5 border border-white/10 bg-gradient-to-b from-white/[0.02] to-white/[0.01]">
          <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="text-lg font-semibold text-slate-100 mb-3">Target Job Description</div>

          <label className="block cursor-pointer">
            <div className="rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.04] hover:border-white/25 transition px-5 py-4 text-center text-[15px] font-medium min-h-[64px] flex items-center justify-center">
              {jd ? `Selected: ${jd.name}` : jdName ? `Selected: ${jdName}` : "Upload JD (PDF/TXT)"}
            </div>
            <input
              key={jdKey}
              type="file"
              accept=".pdf,.txt"
              onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setJd(f);
                if (f) setJdName(f.name);
              }}
              hidden
            />
          </label>
        </div>
      </div>

      {/* Buttons — bigger pill + glow, matched heights */}
      <div className="flex items-center gap-4 justify-center mt-7">
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className={[
            "cursor-pointer h-12 md:h-[52px] px-8 md:px-10 rounded-2xl",
            "text-white text-[15px] font-semibold tracking-wide",
            "bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400",
            "shadow-[0_8px_30px_rgba(99,102,241,.35)] active:scale-[0.99]",
            "transition disabled:opacity-50"
          ].join(" ")}
        >
          {loading ? "Analyzing…" : "Analyze Now"}
        </button>

        <button
          onClick={handleClear}
          className={[
            "cursor-pointer h-12 md:h-[52px] px-8 md:px-10 rounded-2xl",
            "bg-white/6 hover:bg-white/10 border border-white/12",
            "text-slate-200 text-[15px] font-medium transition"
          ].join(" ")}
        >
          Clear
        </button>

        {error && <span className="text-red-400 font-medium ml-2">{error}</span>}
      </div>

      {/* Loader */}
      {loading && <GlamLoader onCancel={() => setLoading(false)} />}

      {/* Results */}
      {result && (
        <div className="mt-10 grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          {/* LEFT STACK */}
          <div className="grid grid-cols-1 gap-6 xl:col-span-1">
            <Card title="Overview" subtitle="Quick metrics">
              <div className="flex flex-wrap gap-3">
                <MetricChip label="Coverage Index" value={metrics ? `${Math.round((metrics.overall ?? 0) * 100)}%` : "—"} />
                <MetricChip label="Categories" value={parsed?.totals.categories ?? 0} />
                <MetricChip label="Gap items" value={parsed?.totals.categoryItems ?? 0} />
                <MetricChip label="Plan steps" value={parsed?.totals.planSteps ?? 0} />
              </div>
            </Card>

            <Card title="Composition" subtitle="Coverage vs Gaps">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={55} paddingAngle={3} label>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={ACCENT[i % ACCENT.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip
                      contentStyle={{ background: "#0B0D12", border: "1px solid #222", borderRadius: 12 }}
                      formatter={(v: any, n: any) => [v, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Professional Metrics" subtitle="Keyword-based competency scores (0–100%)">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="name" angle={-15} textAnchor="end" />
                    <YAxis domain={[0, 100]} label={{ value: "Score (%)", angle: -90, position: "insideLeft" }} />
                    <Tooltip
                      contentStyle={{ background: "#0B0D12", border: "1px solid #222", borderRadius: 12 }}
                      formatter={(v: any) => `${v}%`}
                      labelFormatter={(l: any) => String(l)}
                    />
                    <Legend />
                    <Bar dataKey="scorePct" name="Score (%)">
                      {barData.map((_, i) => (
                        <Cell key={i} fill={ACCENT[i % ACCENT.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Category Profile" subtitle="Relative weight (0–100)">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar name="Weight (%)" dataKey="weight" stroke="#7c7cf8" fill="#7c7cf8" fillOpacity={0.35} />
                    <Legend />
                    <Tooltip
                      contentStyle={{ background: "#0B0D12", border: "1px solid #222", borderRadius: 12 }}
                      formatter={(v: any) => `${v}%`}
                      labelFormatter={(l: any) => String(l)}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* RIGHT SIDE — AI Explanation */}
          <Card title="AI Explanation" subtitle="Full output (Markdown → HTML)" className="xl:col-span-2">
            <div
              className="prose prose-invert max-w-none prose-li:my-1 prose-strong:text-white break-words whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: parsed?.html ?? "" }}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
