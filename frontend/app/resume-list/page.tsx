"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export default function Page() {
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(()=>{ (async()=>{
    try { setOut(await api.get<any>("/api/v1/llm/resume-list")); }
    catch(e:any){ setErr(e.message); }
  })(); },[]);
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Resume List</h1>
      {err && <div className="text-red-600">{err}</div>}
      {!out ? <div>Loadingâ€¦</div> : <pre className="text-xs bg-slate-50 border rounded-xl p-3 overflow-auto">{JSON.stringify(out,null,2)}</pre>}
    </section>
  );
}
