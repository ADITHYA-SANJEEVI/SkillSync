// app/login/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, Loader2, CheckCircle2, Mail, Lock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const verified = params.get("verified") === "1";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function handleLogin() {
    try {
      setMsg(null);
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
    } catch (e: any) {
      setMsg(e?.message || "Unexpected error");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] via-[#11152a] to-[#1a1030] text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl"
      >
        <h1 className="text-3xl text-center font-semibold bg-gradient-to-r from-indigo-400 to-fuchsia-500 bg-clip-text text-transparent">
          Welcome back
        </h1>

        {/* success banner after verification */}
        {verified && (
          <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 flex items-center gap-2">
            <CheckCircle2 size={18} /> Email verified — please log in to continue.
          </div>
        )}

        {/* error/info message */}
        {msg && (
          <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {msg}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-3.5 text-white/60" />
            <input
              className="w-full pl-9 p-3 rounded-xl bg-white/10 border border-white/10 focus:border-fuchsia-400 outline-none"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-3.5 text-white/60" />
            <input
              className="w-full pl-9 p-3 rounded-xl bg-white/10 border border-white/10 focus:border-fuchsia-400 outline-none"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 font-medium hover:from-indigo-400 hover:to-fuchsia-400 shadow-lg disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {loading ? "Signing in…" : "Log In"}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-white/60">
          New here?{" "}
          <Link href="/signup" className="text-fuchsia-400 hover:underline">
            Create an account
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
