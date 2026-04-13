"use client";
import { useEffect, useState } from "react";
import { apiGet } from "./ApiClient";

export default function Diagnostics() {
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      try { setOut(await apiGet<any>("/api/v1/llm/diag")); }
      catch (e: any) { setErr(e?.message || "Diagnostics failed"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <p>Running diagnostics…</p>;
  if (err) return <p className="text-red-600">{err}</p>;
  if (!out) return <p className="text-slate-500">No diagnostics.</p>;

  return <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto">{JSON.stringify(out, null, 2)}</pre>;
}
