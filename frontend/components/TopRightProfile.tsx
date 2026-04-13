// components/TopRightProfile.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { User, ChevronDown, LogOut, Settings } from "lucide-react";

export default function TopRightProfile() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setOpen(false);
      // ⬇️ Redirect to /login (not /auth/login)
      try { router.replace("/login"); } catch {}
      if (typeof window !== "undefined") window.location.assign("/login");
    }
  }

  return (
    <div className="fixed top-4 right-4 z-[70] select-none" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "group inline-flex items-center justify-center",
          "h-10 w-10 rounded-full",
          "bg-white/5 hover:bg-white/10",
          "ring-1 ring-white/10",
          "backdrop-blur-md",
          "transition-all duration-200",
          "shadow-[0_4px_24px_rgba(0,0,0,0.35)]",
          "relative",
        ].join(" ")}
        aria-label="Open profile menu"
      >
        <span
          className={[
            "absolute inset-0 rounded-full -z-10",
            "bg-[conic-gradient(from_0deg,theme(colors.indigo.500)_0%,theme(colors.violet.500)_40%,theme(colors.fuchsia.500)_70%,theme(colors.indigo.500)_100%)]",
            "opacity-40 blur-[8px]",
            "transition-opacity duration-300",
            "group-hover:opacity-60",
          ].join(" ")}
        />
        <span
          className={[
            "absolute inset-[2px] rounded-full",
            "bg-black/40 backdrop-blur-md",
            "ring-1 ring-white/10",
          ].join(" ")}
        />
        <User className="relative z-10 h-[18px] w-[18px] text-white/90" />
        <ChevronDown
          className={[
            "absolute -right-1.5 -bottom-1.5 h-[14px] w-[14px]",
            "text-white/70",
            "transition-transform duration-200",
            open ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </button>

      {open && (
        <div
          className={[
            "absolute right-0 mt-3 w-[220px]",
            "rounded-2xl p-2",
            "bg-black/60 backdrop-blur-xl",
            "ring-1 ring-white/10",
            "shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
            "z-[60]",
            "animate-in fade-in zoom-in-95 duration-150 origin-top-right",
            "before:content-[''] before:absolute before:inset-0 before:rounded-2xl",
            "before:pointer-events-none before:ring-1 before:ring-transparent",
            "before:[background:conic-gradient(from_180deg,theme(colors.indigo.500)_0%,theme(colors.violet.500)_50%,theme(colors.fuchsia.500)_100%)]",
            "before:opacity-[0.18] before:blur-[12px]",
          ].join(" ")}
          role="menu"
        >
          <div
            className={[
              "flex items-center gap-3 px-3 py-2.5 mb-1.5",
              "rounded-xl",
              "bg-white/[0.03]",
              "ring-1 ring-white/10",
            ].join(" ")}
          >
            <div className="relative h-8 w-8">
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 opacity-60 blur-[6px]" />
              <div className="relative h-8 w-8 rounded-full bg-black/50 ring-1 ring-white/15 grid place-items-center">
                <User className="h-[16px] w-[16px] text-white/90" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-sm text-white/90 leading-tight">Signed in</div>
              <div className="text-[11px] text-white/50 leading-tight">Manage your profile</div>
            </div>
          </div>

          {/* Profile */}
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/90 hover:bg-white/[0.06] hover:ring-1 hover:ring-white/10 transition group/item"
          >
            <div className="relative grid place-items-center h-6 w-6">
              <span className="absolute inset-0 rounded-md bg-gradient-to-br from-indigo-500/30 via-violet-500/30 to-fuchsia-500/30 opacity-0 group-hover/item:opacity-100 blur-[6px] transition" />
              <User className="relative h-[16px] w-[16px] text-white/85" />
            </div>
            <span className="text-sm">My Profile</span>
            <span className="ml-auto text-[10px] text-white/40">→</span>
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/90 hover:bg-white/[0.06] hover:ring-1 hover:ring-white/10 transition group/item"
          >
            <div className="relative grid place-items-center h-6 w-6">
              <span className="absolute inset-0 rounded-md bg-gradient-to-br from-sky-500/30 via-indigo-500/30 to-violet-500/30 opacity-0 group-hover/item:opacity-100 blur-[6px] transition" />
              <Settings className="relative h-[16px] w-[16px] text-white/85" />
            </div>
            <span className="text-sm">Settings</span>
            <span className="ml-auto text-[10px] text-white/40">⚙</span>
          </Link>

          {/* Logout */}
          <button
            role="menuitem"
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-300 hover:text-red-200 hover:bg-red-500/10 hover:ring-1 hover:ring-red-500/20 transition group/item"
          >
            <div className="relative grid place-items-center h-6 w-6">
              <span className="absolute inset-0 rounded-md bg-gradient-to-br from-rose-500/25 via-orange-500/25 to-amber-500/25 opacity-0 group-hover/item:opacity-100 blur-[6px] transition" />
              <LogOut className="relative h-[16px] w-[16px]" />
            </div>
            <span className="text-sm">Logout</span>
            <span className="ml-auto text-[10px] text-white/35">↩</span>
          </button>
        </div>
      )}
    </div>
  );
}
