"use client";
import { useState } from "react";
import { api } from "@/lib/apiClient";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [jobName, setJobName] = useState("");
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!file) return;
    setBusy(true); setOut(null);
    try {
      const fd = new FormData();
      fd.append("resume_file", file);
      if (jobName) fd.append("job_name", jobName);
      setOut(await api.postForm<any>("/api/v1/llm/match", fd));
    } finally { setBusy(false); }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">PDF Match</h1>
      <input type="file" accept=".pdf" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
      <input className="border rounded-xl px-3 py-2 block" placeholder="Optional: job name" value={jobName} onChange={(e)=>setJobName(e.target.value)} />
      <button onClick={run} className="px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-50" disabled={!file || busy}>
        {busy ? "Matchingâ€¦" : "Match"}
      </button>
      {out && <pre className="text-xs bg-slate-50 border rounded-xl p-3 overflow-auto">{JSON.stringify(out,null,2)}</pre>}
    </section>
  );
}
