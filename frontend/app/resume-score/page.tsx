"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Upload, Download, X, RotateCcw } from "lucide-react"

/** Resolve API base without breaking existing env/ports */
function getApiBase() {
  if (typeof window === "undefined") return "http://127.0.0.1:8000"
  const env =
    (process as any)?.env?.NEXT_PUBLIC_API_BASE ??
    (globalThis as any)?.NEXT_PUBLIC_API_BASE
  if (typeof env === "string" && env.trim()) return env.trim()
  const host = window.location.hostname || "127.0.0.1"
  return `http://${host}:8000`
}

type AIResult = {
  ats_score?: number
  strengths?: string[]
  weaknesses?: string[]
  roadmap?: string[]
  recruiter_take?: string
  suggested_headline?: string
  keyword_hits?: string[]
  length_words?: number
}
type ApiSuccess = {
  mode?: string
  source?: Record<string, any>
  ai?: AIResult
  ai_markdown?: string
  raw?: string
  note?: string
}

const PERSIST_KEY = "resumeScoreState.v1"
const brandGradient =
  "var(--brand-gradient, linear-gradient(90deg, #7c3aed 0%, #8b5cf6 50%, #06b6d4 100%))"

/* ======================= Pretty ring & bars ======================= */
function Ring({ value = 0, label = "" }: { value?: number; label?: string }) {
  const r = 30
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, Number(value)))
  const dash = (v / 100) * c
  return (
    <div className="flex items-center gap-3">
      <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
        <circle cx="44" cy="44" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
        <circle
          cx="44" cy="44" r={r} stroke="url(#gradScore)" strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90 44 44)"
        />
        <defs>
          <linearGradient id="gradScore" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <text x="44" y="48" textAnchor="middle" className="fill-slate-100" style={{ fontSize: 18, fontWeight: 800 }}>
          {Math.round(v)}
        </text>
      </svg>
      {label ? <div className="text-xs text-slate-400">{label}</div> : null}
    </div>
  )
}
function Bar({ value = 0, label }: { value?: number; label: string }) {
  const v = Math.max(0, Math.min(100, Number(value)))
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span><span>{Math.round(v)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full"
          style={{
            width: `${v}%`,
            background: "linear-gradient(90deg, rgba(99,102,241,.95), rgba(139,92,246,.95))"
          }}
        />
      </div>
    </div>
  )
}

/* ======================= NEW dynamic loader ======================= */
function AuroraSpinner({ onCancel, stage }: { onCancel: () => void; stage: number }) {
  const labels = ["Extract", "Normalize", "Evaluate", "Score", "Done"]
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-md" />
      <div className="relative z-10 w-[min(92vw,560px)] rounded-3xl border border-white/10 bg-neutral-900/90 p-8 shadow-2xl">
        {/* spinning arc + orbiters */}
        <div className="mx-auto grid place-items-center">
          <div className="relative h-28 w-28">
            {/* base ring */}
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            {/* sweeping arc */}
            <div className="absolute inset-0 animate-spin-sweep rounded-full border-[6px] border-transparent"
                 style={{ borderTopColor: "#8b5cf6", borderRightColor: "#6366f1" }} />
            {/* orbiters */}
            {[0,1,2,3].map((i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.7)]"
                style={{ animation: `orbit 1.9s ${i * 0.18}s ease-in-out infinite` }}
              />
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-slate-200">Scoring your resume…</p>
        <p className="mt-1 text-center text-xs text-slate-400">{labels[Math.min(stage, labels.length - 1)]}</p>
        <div className="mt-3 text-center">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
          >
            Cancel
          </button>
        </div>

        <style jsx>{`
          @keyframes spin-sweep {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .animate-spin-sweep { animation: spin-sweep 1.6s linear infinite; }
          @keyframes orbit {
            0%   { transform: rotate(0deg)   translateX(42px) translateY(0)   rotate(0deg);   opacity:.7; }
            50%  { transform: rotate(180deg) translateX(42px) translateY(0)   rotate(-180deg); opacity:1; }
            100% { transform: rotate(360deg) translateX(42px) translateY(0)   rotate(-360deg); opacity:.7; }
          }
        `}</style>
      </div>
    </div>
  )
}

