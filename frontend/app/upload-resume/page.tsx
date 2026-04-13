"use client";
import { useState } from "react";
import { api } from "@/lib/apiClient";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setErr("Choose a PDF or TXT"); return; }
    setBusy(true); setErr(null); setOut(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await api.postForm<any>("/api/v1/llm/upload-resume", fd);
      setOut(data);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Upload Resume</h1>
      <form onSubmit={submit} className="space-y-3">
        <input type="file" accept=".pdf,.txt" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
        <button className="px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-50" disabled={!file || busy}>
          {busy ? "Uploadingâ€¦" : "Upload"}
        </button>
      </form>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {out && <pre className="text-xs bg-slate-50 border rounded-xl p-3 overflow-auto">{JSON.stringify(out,null,2)}</pre>}
    </section>
  );
}
