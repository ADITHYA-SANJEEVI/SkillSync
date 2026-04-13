"use client";
import { useState } from "react";
import { api } from "@/lib/apiClient";

export default function Page() {
  const [role, setRole] = useState("Data Analyst");
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setOut(null);
    try { setOut(await api.postText<any>("/api/v1/llm/analyze-jobs", role)); }
    finally { setBusy(false); }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Analyze Jobs</h1>
      <input className="border rounded-xl px-3 py-2" value={role} onChange={(e)=>setRole(e.target.value)} />
      <button onClick={run} className="px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-50" disabled={busy}>
        {busy ? "Analyzingâ€¦" : "Analyze"}
      </button>
      {out && <pre className="text-xs bg-slate-50 border rounded-xl p-3 overflow-auto">{JSON.stringify(out,null,2)}</pre>}
    </section>
  );
}
