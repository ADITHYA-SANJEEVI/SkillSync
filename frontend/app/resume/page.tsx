"use client";

import React from "react";
import { FileText, Upload, Trash2, RefreshCcw, CheckCircle2, Loader2 } from "lucide-react";

/* ================= Types & API ================= */
type ResumeRecord = {
  id: string;
  filename: string;
  size_bytes?: number;
  uploaded_at?: string;
  stored_path?: string;
  mime?: string;
};

function computeApiBase(): string {
  const env = process?.env?.NEXT_PUBLIC_API_BASE?.trim();
  if (env) return env;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
}

const API = {
  upload: "/api/v1/llm/upload-resume",
  list: "/api/v1/llm/resume-list",
  item: (id: string) => `/api/v1/llm/resumes/${encodeURIComponent(id)}`,
};

async function uploadResume(file: File): Promise<ResumeRecord> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("resume_file", file, file.name);
  const res = await fetch(computeApiBase() + API.upload, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return (await res.json()) as ResumeRecord;
}
async function listResumes(): Promise<ResumeRecord[]> {
  const res = await fetch(computeApiBase() + API.list, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`List failed ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const json = await res.json();
  const arr: any = Array.isArray(json) ? json : json?.items ?? json?.resumes ?? json?.data ?? [];
  return Array.isArray(arr) ? (arr as ResumeRecord[]) : [];
}
async function deleteResume(id: string): Promise<void> {
  const res = await fetch(computeApiBase() + API.item(id), { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed ${res.status}: ${await res.text().catch(() => res.statusText)}`);
}

/* ============== Celebration (now more fireworks + above modal) ============== */
function useCelebration() {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const raf = React.useRef<number | null>(null);
  const timer = React.useRef<number | null>(null);

  const stop = React.useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (timer.current) window.clearTimeout(timer.current);
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, c.width, c.height);
    c.style.opacity = "0";
    c.style.visibility = "hidden";
    c.width = 0;
    c.height = 0;
  }, []);

  const fire = React.useCallback((mode: "confetti" | "fireworks" | "both" = "both") => {
    if (typeof window === "undefined") return;
    const c = ref.current;
    if (!c) return;

    c.style.visibility = "visible";
    c.style.opacity = "1";
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    if (raf.current) cancelAnimationFrame(raf.current);
    if (timer.current) window.clearTimeout(timer.current);

    const colors = ["#8b5cf6", "#6366f1", "#22d3ee", "#a78bfa", "#60a5fa"];
    const parts: any[] = [];

    const confetti = () =>
      Array.from({ length: 140 }).map(() => ({
        kind: "rect",
        x: Math.random() * c.width,
        y: -20 - Math.random() * 60,
        w: 6 + Math.random() * 7,
        h: 6 + Math.random() * 7,
        vx: (Math.random() - 0.5) * 2.2,
        vy: 2 + Math.random() * 3.6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.25,
        a: 1,
        col: colors[(Math.random() * colors.length) | 0],
      }));

    const burst = () => {
      const cx = c.width * (0.25 + Math.random() * 0.5);
      const cy = c.height * (0.22 + Math.random() * 0.35);
      const N = 110; // more particles
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        const sp = 2.2 + Math.random() * 2.2; // faster
        parts.push({
          kind: "dot",
          x: cx,
          y: cy,
          vx: Math.cos(t) * sp,
          vy: Math.sin(t) * sp,
          a: 1,
          col: colors[(Math.random() * colors.length) | 0],
          r: 2.2 + Math.random() * 2.2, // larger spark
        });
      }
    };

    if (mode !== "fireworks") parts.push(...confetti());
    if (mode !== "confetti") {
      // multiple bursts spread over ~1s
      [0, 220, 480, 760, 1050].forEach((ms) => window.setTimeout(burst, ms));
    }

    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.kind === "rect") {
          p.rot += p.vr;
          p.vy += 0.02;
          p.a -= 0.006;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.a);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.col;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        } else {
          // fireworks dots
          p.vy += 0.014;
          p.a -= 0.0085; // slower fade for longer tail
          ctx.beginPath();
          ctx.globalAlpha = Math.max(0, p.a);
          ctx.fillStyle = p.col;
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (parts.some((p) => p.a > 0 && p.y < c.height + 80)) {
        raf.current = requestAnimationFrame(tick);
      }
    };
    raf.current = requestAnimationFrame(tick);

    // longer showtime
    timer.current = window.setTimeout(() => stop(), 3500);
  }, [stop]);

  React.useEffect(() => () => stop(), [stop]);

  return { canvasRef: ref, fire };
}

