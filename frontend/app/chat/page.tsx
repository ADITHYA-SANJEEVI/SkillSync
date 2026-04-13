"use client";
import { ChatPanel } from "../../components/ChatPanel";

export default function ChatPage() {
  return (
    <main className="px-4 sm:px-6 md:px-8 py-6 animate-fade-in">
      {/* ✨ Gradient header */}
      <h1 className="text-4xl md:text-5xl font-extrabold mb-6">
        <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent !text-transparent drop-shadow-[0_2px_10px_rgba(167,139,250,0.25)]">
          Omni Chat
        </span>
      </h1>

      {/* Chat UI */}
      <ChatPanel />
    </main>
  );
}
