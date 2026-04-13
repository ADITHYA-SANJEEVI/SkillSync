// app/auth/callback/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  CheckCircle2,
  XCircle,
  Laptop2,
  Smartphone,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function AuthCallback() {
  const router = useRouter();
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = React.useState("Verifying your email…");

  const isMobile =
    typeof navigator !== "undefined" &&
    /android|iphone|ipad|mobile/i.test(navigator.userAgent);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Supabase has already processed the token in the email link.
        // We just confirm things look good, then bounce to /login?verified=1
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          setState("error");
          setMsg(error.message || "Verification failed.");
          return;
        }

        setState("ok");
        setMsg("Email confirmed! Redirecting to login…");

        // Always route to login after verification (your requested flow)
        const t = setTimeout(() => {
          router.replace("/login?verified=1");
        }, 900);
        return () => clearTimeout(t);
      } catch (e: any) {
        if (!mounted) return;
        setState("error");
        setMsg(e?.message || "Something went wrong.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] via-[#11152a] to-[#1a1030] text-white px-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-white/6 backdrop-blur-xl border border-white/10 shadow-2xl text-center">
        {state === "loading" && (
          <Loader2 className="mx-auto mb-4 animate-spin" size={28} />
        )}
        {state === "ok" && (
          <CheckCircle2 className="mx-auto mb-4 text-emerald-400" size={32} />
        )}
        {state === "error" && (
          <XCircle className="mx-auto mb-4 text-rose-400" size={32} />
        )}

        <h1 className="text-2xl font-semibold">{msg}</h1>

        <p className="mt-2 text-white/70 text-sm flex items-center justify-center gap-2">
          {isMobile ? <Smartphone size={16} /> : <Laptop2 size={16} />}
          {isMobile
            ? "If you started on your laptop, you can now log in there too."
            : "You can proceed to the app login page."}
        </p>

        <button
          onClick={() => router.replace("/login?verified=1")}
          className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 shadow-lg font-medium"
        >
          Go to Login now <ArrowRight size={18} />
        </button>
      </div>

      {/* soft mists */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-24 size-[420px] rounded-full blur-3xl opacity-20 bg-indigo-500" />
        <div className="absolute -bottom-24 -right-24 size-[420px] rounded-full blur-3xl opacity-20 bg-fuchsia-500" />
      </div>
    </main>
  );
}
