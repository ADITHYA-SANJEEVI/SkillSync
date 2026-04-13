"use client";

import { useMemo, useState, type ComponentType } from "react";
import JobFeed from "@/components/JobFeed";
import ResumeUpload from "@/components/ResumeUpload";
import QuickMatch from "@/components/QuickMatch";
import TargetedMatch from "@/components/TargetedMatch";
import ResumeScore from "@/components/ResumeScore";
import PromptChat from "@/components/PromptChat";
import Diagnostics from "@/components/Diagnostics";
import ConfusionMatrixCard from "@/components/ConfusionMatrixCard";

type TabDef = {
  key: string;
  label: string;
  Comp: ComponentType; // avoid React namespace to fix “Cannot find namespace 'React'”
};

export default function DashboardPage() {
  const [active, setActive] = useState<string>("feed");

  const tabs: TabDef[] = useMemo(
    () => [
      { key: "feed", label: "Job Feed", Comp: JobFeed },
      { key: "upload", label: "Upload Resume", Comp: ResumeUpload },
      { key: "quick", label: "Quick Match", Comp: QuickMatch },
      { key: "target", label: "Targeted Match", Comp: TargetedMatch },
      { key: "score", label: "Resume Score", Comp: ResumeScore },
      { key: "prompt", label: "Prompt Chat", Comp: PromptChat },
      { key: "diag", label: "Diagnostics", Comp: Diagnostics },
      { key: "cm", label: "Confusion Matrix", Comp: ConfusionMatrixCard },
    ],
    []
  );

  const ActiveComp: ComponentType =
    tabs.find((t) => t.key === active)?.Comp ?? tabs[0]?.Comp ?? (() => null);

  return (
    <main className="space-y-6">
      <div className="rounded-2xl p-4 bg-white border shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`px-3 py-1.5 rounded-lg border text-sm ${
                active === t.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white hover:bg-slate-50"
              }`}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-4 bg-white border shadow-sm">
        <ActiveComp />
      </div>
    </main>
  );
}
