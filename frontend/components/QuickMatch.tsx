"use client";
import { useState } from "react";
import { apiPostJSON } from "./ApiClient";

export default function QuickMatch() {
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setErr(null); setOut(null);
    try {
      const data = await apiPostJSON<any>("/api/v1/llm/match", { resume_text: resumeText, job_text: jobText, mode: "quick" });
      setOut(data);
    } catch (e: any) { setErr(e?.message || "Match failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <textarea className="w-full h-40 border rounded-lg p-2" placeholder="Paste resume text" value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
      <textarea className="w-full h-40 border rounded-lg p-2" placeholder="Paste job description (QUICK)" value={jobText} onChange={(e) => setJobText(e.target.value)} />
      <div className="md:col-span-2">
        <button onClick={run} disabled={busy} className="px-3 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-50">{busy ? "Matching…" : "Run Quick Match"}</button>
      </div>
      {err && <p className="text-red-600 md:col-span-2">{err}</p>}
      {out && <pre className="md:col-span-2 text-xs bg-slate-50 border rounded-lg p-3 overflow-auto">{JSON.stringify(out, null, 2)}</pre>}
    </div>
  );
}
