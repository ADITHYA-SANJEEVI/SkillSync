"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

const links = [
  { href: "/dashboard/live-jobs",       title: "Live Jobs" },
  { href: "/dashboard/upload-resume",   title: "Upload Resume" },
  { href: "/dashboard/resume-list",     title: "Resume List" },
  { href: "/dashboard/pdf-match",       title: "PDF Match" },
  { href: "/dashboard/analyze-jobs",    title: "Analyze Jobs" },
  { href: "/dashboard/extract-skills",  title: "Extract Skills" },
  { href: "/dashboard/compute-gaps",    title: "Compute Gaps" },
  { href: "/dashboard/recommend",       title: "Recommend" },
  { href: "/dashboard/resume-score",    title: "Resume Score" },
  { href: "/dashboard/skill-analysis",  title: "Skill Analysis" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative min-h-[calc(100vh-64px)]">
      <aside
        className={`fixed top-[64px] left-0 h-[calc(100vh-64px)] w-72 bg-white/80 backdrop-blur border-r transition-transform duration-500 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 font-bold text-lg">Dashboard</div>
        <nav className="flex flex-col gap-1 px-3 pb-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-2 rounded-lg hover:bg-slate-100 transition"
            >
              {l.title}
            </Link>
          ))}
        </nav>
      </aside>
      <main
        className="transition-all duration-500"
        style={{ paddingLeft: open ? 304 : 0 }}
      >
        <div className="p-6">{children}</div>
      </main>
    </section>
  );
}