/* ======================= Empty-state hero ======================= */
function EmptyHero({
  filename,
  onPick,
  onDropFile,
  disabled
}: {
  filename?: string | null
  onPick: () => void
  onDropFile: (f: File) => void
  disabled: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.02] to-white/[0.01] p-8 md:p-10">
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

      <h2 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-4xl">
        Upload a resume to get started
      </h2>
      <p className="mt-2 max-w-3xl text-slate-400">
        We’ll extract signals, compute clarity/impact/skills, and generate improvement suggestions.
      </p>

      <div
        className={`mt-6 cursor-pointer rounded-2xl border-2 border-dashed bg-white/[0.04] transition ${
          dragOver ? "border-violet-300/60 bg-white/[0.06]" : "border-white/15 hover:border-white/25"
        }`}
        onClick={onPick}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f && (f.type === "application/pdf" || f.type === "text/plain")) onDropFile(f)
        }}
        role="button"
        aria-label="Upload resume"
        title="Upload resume"
      >
        <div className="px-6 py-10 md:px-8 md:py-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <Upload size={48} className="text-white/30" />
            <div className="text-slate-300">
              {filename ? (<><span className="mr-1 text-slate-400">Selected:</span> {filename}</>) : (<>Drop a PDF/TXT here or click to choose.</>)}
            </div>
            <button
              onClick={onPick}
              disabled={disabled}
              className="cursor-pointer rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-white transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50"
            >
              Browse
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================== PAGE ============================== */
export default function ResumeScorePage() {
  // no AppShell — this page is “shell-less” to respect your global sliding navbar
  const [score, setScore] = useState<any>(null)
  const [stage, setStage] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [markdownFallback, setMarkdownFallback] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stages = useMemo(() => ["Extract", "Normalize", "Evaluate", "Score", "Done"], [])

  // ---------- persistence ----------
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PERSIST_KEY)
      if (raw) {
        const obj = JSON.parse(raw)
        if (obj && (obj.score || obj.markdownFallback)) {
          setScore(obj.score ?? null)
          setMarkdownFallback(obj.markdownFallback ?? null)
        }
      }
    } catch {}
  }, [])
  useEffect(() => {
    try {
      const payload = JSON.stringify({ score, markdownFallback })
      sessionStorage.setItem(PERSIST_KEY, payload)
    } catch {}
  }, [score, markdownFallback])

  const handleDropFile = useCallback((f: File) => analyzeResume(f), [])
  const openPicker = useCallback(() => fileInputRef.current?.click(), [])

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) analyzeResume(f)
  }

  function resetAll() {
    setErr(null)
    setScore(null)
    setMarkdownFallback(null)
    setShowDetails(false)
    setStage(0)
    try {
      sessionStorage.removeItem(PERSIST_KEY)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch {}
  }

  function mapToTiles(json: ApiSuccess) {
    const ai = json.ai
    if (!ai) {
      setMarkdownFallback(json.ai_markdown || "No structured data returned.")
      setScore(null)
      return
    }
    const ats = Number.isFinite(ai.ats_score) ? (ai.ats_score as number) : 70
    const kwCount = Array.isArray(ai.keyword_hits) ? ai.keyword_hits.length : 0
    const strengthsCount = Array.isArray(ai.strengths) ? ai.strengths.length : 0
    const weaknesses = Array.isArray(ai.weaknesses) ? ai.weaknesses : []
    const roadmap = Array.isArray(ai.roadmap) ? ai.roadmap : []
    const words = typeof ai.length_words === "number" ? ai.length_words : undefined

    const clarity = (() => {
      if (!words) return 76
      if (words < 250) return 68
      if (words <= 1000) return 82
      if (words <= 1500) return 74
      return 65
    })()
    const impact = Math.min(95, 60 + strengthsCount * 4)
    const skills = Math.min(95, 55 + kwCount * 3)
    const overall = Number.isFinite(ats)
      ? ats
      : Math.round(([clarity, impact, skills].reduce((a, b) => a + b, 0) / 3) * 0.9)

    const base = roadmap.length ? roadmap : weaknesses
    const feedback: string[] = base.slice(0, 8)

    setMarkdownFallback(null)
    setScore({
      overall,
      ats,
      clarity,
      impact,
      skills,
      feedback,
      _extra: {
        suggested_headline: ai.suggested_headline || "",
        recruiter_take: ai.recruiter_take || "",
        keyword_hits: ai.keyword_hits || [],
        length_words: ai.length_words ?? null
      }
    })
  }

  async function analyzeResume(file?: File) {
    try {
      setErr(null)
      setBusy(true)
      setShowDetails(false)
      setScore(null)
      setMarkdownFallback(null)
      setStage(0)

      if (!file) {
        setErr("Please choose a .pdf or .txt resume.")
        return
      }
      const okType =
        file.type === "application/pdf" ||
        file.type === "text/plain" ||
        file.name.toLowerCase().endsWith(".pdf") ||
        file.name.toLowerCase().endsWith(".txt")
      if (!okType) {
        setErr("Only .pdf or .txt supported.")
        return
      }

      abortRef.current?.abort()
      abortRef.current = new AbortController()

      const tick = (n: number, d: number) =>
        new Promise((r) => setTimeout(r, d)).then(() => setStage(n))
      await tick(0, 60)
      await tick(1, 250)

      const fd = new FormData()
      fd.append("file", file)

      const url = `${getApiBase()}/api/v1/llm/feedback/resume-score`
      const req = fetch(url, { method: "POST", body: fd, signal: abortRef.current.signal })

      await tick(2, 350)
      const resp = await req
      if (!resp.ok) {
        const t = await resp.text().catch(() => "")
        throw new Error(`Server responded ${resp.status}. ${t}`)
      }

      await tick(3, 350)
      const json = (await resp.json()) as ApiSuccess
      mapToTiles(json)
      await tick(4, 150)
    } catch (e: any) {
      if (e?.name === "AbortError") setErr("Canceled.")
      else setErr(e?.message || "Something went wrong.")
      setScore(null)
      setMarkdownFallback(null)
      setStage(0)
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  function cancelAnalyze() {
    try { abortRef.current?.abort() } catch {}
  }

  function downloadText(filename: string, content: string) {
    try {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(link.href)
    } catch {}
  }
  function onExportJSON() {
    const payload = { score, markdownFallback }
    downloadText("resume-score.json", JSON.stringify(payload, null, 2))
  }
  function onExportMarkdown() {
    if (!markdownFallback) return
    downloadText("resume-score.md", markdownFallback)
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      {/* Page header — no sidebar, gradient title */}
      <h1
        className="text-4xl font-extrabold text-transparent md:text-5xl"
        style={{ background: brandGradient, WebkitBackgroundClip: "text" }}
      >
        Resume Score
      </h1>
      <p className="mt-2 text-slate-400">AI-powered resume evaluation with detailed feedback.</p>

      {/* Hidden native picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        onChange={handleBrowse}
        className="hidden"
      />

      {/* Empty state (no results yet) */}
      {!score && !markdownFallback && !busy && (
        <div className="mt-10">
          <EmptyHero
            filename={null}
            onPick={() => fileInputRef.current?.click()}
            onDropFile={handleDropFile}
            disabled={busy}
          />
        </div>
      )}

      {/* Results area */}
      {(score || markdownFallback) && (
        <div className="mt-10 space-y-6 animate-fade-in">
          {/* Overall / markdown */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            {markdownFallback ? (
              <>
                <p className="mb-2 text-[rgba(255,255,255,0.68)]">AI Report</p>
                <div className="whitespace-pre-wrap text-left">{markdownFallback}</div>
              </>
            ) : (
              <>
                <p className="mb-3 text-[rgba(255,255,255,0.68)]">Overall</p>
                <div className="mx-auto flex w-full max-w-sm items-center justify-center gap-6">
                  <Ring value={score?.overall ?? 0} label="Overall score" />
                </div>
              </>
            )}
          </div>

          {/* Subscores */}
          {!markdownFallback && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "ATS", value: score?.ats ?? "-" },
                { label: "Clarity", value: score?.clarity ?? "-" },
                { label: "Impact", value: score?.impact ?? "-" },
                { label: "Skills", value: score?.skills ?? "-" }
              ].map((sub: any, i: number) => (
                <div
                  key={i}
                  className="animate-slide-up rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <p className="text-2xl font-bold">{sub.value}</p>
                  <p className="mt-1 text-xs text-[rgba(255,255,255,0.68)]">{sub.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Details — fixed height shell; only inner row can scroll horizontally */}
          {!markdownFallback && score?._extra && (
            <div className={"overflow-x-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 " + (showDetails ? "min-h-[210px]" : "min-h-[72px]")}>
              <div className="mb-2 flex cursor-pointer items-center justify-between" onClick={() => setShowDetails((v) => !v)}>
                <h3 className="font-semibold text-slate-100">Details</h3>
                <span className="text-sm opacity-80">{showDetails ? "Hide details" : "View details"}</span>
              </div>

              {showDetails && (
                <div className="relative overflow-hidden">
                  {/* fade edges */}
                  <div className="pointer-events-none absolute left-0 top-0 h-full w-6 rounded-l-[12px] bg-gradient-to-r from-[rgba(2,6,23,1)] to-transparent" />
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-6 rounded-r-[12px] bg-gradient-to-l from-[rgba(2,6,23,1)] to-transparent" />
                  {/* scrollable row ONLY here */}
                  <div
                    className="w-full min-h-[190px] snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:thin] [-ms-overflow-style:none]"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    <div className="flex gap-4 pr-2">
                      {[
                        { title: "Suggested Headline", body: score._extra.suggested_headline || "-" },
                        { title: "Recruiter's Take", body: score._extra.recruiter_take || "-" },
                        {
                          title: "Keyword Hits",
                          body: (score._extra.keyword_hits || []).slice(0, 16).join(", ") || "-"
                        },
                        {
                          title: "Words (approx.)",
                          body: typeof score._extra.length_words === "number" ? String(score._extra.length_words) : "-"
                        }
                      ].map((card: any, idx: number) => (
                        <div key={idx} className="snap-start w-[448px] shrink-0 rounded-[14px] border border-white/10 bg-white/[0.04] p-5">
                          <div className="mb-2 text-sm text-white/70">{card.title}</div>
                          <div className="leading-relaxed text-white/95">{card.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Improvement Suggestions */}
          <div className={"overflow-x-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 " + (showDetails ? "min-h-[210px]" : "min-h-[72px]")}>
            <h3 className="mb-4 font-semibold text-slate-100">Improvement Suggestions</h3>
            <div className="space-y-3">
              {(score?.feedback ?? []).slice(0, 8).map((tip: string, i: number) => (
                <div key={i} className="flex gap-3 rounded-xl bg-white/5 p-3">
                  <span className="text-lg">•</span>
                  <p className="text-[rgba(255,255,255,0.92)]">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button onClick={onExportJSON} className="btn-primary flex items-center gap-2">
              <Download size={18} />
              Export JSON
            </button>
            {markdownFallback && (
              <button onClick={onExportMarkdown} className="btn-ghost flex items-center gap-2">
                <Download size={18} />
                Export Markdown
              </button>
            )}
            <button
              onClick={() => setConfirmOpen(true)}
              className="cursor-pointer flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-white transition hover:from-indigo-400 hover:to-violet-400"
              title="Upload a different resume"
            >
              <RotateCcw size={18} />
              Upload new resume
            </button>
          </div>

          {err && <div className="text-sm text-red-300/90">{String(err)}</div>}
        </div>
      )}

      {/* Loader (dynamic, new look) */}
      {busy && <AuroraSpinner onCancel={cancelAnalyze} stage={stage} />}

      {/* Confirm modal (glass) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative z-10 mx-auto mt-[20vh] w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/90 p-6 shadow-2xl">
            <div className="text-lg font-semibold text-slate-100">Start over?</div>
            <p className="mt-2 text-sm text-slate-400">This clears the current score and lets you choose a new file.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-slate-200 transition hover:bg-white/10"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="cursor-pointer rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-white hover:from-indigo-400 hover:to-violet-400"
                onClick={() => {
                  setConfirmOpen(false)
                  resetAll()
                  setTimeout(() => fileInputRef.current?.click(), 0)
                }}
              >
                Yes, upload new
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
