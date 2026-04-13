"use client";
import { useState } from "react";
import { apiPostJSON } from "./ApiClient";

export default function PromptChat() {
  const [prompt, setPrompt] = useState("");
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true); setErr(null); setOut(null);
    try {
      const data = await apiPostJSON<any>("/api/v1/llm/prompt", { prompt });
      setOut(data);
    } catch (e: any) { setErr(e?.message || "Prompt failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <textarea className="w-full h-32 border rounded-lg p-2" placeholder="Ask the LLM…" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button onClick={run} disabled={busy} className="px-3 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-50">{busy ? "Asking…" : "Send"}</button>
      {err && <p className="text-red-600">{err}</p>}
      {out && <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto">{JSON.stringify(out, null, 2)}</pre>}
    </div>
  );
}
