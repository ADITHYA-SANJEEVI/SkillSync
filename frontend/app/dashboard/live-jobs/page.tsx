"use client";
import { useState } from "react";
import { api } from "@/lib/apiClient";

type Job = { id:string; title:string; company?:string; location_city?:string; location_region?:string; apply_url:string; short_desc?:string };

export default function Page(){
  const [q,setQ]=useState("python fastapi");
  const [location,setLocation]=useState("Chennai");
  const [mode,setMode]=useState<"any"|"remote"|"onsite"|"hybrid">("any");
  const [page,setPage]=useState(1);
  const [items,setItems]=useState<Job[]>([]);
  const [err,setErr]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  async function run(){
    setBusy(true); setErr(null);
    try{
      const qs = new URLSearchParams({ q, location, page:String(page), per_page:"12", mode });
      const data:any = await api.get(`/api/v1/jobfeed/feed?${qs.toString()}`);
      setItems(data.jobs ?? []);
    }catch(e:any){ setErr(e.message); }
    finally{ setBusy(false); }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className="border rounded-xl px-3 py-2" value={q} onChange={e=>setQ(e.target.value)} placeholder="tech / stack" />
        <input className="border rounded-xl px-3 py-2" value={location} onChange={e=>setLocation(e.target.value)} placeholder="city (e.g., Chennai)" />
        <select className="border rounded-xl px-3 py-2" value={mode} onChange={e=>setMode(e.target.value as any)}>
          <option value="any">any</option><option value="remote">remote</option>
          <option value="onsite">onsite</option><option value="hybrid">hybrid</option>
        </select>
        <button onClick={run} className="px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-50" disabled={busy}>{busy?"Loading…":"Search"}</button>
      </div>
      {err && <div className="text-red-600">{err}</div>}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((j)=>(
          <article key={j.id} className="rounded-2xl border p-4 bg-white/70">
            <div className="font-semibold">{j.title}</div>
            <div className="text-sm text-slate-600">{j.company ?? "—"} • {j.location_city ?? ""} {j.location_region ?? ""}</div>
            {j.short_desc && <p className="mt-2 text-sm">{j.short_desc}</p>}
            <a className="inline-block mt-2 text-sm text-blue-700" href={j.apply_url} target="_blank">Apply</a>
          </article>
        ))}
      </div>
    </section>
  );
}
