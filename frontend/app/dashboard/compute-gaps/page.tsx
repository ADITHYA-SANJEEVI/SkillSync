"use client";
import { useState } from "react";
import { api } from "@/lib/apiClient";

export default function Page(){
  const [resume,setResume]=useState<File|null>(null);
  const [role,setRole]=useState<File|null>(null);
  const [out,setOut]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  return (
    <section className="space-y-3">
      <div className="flex gap-2 items-center">
        <span className="text-sm">Resume (PDF)</span>
        <input type="file" accept=".pdf" onChange={e=>setResume(e.target.files?.[0]??null)} />
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-sm">Role/JD (PDF)</span>
        <input type="file" accept=".pdf" onChange={e=>setRole(e.target.files?.[0]??null)} />
      </div>
      <button onClick={async()=>{ if(!resume||!role) return; setBusy(true); setOut(null); try{ const fd=new FormData(); fd.append("resume_file",resume); fd.append("role_file",role); setOut(await api.postForm("/api/v1/llm/ml/compute-gaps", fd)); } finally{ setBusy(false);} }} className="px-4 py-2 rounded-xl bg-slate-900 text-white" disabled={!resume||!role||busy}>{busy?"Computing…":"Compute Gaps"}</button>
      {out && <pre className="text-xs bg-slate-50 border rounded-xl p-3 overflow-auto">{JSON.stringify(out,null,2)}</pre>}
    </section>
  );
}
