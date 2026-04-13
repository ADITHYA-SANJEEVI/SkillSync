"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export default function Page(){
  const [out,setOut]=useState<any>(null); const [err,setErr]=useState<string|null>(null);
  useEffect(()=>{ (async()=>{ try{ setOut(await api.get("/api/v1/llm/resume-list")); }catch(e:any){ setErr(e.message); } })(); },[]);
  if(err) return <div className="text-red-600">{err}</div>;
  if(!out) return <div>Loading…</div>;
  return <pre className="text-xs bg-slate-50 border rounded-xl p-3 overflow-auto">{JSON.stringify(out,null,2)}</pre>;
}
