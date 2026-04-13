"use client";
import { useState } from "react";
import { apiPostForm } from "./ApiClient";

export default function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setErr("Choose a PDF or TXT resume.");
    setBusy(true); setErr(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await apiPostForm<any>("/api/v1/llm/upload-resume", fd);
      setResult(data);
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button disabled={busy || !file} className="px-3 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-50">
        {busy ? "Uploading…" : "Upload"}
      </button>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      {result && <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </form>
  );
}
