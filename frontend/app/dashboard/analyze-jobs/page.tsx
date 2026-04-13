"use client";
import { useState } from "react";
import { api } from "@/lib/apiClient";

export default function Page(){
  const [role,setRole]=useState("Python Developer");
  const [out,setOut]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  return (
    <section className="space-y-3">
      <input className="border rounded-xl px-3 py-2" value={role} onChange={e=>setRole(e.target.value)} />
      <button onClick={async()=>{ setBusy(true); setOut(null); try{ setOut(await api.postText("/api/v1/llm/analyze-jobs", role)); } finally{ setBusy(false);} }} className="px-4 py-2 rounded-xl bg-slate-900 text-white" disabled={busy}>{busy?"Analyzing…":"Analyze"}</button>
      {out && <pre className="text-xs bg-slate-50 border rounded-xl p-3 overflow-auto">{JSON.stringify(out,null,2)}</pre>}
    </section>
  );
}
