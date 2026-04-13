// app/signup/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function handleSignup() {
    try {
      setMsg(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      // If email confirmations are enabled, Supabase returns a user but no session.
      if (data.user && !data.session) {
        setLoading(false);
        router.push("/email-sent");          // or replace with: router.push("/login")
        return;
      }

      // (Rare) If a session exists immediately:
      if (data.session) {
        router.push("/dashboard");
        return;
      }

      // Fallback
      router.push("/login");
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
          Create Account
        </h1>

        <div className="mt-8 space-y-4">
          <input
            className="w-full p-3 rounded-xl bg-white/10 border border-white/10 focus:border-fuchsia-400 outline-none"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full p-3 rounded-xl bg-white/10 border border-white/10 focus:border-fuchsia-400 outline-none"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full p-3 rounded-xl bg-white/10 border border-white/10 focus:border-fuchsia-400 outline-none"
            type="password"
            placeholder="Password (min 8 chars)"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {msg && (
            <p className="text-sm text-white/80 bg-white/10 border border-white/10 rounded-lg px-3 py-2">
              {msg}
            </p>
          )}

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 font-medium hover:from-indigo-400 hover:to-fuchsia-400 shadow-lg disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-white/60">
          Already have an account?{" "}
          <Link href="/login" className="text-fuchsia-400 hover:underline">
            Log in
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
