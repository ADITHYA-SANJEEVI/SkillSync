"use client";
import { useEffect, useState } from "react";
import { apiGet } from "./ApiClient";

type Job = { id?: string; title?: string; company?: string; location?: string; url?: string; summary?: string; };

export default function JobFeed() {
  const [items, setItems] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      try { setItems(await apiGet<Job[]>("/api/v1/jobfeed/feed")); }
      catch (e: any) { setErr(e?.message || "Failed to fetch job feed"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <p>Loading job feed…</p>;
  if (err) return <p className="text-red-600">Job feed error: {err}</p>;
  if (!items.length) return <p className="text-slate-500">No jobs returned.</p>;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((j, i) => (
        <article key={j.id || i} className="border rounded-xl p-4 hover:shadow-sm">
          <h3 className="font-semibold">{j.title || "Role"}</h3>
          <p className="text-sm text-slate-600">{j.company || "Company"} · {j.location || "Remote/On-site"}</p>
          {j.summary && <p className="mt-2 text-sm">{j.summary}</p>}
          {j.url && <a className="mt-3 inline-block text-sm text-blue-700 hover:underline" href={j.url} target="_blank">View</a>}
        </article>
      ))}
    </div>
  );
}
