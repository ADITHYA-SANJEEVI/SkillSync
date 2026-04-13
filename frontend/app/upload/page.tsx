"use client"

import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Upload, Check } from "lucide-react"

export default function UploadPage() {
  const [submitted, setSubmitted] = useState(false)
  const [consent, setConsent] = useState(false)

  const handleSubmit = () => {
    if (!consent) return
    // [WIRE_BACKEND:llm.uploadResume]
    // Placeholder for upload endpoint
    setSubmitted(true)
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-balance">{submitted ? "Thank You" : "Upload Resume"}</h1>
          <p className="text-[rgba(255,255,255,0.68)]">
            {submitted
              ? "Your resume has been received."
              : "Help us improve SkillSync by sharing your resume anonymously."}
          </p>
        </div>

        {!submitted ? (
          <div className="glass p-8 rounded-[16px] space-y-6">
            {/* Upload Area */}
            <div className="border-2 border-dashed border-[rgba(255,255,255,0.14)] rounded-[12px] p-8 text-center cursor-pointer hover:border-[#27d1e6] transition-colors">
              <Upload size={40} className="mx-auto mb-2 text-[rgba(255,255,255,0.32)]" />
              <p className="text-[rgba(255,255,255,0.68)]">Drop resume or click to browse</p>
            </div>

            {/* Privacy Info */}
            <div className="bg-[rgba(255,255,255,0.04)] p-4 rounded-[12px]">
              <p className="text-sm text-[rgba(255,255,255,0.68)]">
                ✓ We use your resume anonymously to improve our skill extraction and job matching algorithms.
              </p>
              <p className="text-sm text-[rgba(255,255,255,0.68)] mt-2">
                ✓ Your personal information is never shared or sold.
              </p>
              <p className="text-sm text-[rgba(255,255,255,0.68)] mt-2">✓ You can request deletion at any time.</p>
            </div>

            {/* Consent */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 w-4 h-4"
              />
              <span className="text-sm text-[rgba(255,255,255,0.68)]">
                I agree to share my resume to help SkillSync improve its service
              </span>
            </label>

            <button onClick={handleSubmit} disabled={!consent} className="btn-primary w-full">
              Submit Resume
            </button>
          </div>
        ) : (
          <div className="glass p-12 rounded-[16px] text-center animate-fade-in space-y-4">
            <div className="w-16 h-16 rounded-full bg-[rgba(46,211,167,0.2)] flex items-center justify-center mx-auto">
              <Check size={32} className="text-[#2ed3a7]" />
            </div>
            <h2 className="text-2xl font-bold text-[rgba(255,255,255,0.92)]">Resume Received</h2>
            <p className="text-[rgba(255,255,255,0.68)]">
              Thank you for helping us improve SkillSync. Your resume will be used anonymously.
            </p>
            <button className="btn-primary mt-4">Back to Dashboard</button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
