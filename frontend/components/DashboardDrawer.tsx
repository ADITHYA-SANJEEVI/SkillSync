"use client";
import { useState } from "react";
import Link from "next/link";

export default function DashboardDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        aria-label="Dashboard"
        onClick={() => setOpen(true)}
        className="fixed left-2 top-1/2 -translate-y-1/2 z-40 px-3 py-2 rounded-r-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg"
      >
        Dashboard
      </button>

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-[320px] z-50 bg-white/80 backdrop-blur-xl shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b">
          <div className="text-lg font-semibold">Workspace</div>
          <div className="text-xs text-slate-500">Endpoints</div>
        </div>
        <nav className="p-4 grid gap-3">
          <Link className="rounded-xl border px-3 py-2 hover:bg-slate-50" href="/upload-resume">Upload Resume</Link>
          <Link className="rounded-xl border px-3 py-2 hover:bg-slate-50" href="/resume-list">Resume List</Link>
          <Link className="rounded-xl border px-3 py-2 hover:bg-slate-50" href="/pdf-match">PDF Match</Link>
          <Link className="rounded-xl border px-3 py-2 hover:bg-slate-50" href="/analyze-jobs">Analyze Jobs</Link>
          <Link className="rounded-xl border px-3 py-2 hover:bg-slate-50" href="/extract-skills">Extract Skills</Link>
          <Link className="rounded-xl border px-3 py-2 hover:bg-slate-50" href="/compute-gaps">Compute Gaps</Link>
          <Link className="rounded-xl border px-3 py-2 hover:bg-slate-50" href="/recommend">Recommend</Link>
          <Link className="rounded-xl border px-3 py-2 hover:bg-slate-50" href="/resume-score">Resume Score</Link>
          <Link className="rounded-xl border px-3 py-2 hover:bg-slate-50" href="/skill-analysis">Skill Analysis</Link>
        </nav>
      </aside>
    </>
  );
}
