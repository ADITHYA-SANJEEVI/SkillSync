"use client";

import * as React from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

/* ───────────────── config ───────────────── */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.trim() || "http://127.0.0.1:8000";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string };

const seed: Msg = {
  id: "seed-hello",
  role: "assistant",
  content: "Hi! Ask me anything about roles, resumes, interviews, or courses.",
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Ensure every message has a stable id */
function normalizeMessages(list: any[]): Msg[] {
  return (list ?? []).map((m, i) => ({
    id: typeof m?.id === "string" && m.id.length ? m.id : `m-${i}-${uid()}`,
    role: (m?.role === "user" || m?.role === "assistant" || m?.role === "system") ? m.role : "assistant",
    content: String(m?.content ?? ""),
  }));
}

/* ───── inline glam loader (assistant bubble) ───── */
function BubbleLoader() {
  return (
    <div className="inline-block px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.14)]">
      <div className="relative h-10 w-52 rounded-full overflow-hidden border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div
          className="absolute inset-0 animate-[sheen_2.2s_ease-in-out_infinite]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)" }}
        />
        {[0, 1, 2].map((k) => (
          <div
            key={k}
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full"
            style={{
              left: "10%",
              animation: `orbit${k} 1.6s ${k * 0.2}s ease-in-out infinite`,
              background: k === 0 ? "#8b5cf6" : k === 1 ? "#6366f1" : "#a78bfa",
              boxShadow: "0 0 12px rgba(139,92,246,.7)",
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes sheen { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }
        @keyframes orbit0 { 0% { transform: translate(0,-50%);} 50% { transform: translate(220%,-50%);} 100% { transform: translate(0,-50%);} }
        @keyframes orbit1 { 0% { transform: translate(25%,-50%);} 50% { transform: translate(245%,-50%);} 100% { transform: translate(25%,-50%);} }
        @keyframes orbit2 { 0% { transform: translate(50%,-50%);} 50% { transform: translate(270%,-50%);} 100% { transform: translate(50%,-50%);} }
      `}</style>
    </div>
  );
}

/* ───────────────── main ───────────────── */
export function ChatPanel() {
  const [mounted, setMounted] = React.useState(false); // avoid SSR/CSR mismatch
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Msg[]>([seed]);
  const [error, setError] = React.useState<string | null>(null);
  const [abortCtrl, setAbortCtrl] = React.useState<AbortController | null>(null);

  // After mount, hydrate from sessionStorage and normalize ids
  React.useEffect(() => {
    setMounted(true);
    try {
      const raw = sessionStorage.getItem("omniChatMessages");
      const parsed = raw ? JSON.parse(raw) : [seed];
      setMsgs(normalizeMessages(parsed));
    } catch {
      setMsgs([seed]);
    }
  }, []);

  // Persist messages
  React.useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem("omniChatMessages", JSON.stringify(msgs));
    } catch {}
  }, [mounted, msgs]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setError(null);
    const me: Msg = { id: uid(), role: "user", content: text };
    setMsgs((m) => [...m, me]);
    setInput("");

    const controller = new AbortController();
    setAbortCtrl(controller);

    try {
      const url = `${API_BASE}/api/v1/llm/prompt?temperature=0.25&max_tokens=900`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
        signal: controller.signal,
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} :: ${raw}`);

      let answer = "";
      try {
        const js = JSON.parse(raw);
        answer = js?.answer ?? js?.message ?? js?.choices?.[0]?.text ?? raw;
      } catch {
        answer = raw;
      }

      const bot: Msg = { id: uid(), role: "assistant", content: answer || "(no response)" };
      setMsgs((m) => [...m, bot]);
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? "⛔ Cancelled."
          : "Sorry — request failed. Is the backend on :8000 and CORS allowed?";
      setMsgs((m) => [...m, { id: uid(), role: "assistant", content: msg }]);
      setError(e?.name === "AbortError" ? null : (e?.message || "Request failed"));
    } finally {
      setBusy(false);
      setAbortCtrl(null);
    }
  }

  function cancel() {
    try { abortCtrl?.abort(); } catch {}
  }

  function clearChat() {
    setMsgs([seed]);
    setInput("");
    setError(null);
    try { sessionStorage.removeItem("omniChatMessages"); } catch {}
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!mounted) return null;

  return (
    <div className="relative max-w-4xl mx-auto w-full">
      {/* subtle backdrop tint */}
      <div className="pointer-events-none absolute -inset-10 bg-gradient-to-br from-[#0b0f1a]/40 via-[#281a3a]/35 to-[#4b2470]/30 rounded-[36px] blur-2xl" />

      {/* messages card */}
      <div className="glass p-5 rounded-3xl mb-6 relative shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <div className="max-h-[56vh] overflow-y-auto space-y-4 pr-2">
          {msgs.map((m) => (
            <motion.div
              key={m.id}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className={m.role === "user" ? "text-right" : "text-left"}
            >
              <div
                className={
                  "inline-block px-3.5 py-2.5 rounded-2xl " +
                  (m.role === "user"
                    ? "bg-[rgba(39,209,230,0.15)] border border-[rgba(39,209,230,0.35)] shadow-[0_6px_20px_rgba(0,0,0,0.25)]"
                    : "bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.14)] shadow-[0_6px_20px_rgba(0,0,0,0.25)]")
                }
              >
                <div className="prose prose-invert max-w-none text-[0.95rem] leading-relaxed">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Loader as assistant bubble */}
          {busy && (
            <div className="text-left">
              <BubbleLoader />
            </div>
          )}
        </div>
      </div>

      {/* composer card */}
      <div className="glass p-4 rounded-3xl relative shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type your question… (Enter to send, Shift+Enter for newline)"
          className="w-full input-glass h-[94px] resize-none"
        />

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-sm text-amber-300">{error}</div>
          <div className="flex items-center gap-3">
            {busy && (
              <button
                onClick={cancel}
                className="rounded-full px-3 py-2 text-sm bg-white/8 border border-white/15 hover:bg-white/12 transition"
                title="Cancel current request"
              >
                Cancel
              </button>
            )}
            <button onClick={send} disabled={busy || !input.trim()} className="btn-primary">
              {busy ? "Thinking…" : "Send"}
            </button>
            <button
              onClick={clearChat}
              className="rounded-full px-3 py-2 text-sm bg-white/6 border border-white/12 hover:bg-white/10 transition"
              title="Clear chat"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
