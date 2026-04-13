"use client";
import { useState } from "react";
import { api } from "@/lib/apiClient";

export default function Page(){
  const [prompt,setPrompt]=useState("How can I tailor my resume for Python roles in Chennai?");
  const [out,setOut]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  return (
    <section className="space-y-3 max-w-3xl">
      <textarea className="w-full border rounded-xl p-3" rows={4} value={prompt} onChange={e=>setPrompt(e.target.value)} />
      <button onClick={async()=>{ setBusy(true); setOut(null); try{ setOut(await api.postText("/api/v1/llm/prompt", prompt)); } finally{ setBusy(false); } }} className="px-4 py-2 rounded-xl bg-slate-900 text-white" disabled={busy}>{busy?"Thinking…":"Ask"}</button>
      {out && <pre className="text-xs bg-slate-50 border rounded-xl p-3 overflow-auto">{JSON.stringify(out,null,2)}</pre>}
    </section>
  );
}
