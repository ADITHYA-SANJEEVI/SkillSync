// frontend/components/SoftSidebar.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type NavItem = { label: string; href: string; emoji: string; danger?: boolean };

const NAV_TOP: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", emoji: "📊" },
  { label: "Resume", href: "/resume", emoji: "📄" },
  { label: "Extract Skills", href: "/extract-skills", emoji: "⚡" },
  { label: "Resume Score", href: "/resume-score", emoji: "⭐" },
  { label: "Skill Analysis", href: "/skill-analysis", emoji: "🔍" },
  { label: "Compute Gaps", href: "/compute-gaps", emoji: "🎯" },
  { label: "Course Genie", href: "/course-genie", emoji: "🎓" },
  { label: "Live Jobs", href: "/live-jobs", emoji: "🌍" },
  { label: "Omni Chat", href: "/chat", emoji: "💬" },
];

const SIDEBAR_W = 260;
const TRIGGER_W = 28;

/* Right-origin aurora overlay (unchanged) */
function OverlayFX({ active }: { active: boolean }) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!active) return;
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const dx = ((e.clientX / Math.max(1, window.innerWidth)) - 0.5) * 6;
      const dy = ((e.clientY / Math.max(1, window.innerHeight)) - 0.5) * 4;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--fx-x", `${dx.toFixed(2)}px`);
        el.style.setProperty("--fx-y", `${dy.toFixed(2)}px`);
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div ref={rootRef} className="fx5-root pointer-events-none" style={{ zIndex: 44 }} aria-hidden>
      <div className="fx5-mask">
        <div className="fx5-veil fx5-veil-a" />
        <div className="fx5-veil fx5-veil-b" />
        <div className="fx5-veil fx5-veil-c" />
        <div className="fx5-caustic" />
      </div>
    </div>
  );
}

export function SoftSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_pinned") === "1";
  });

  React.useEffect(() => {
    const saved = localStorage.getItem("sidebar_pinned");
    if (saved === "1") setPinned(true);
  }, []);

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const near = e.clientX <= TRIGGER_W;
      if (near) setOpen(true);
      else if (!pinned && e.clientX > SIDEBAR_W + 40) setOpen(false);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [pinned]);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem("sidebar_pinned", next ? "1" : "0");
    if (!next) setOpen(false);
  };

  const renderNav = (list: NavItem[]) => (
    <nav className="px-2 space-y-1">
      {list.map((i) => {
        const active =
          pathname === i.href || (i.href !== "/" && pathname?.startsWith(i.href + "/"));
        return (
          <a
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={[
              "relative flex items-center gap-3 px-3 rounded-xl border select-none cursor-pointer overflow-hidden group transition-all duration-300",
              "h-12 nav-card nav-aurora",
              active
                ? "border-cyan-400/70 bg-gradient-to-r from-cyan-400/15 to-transparent text-cyan-100 shadow-[0_0_25px_rgba(0,255,255,0.5)]"
                : "border-white/10 hover:border-cyan-300/30 hover:bg-white/5",
              i.danger ? "text-red-400 hover:text-red-300" : "",
            ].join(" ")}
          >
            {/* strong cyan halo when active */}
            {active && (
              <span
                className="absolute inset-0 rounded-xl blur-[14px] opacity-70 bg-cyan-400/30 animate-[pulse_3s_ease-in-out_infinite]"
                aria-hidden
              />
            )}
            <span className="icon-chip relative z-10">
              <span>{i.emoji}</span>
            </span>
            <span
              className={`text-[15px] leading-none truncate relative z-10 ${
                active
                  ? "text-cyan-200 drop-shadow-[0_0_6px_rgba(0,255,255,0.9)]"
                  : "text-white/90"
              }`}
            >
              {i.label}
            </span>
          </a>
        );
      })}
    </nav>
  );

  const fxActive = open || pinned;

  return (
    <>
      {/* hover edge */}
      <div
        className="fixed left-0 top-0 h-screen cursor-pointer"
        style={{ width: TRIGGER_W, zIndex: 40 }}
        onMouseEnter={() => setOpen(true)}
      />

      {/* frost */}
      <AnimatePresence>
        {fxActive && (
          <motion.div
            key="frost"
            className="fixed inset-0 z-[42] fx5-frost pointer-events-none"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(18px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* light FX */}
      <AnimatePresence>
        {fxActive && (
          <motion.div
            key="fx"
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 44 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <OverlayFX active />
          </motion.div>
        )}
      </AnimatePresence>

      {/* sidebar shell */}
      <AnimatePresence>
        {fxActive && (
          <motion.aside
            key="softbar"
            initial={{ x: -SIDEBAR_W, opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -SIDEBAR_W, opacity: 0.5 }}
            transition={{ type: "tween", duration: 0.25 }}
            className={[
              "fixed left-0 top-0 h-screen overflow-hidden backdrop-blur-2xl border-r border-white/10",
              "bg-[radial-gradient(circle_at_30%_20%,rgba(60,40,120,0.25),rgba(10,15,30,0.9))]",
              "shadow-[0_0_40px_rgba(80,50,180,0.4),inset_0_0_25px_rgba(255,255,255,0.05)]",
            ].join(" ")}
            style={{ width: SIDEBAR_W, zIndex: 45 }}
            data-app-taskbar
          >
            {/* header */}
            <div className="px-3 pt-3 pb-2 flex items-center justify-between">
              <div className="text-sm opacity-80">Navigation</div>

              {/* THEME-LOCKED GRADIENT PILL (same color, pinned or not) */}
              <button
                onClick={togglePin}
                className={[
                  "cursor-pointer text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-300",
                  "bg-gradient-to-r from-indigo-500 to-violet-600 text-white",
                  "shadow-[0_10px_30px_rgba(99,102,241,0.35)]",
                  "border border-white/10 hover:shadow-[0_14px_40px_rgba(139,92,246,0.45)]",
                  "focus:outline-none focus:ring-2 focus:ring-white/30",
                ].join(" ")}
                title={pinned ? "Unpin" : "Pin"}
                aria-pressed={pinned}
              >
                {pinned ? "Pinned" : "Pin"}
              </button>
            </div>

            <div className="flex flex-col h-[calc(100%-44px)]">
              <div className="flex-1 overflow-hidden">{renderNav(NAV_TOP)}</div>
              <div className="px-3 pb-3 pt-2">
                <div className="h-10 rounded-xl bg-gradient-to-r from-white/5 to-white/0 border border-white/10" />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
