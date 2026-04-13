"use client"

import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Lightbulb } from "lucide-react"

export default function AnalyzePage() {
  const [jobDescription, setJobDescription] = useState("")
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) return
    setLoading(true)
    // [WIRE_BACKEND:llm.analyze-jobs]
    // Placeholder for job analysis endpoint
    setTimeout(() => {
      setAnalysis({
        mustHaves: ["React", "TypeScript", "REST APIs", "5+ years experience"],
        niceToHaves: ["AWS", "GraphQL", "Docker", "Team Leadership"],
        roleLevel: "Senior / Lead",
        insights:
          "This is a leadership role requiring strong technical foundation with architectural responsibilities.",
      })
      setLoading(false)
    }, 2000)
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-balance flex items-center gap-2">
            <Lightbulb size={32} className="text-[#27d1e6]" />
            Analyze Job
          </h1>
          <p className="text-[rgba(255,255,255,0.68)]">Get insights from any job description.</p>
        </div>

        {!analysis ? (
          <div className="glass p-8 rounded-[16px] space-y-4">
            <label className="block">
              <p className="text-sm font-medium text-[rgba(255,255,255,0.92)] mb-2">Paste job description</p>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full h-64 p-4 rounded-[12px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.14)] text-[rgba(255,255,255,0.92)] placeholder-[rgba(255,255,255,0.32)] focus:border-transparent focus:ring-2 focus:ring-[#27d1e6] focus:ring-offset-0 resize-none"
                placeholder="Paste the full job description here..."
              />
            </label>
            <button onClick={handleAnalyze} disabled={!jobDescription.trim() || loading} className="btn-primary w-full">
              {loading ? "Analyzing..." : "Analyze Now"}
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {[
              { title: "Must-Haves", items: analysis.mustHaves, color: "#ef6262" },
              { title: "Nice-to-Haves", items: analysis.niceToHaves, color: "#f5b14b" },
            ].map((section, i) => (
              <div
                key={i}
                className="glass p-6 rounded-[16px] animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <h3 className="font-semibold mb-3" style={{ color: section.color }}>
                  {section.title}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {section.items.map((item, j) => (
                    <span
                      key={j}
                      className="px-3 py-1 rounded-[8px] text-xs font-medium"
                      style={{ background: section.color + "15", color: section.color }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            <div className="glass p-6 rounded-[16px] space-y-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
              <div>
                <p className="text-sm text-[rgba(255,255,255,0.68)] mb-1">Role Level</p>
                <p className="text-lg font-semibold">{analysis.roleLevel}</p>
              </div>
              <div className="pt-4 border-t border-[rgba(255,255,255,0.14)]">
                <p className="text-sm text-[rgba(255,255,255,0.68)] mb-2">Insights</p>
                <p className="text-[rgba(255,255,255,0.92)]">{analysis.insights}</p>
              </div>
            </div>

            <button
              className="btn-ghost w-full"
              onClick={() => {
                setAnalysis(null)
                setJobDescription("")
              }}
            >
              Analyze Another Job
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
