"use client";

import * as React from "react";
import {
  DEFAULTS,
  type SettingsModel,
  getSettings,
  saveSettings,
} from "@/lib/settings";

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed right-4 top-4 z-[3000] rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-white shadow">
      {msg}
    </div>
  );
}

export default function SettingsPage() {
  const [s, setS] = React.useState<SettingsModel>(DEFAULTS);
  const [mounted, setMounted] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    setS(getSettings());
    setMounted(true);
  }, []);

  function ping(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1200);
  }

  function update<K extends keyof SettingsModel>(key: K, val: SettingsModel[K], label?: string) {
    const next = { ...s, [key]: val };
    setS(next);
    saveSettings(next);
    if (label) ping(`${label} applied`);
  }

  function clearCaches() {
    // Course Genie
    try {
      localStorage.removeItem("courseGenie.input.v1");
      localStorage.removeItem("courseGenie.result.v1");
    } catch {}
    // Compute Gaps
    try {
      localStorage.removeItem("computeGaps.result.v1");
      localStorage.removeItem("computeGaps.resumeName.v1");
      localStorage.removeItem("computeGaps.jdName.v1");
    } catch {}
    // Skill Analysis / Resume Score (session)
    try { sessionStorage.clear(); } catch {}
    ping("Caches cleared");
  }

  function resetUi() {
    setS(DEFAULTS);
    saveSettings(DEFAULTS);
    ping("UI reset");
  }

  if (!mounted) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-white/80">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      {toast && <Toast msg={toast} />}
      <div className="mx-auto w-[min(960px,100%)]">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white/90">Settings</h1>
          <p className="text-white/60">Useful switches that apply immediately across the app.</p>
        </header>

        {/* Appearance */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-medium text-white/90">Appearance</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => update("darkMode", !s.darkMode, "Theme")}
              className={`flex items-center justify-between rounded-2xl border px-4 py-4 ${
                s.darkMode ? "border-white/20 bg-white/10 text-white"
                           : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <span>Dark mode</span>
              <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1">
                {s.darkMode ? "on" : "off"}
              </span>
            </button>

            <button
              onClick={() => update("reducedMotion", !s.reducedMotion, "Reduced motion")}
              className={`flex items-center justify-between rounded-2xl border px-4 py-4 ${
                s.reducedMotion ? "border-white/20 bg-white/10 text-white"
                                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <span>Reduced motion</span>
              <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1">
                {s.reducedMotion ? "on" : "off"}
              </span>
            </button>

            <button
              onClick={() => update("confetti", !s.confetti, "Confetti")}
              className={`flex items-center justify-between rounded-2xl border px-4 py-4 md:col-span-2 ${
                s.confetti ? "border-white/20 bg-white/10 text-white"
                           : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <span>Confetti / Fireworks</span>
              <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1">
                {s.confetti ? "enabled" : "disabled"}
              </span>
            </button>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
              <div className="mb-2 text-white/80">Map pin color</div>
              <div className="flex gap-3">
                {(["red","violet"] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => update("mapPinColor", opt, "Pin color")}
                    className={`rounded-xl px-3 py-1 text-sm border ${
                      s.mapPinColor === opt
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >{opt}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/60">
                Applies instantly to existing Leaflet markers via CSS filter.
              </p>
            </div>
          </div>
        </section>

        {/* Behavior */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-medium text-white/90">Behavior</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 text-white/80">Loader style</div>
              <div className="flex flex-wrap gap-3">
                {(["dots","ring","shimmer"] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => update("loaderStyle", opt, "Loader")}
                    className={`rounded-xl px-3 py-1 text-sm border ${
                      s.loaderStyle === opt
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >{opt}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/60">
                Exposed as <code>data-loader-style</code> on <code>&lt;html&gt;</code>.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 text-white/80">Loader z-index</div>
              <input
                type="number" min={0} max={9999}
                value={s.loaderZ}
                onChange={(e) => update("loaderZ", Number(e.target.value || 0), "Loader z")}
                className="w-32 rounded-lg border border-white/10 bg-black/20 px-3 py-1 text-white/90"
              />
              <p className="mt-2 text-xs text-white/60">
                Provided as CSS var <code>--loader-z</code>; set to 39 to sit under taskbar.
              </p>
            </div>

            <button
              onClick={() => update("keepSession", !s.keepSession, "Session persistence")}
              className={`flex items-center justify-between rounded-2xl border px-4 py-4 md:col-span-2 ${
                s.keepSession ? "border-white/20 bg-white/10 text-white"
                              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <span>Keep results in session</span>
              <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1">
                {s.keepSession ? "on" : "off"}
              </span>
            </button>
          </div>
        </section>

        {/* Data */}
        <section className="mb-10 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-medium text-white/90">Data</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={clearCaches}
              className="rounded-xl bg-white/5 px-4 py-2 text-white/80 border border-white/10 hover:bg-white/10"
            >
              Clear local caches
            </button>

            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "settings.v1.json"; a.click();
                URL.revokeObjectURL(url);
                ping("Exported");
              }}
              className="rounded-xl bg-white/5 px-4 py-2 text-white/80 border border-white/10 hover:bg-white/10"
            >
              Export settings
            </button>

            <label className="rounded-xl bg-white/5 px-4 py-2 text-white/80 border border-white/10 hover:bg-white/10 cursor-pointer">
              Import settings
              <input
                type="file" accept="application/json" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const next = { ...DEFAULTS, ...JSON.parse(String(reader.result)) } as SettingsModel;
                      setS(next); saveSettings(next); ping("Imported");
                    } catch {}
                  };
                  reader.readAsText(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button
              onClick={resetUi}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-white shadow"
            >
              Reset UI
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
