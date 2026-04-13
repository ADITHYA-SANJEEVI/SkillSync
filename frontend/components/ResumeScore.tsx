"use client";
import { useState } from "react";
import { apiPostForm } from "./ApiClient";

export default function ResumeScore() {
  const [file, setFile] = useState<File | null>(null);
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setErr("Choose a PDF or TXT resume.");
    setBusy(true); setErr(null); setOut(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await apiPostForm<any>("/api/v1/llm/feedback/resume-score", fd);
      setOut(data);
    } catch (e: any) { setErr(e?.message || "Scoring failed"); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={run} className="space-y-3">
      <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button disabled={busy || !file} className="px-3 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-50">
        {busy ? "Scoring…" : "Score Resume"}
      </button>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      {out && <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto">{JSON.stringify(out, null, 2)}</pre>}
    </form>
  );
}