/* ================= Success Modal (z-[90]) ================= */
function SuccessModal({
  open,
  onClose,
  title = "Upload complete",
  body = "Thanks for uploading! Your resume has been saved and indexed.",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  body?: string;
}) {
  return (
    <div className={`fixed inset-0 z-[90] ${open ? "opacity-100" : "opacity-0 pointer-events-none"} transition`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,92vw)]">
        <div className="rounded-2xl border border-white/12 bg-[rgba(12,12,28,0.85)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-3 mb-2">
            <div className="shrink-0 rounded-full p-1.5 bg-gradient-to-br from-indigo-500/30 to-cyan-400/30">
              <CheckCircle2 className="text-cyan-300" />
            </div>
            <h3 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-violet-200 to-cyan-200">
              {title}
            </h3>
          </div>
          <p className="text-sm text-white/85">{body}</p>
          <div className="mt-5 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow hover:scale-[1.02] transition cursor-pointer"
            >
              Nice!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= Page ================= */
export default function ResumePage() {
  const [resumes, setResumes] = React.useState<ResumeRecord[]>([]);
  const [files, setFiles] = React.useState<File[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [modalOpen, setModalOpen] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const dropRef = React.useRef<HTMLDivElement | null>(null);

  const { canvasRef, fire } = useCelebration();

  const refresh = React.useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const data = await listResumes();
      const sorted = [...data].sort((a, b) => {
        const ta = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
        const tb = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
        return tb - ta;
      });
      setResumes(sorted);
    } catch (e: any) {
      setError(e?.message || String(e));
      setResumes([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // drag & drop
  React.useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const stop = (ev: DragEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    const onDrop = (ev: DragEvent) => {
      stop(ev);
      const f = ev.dataTransfer?.files;
      if (f && f.length) setFiles(Array.from(f));
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((t) => el.addEventListener(t, stop));
    el.addEventListener("drop", onDrop);
    return () => {
      ["dragenter", "dragover", "dragleave", "drop"].forEach((t) => el.removeEventListener(t, stop));
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  const canUpload = files.length > 0 && !loading;

  async function doUpload() {
    if (!canUpload) return;
    setError("");
    setLoading(true);
    try {
      for (const f of files) {
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        if (!["pdf", "txt"].includes(ext)) throw new Error(`Unsupported file: ${f.name} (only .pdf or .txt)`);
        await uploadResume(f);
      }
      setFiles([]);
      await refresh();
      fire("both");           // celebrate (now stronger)…
      setModalOpen(true);     // …and the canvas will render OVER this modal
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    const prev = resumes;
    setResumes((r) => r.filter((x) => String(x.id) !== String(id)));
    try {
      await deleteResume(id);
      setTimeout(() => refresh(), 250);
    } catch (e: any) {
      setResumes(prev);
      setError(e?.message || String(e));
    }
  }

  return (
    <main className="min-h-[100dvh] relative">
      {/* page mists */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_520px_at_25%_-5%,rgba(40,42,90,0.65),transparent),radial-gradient(900px_400px_at_90%_10%,rgba(35,45,85,0.55),transparent)]" />

      <div className="mx-auto max-w-6xl px-6 py-8 md:py-12 space-y-8">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-violet-200 to-cyan-200">
          Upload resume
        </h1>

        {/* Uploader card */}
        <section className="relative rounded-[26px] p-[1px] bg-[linear-gradient(120deg,rgba(99,102,241,0.55),rgba(168,85,247,0.38),rgba(34,211,238,0.38))]">
          <div
            ref={dropRef}
            className="relative rounded-[25px] border border-white/10 bg-[rgba(14,14,30,0.72)] backdrop-blur-xl shadow-[0_24px_70px_rgba(0,0,0,0.45)] p-6 md:p-8 overflow-hidden"
          >
            <div className="pointer-events-none absolute -top-1/2 left-0 right-0 h-[200%] opacity-[0.16] bg-[radial-gradient(1200px_220px_at_20%_0%,#ffffff,transparent_60%)] rotate-[-6deg]" />
            <div
              className="relative rounded-2xl border-2 border-dashed border-white/10 p-8 md:p-10 text-center hover:border-indigo-400/50 transition cursor-pointer"
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={56} className="mx-auto mb-4 text-white/45" />
              <h3 className="text-2xl font-semibold mb-1">Upload a new resume</h3>
              <p className="text-white/75 text-sm mb-5">Drag a PDF/TXT here or click to browse</p>

              <div className="flex items-center justify-center gap-3">
                <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow hover:scale-[1.02] transition cursor-pointer">
                  {canUpload ? "Upload Selected" : "Browse Files"}
                </button>
              </div>

              <input
                ref={inputRef}
                className="hidden"
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                multiple
                onChange={(e) => {
                  const f = e.target.files;
                  if (f && f.length) setFiles(Array.from(f));
                  (e.target as HTMLInputElement).value = "";
                }}
              />

              {files.length > 0 && (
                <div className="mt-6 max-w-2xl mx-auto text-left">
                  <div className="text-sm mb-2 opacity-80">Selected:</div>
                  <ul className="space-y-1 text-sm">
                    {files.map((f) => (
                      <li key={f.name} className="flex items-center justify-between gap-4">
                        <span className="truncate">{f.name}</span>
                        <span className="opacity-70">{(f.size / 1024).toFixed(1)} KB</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center gap-3 mt-5 justify-end">
                    <button
                      className={`px-4 py-2 rounded-xl shadow transition cursor-pointer ${
                        files.length && !loading ? "bg-white/10 hover:bg-white/20" : "bg-white/5 opacity-50 cursor-not-allowed"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        doUpload();
                      }}
                      disabled={!files.length || loading}
                    >
                      {loading ? "Uploading…" : "Upload"}
                    </button>
                    <button
                      className="px-4 py-2 rounded-xl border border-white/15 hover:bg-white/10 transition cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles([]);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {error && <div className="mt-4 text-sm text-rose-300">{error}</div>}
            </div>
          </div>
        </section>

        {/* List card */}
        <section className="relative rounded-[26px] p-[1px] bg-[linear-gradient(120deg,rgba(99,102,241,0.55),rgba(168,85,247,0.38),rgba(34,211,238,0.38))]">
          <div className="relative rounded-[25px] border border-white/10 bg-[rgba(14,14,30,0.72)] backdrop-blur-xl shadow-[0_24px_70px_rgba(0,0,0,0.45)] p-6 md:p-8 overflow-hidden">
            <div className="pointer-events-none absolute -top-1/2 left-0 right-0 h-[200%] opacity-[0.15] bg-[radial-gradient(1200px_220px_at_80%_0%,#ffffff,transparent_60%)] rotate-[6deg]" />

            <div className="flex items-center justify-between mb-4 relative">
              <h2 className="text-xl font-semibold">Your Resumes</h2>
              <button
                onClick={refresh}
                className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 transition cursor-pointer"
                title="Refresh"
              >
                {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {resumes.length === 0 ? (
              <div className="text-sm opacity-75 relative">No resumes uploaded yet.</div>
            ) : (
              <div className="space-y-3 relative">
                {resumes.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-4 bg-white/[0.04] rounded-[12px] hover:bg-white/[0.08] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText size={22} className="text-cyan-300" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.filename}</p>
                        <p className="text-xs text-white/65">
                          {r.size_bytes ? `${(r.size_bytes / 1024).toFixed(1)} KB` : "—"} •{" "}
                          {r.uploaded_at ? new Date(r.uploaded_at).toLocaleString() : "—"}
                        </p>
                      </div>
                    </div>
                    <button
                      className="text-white/75 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete"
                      onClick={() => onDelete(String(r.id))}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Celebrations canvas — ABOVE modal now */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[120] transition-opacity duration-300"
        aria-hidden="true"
        style={{ visibility: "hidden", opacity: 0 }}
      />

      {/* Modal (z-[90]) */}
      <SuccessModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </main>
  );
}
