"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowRight, Loader2 } from "lucide-react";

export default function EmailSentPage() {
  const [dots, setDots] = React.useState(".");
  React.useEffect(() => {
    const i = setInterval(() => setDots(d => (d.length < 3 ? d + "." : ".")), 500);
    return () => clearInterval(i);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] via-[#11152a] to-[#1a1030] text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl text-center"
      >
        <Mail size={48} className="mx-auto mb-4 text-fuchsia-400 animate-bounce" />
        <h1 className="text-2xl font-semibold mb-3">Check your inbox</h1>
        <p className="text-white/80 mb-6">
          We’ve sent a verification link to your email. Please confirm your address to continue{dots}
        </p>

        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 shadow-lg font-medium"
        >
          Go to Login
          <ArrowRight size={18} />
        </Link>
      </motion.div>
    </main>
  );
}
