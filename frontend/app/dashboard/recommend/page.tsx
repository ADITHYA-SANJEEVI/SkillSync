"use client";
import { useState } from "react";
import { api } from "@/lib/apiClient";

export default function Page(){
  const [gaps,setGaps]=useState("aim: data scientist; weak in SQL windows, PyTorch basics, Docker+FastAPI deploy; 6 hrs/week for 8 weeks");
  const [out,setOut]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  return (
    <section className="space-y-3">
      <textarea className="w-full border rounded-xl p-3" rows={4} value={gaps} onChange={e=>setGaps(e.target.value)} />
      <button onClick={async()=>{ setBusy(true); setOut(null); try{ setOut(await api.postText("/api/v1/llm/ml/recommend", gaps)); } finally { setBusy(false); } }} className="px-4 py-2 rounded-xl bg-slate-900 text-white" disabled={busy}>{busy?"Recommending…":"Recommend"}</button>
      {out && <pre className="text-xs bg-slate-50 border rounded-xl p-3 overflow-auto">{JSON.stringify(out,null,2)}</pre>}
    </section>
  );
}
