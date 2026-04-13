"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  useSpring,
} from "framer-motion";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import {
  BookOpen,
  Brain,
  Sparkles,
  Upload,
  MessageCircle,
  Search,
  Trophy,
  Info,
} from "lucide-react";

/* ───────────────── tokens ───────────────── */
const TOKENS = {
  textPrimary: "text-white/90",
  textSecondary: "text-white/65",
  glassBg: "bg-[rgba(255,255,255,0.08)]",
  glassBorder: "border-white/15",
};

/* ───────────────── utils ───────────────── */
function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}
function useMounted() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => setM(true), []);
  return m;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* animated number that eases to target */
function useTweenedNumber(value: number) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 120, damping: 22, mass: 0.6 });
  const [n, setN] = React.useState(value);
  React.useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  React.useEffect(() => spring.on("change", (v) => setN(v)), [spring]);
  return n;
}

/* ───────────────── state ───────────────── */
type SetupState = {
  resumeUploaded: boolean;
  analyzed: boolean;
  coursesViewed: boolean;
  streakDays: number;
  resumeScore: number;
  skillsMastered: number;
};
const DEFAULT_STATE: SetupState = {
  resumeUploaded: false,
  analyzed: false,
  coursesViewed: false,
  streakDays: 0,
  resumeScore: 62,
  skillsMastered: 12,
};
function useHydratedSetup(): [SetupState, (p: Partial<SetupState>) => void] {
  const mounted = useMounted();
  const [s, setS] = React.useState(DEFAULT_STATE);
  React.useEffect(() => {
    if (!mounted) return;
    const v = localStorage.getItem("dashboard.setup.v1");
    if (v) setS({ ...DEFAULT_STATE, ...JSON.parse(v) });
  }, [mounted]);
  const patch = React.useCallback((p: Partial<SetupState>) => {
    setS((prev) => {
      const n = { ...prev, ...p };
      localStorage.setItem("dashboard.setup.v1", JSON.stringify(n));
      return n;
    });
  }, []);
  return [s, patch];
}
const stepsComplete = (s: SetupState) =>
  [s.resumeUploaded, s.analyzed, s.coursesViewed].filter(Boolean).length;
const pctOfDone = (s: SetupState) => Math.round((stepsComplete(s) / 3) * 100);

/* ───────────────── data ───────────────── */
const SKILL_RADAR_DATA = [
  { area: "AI", value: 72 },
  { area: "Cloud", value: 64 },
  { area: "Data", value: 86 },
  { area: "Communication", value: 61 },
  { area: "Research", value: 74 },
  { area: "Systems", value: 58 },
];
const COURSES = [
  { id: "c1", title: "SQL Sprint: 14-Day Fundamentals", bucket: "Quick Wins" },
  { id: "c2", title: "Data Analysis with Pandas", bucket: "Foundations" },
  { id: "c3", title: "Model Evaluation & Tuning", bucket: "Projects" },
  { id: "c4", title: "Docker for ML", bucket: "Foundations" },
  { id: "c5", title: "MLOps Basics", bucket: "Stretch" },
  { id: "c6", title: "Effective Technical Communication", bucket: "Stretch" },
];
const PATH_STEPS = [
  { key: "resume", label: "Upload Résumé", href: "/resume" },
  { key: "analyze", label: "Analyze Skills", href: "/extract-skills" },
  { key: "compute", label: "Compute Gaps", href: "/compute-gaps" },
  { key: "plan", label: "Get Plan", href: "/course-genie" },
  { key: "practice", label: "Practice", href: "/course-genie" },
  { key: "apply", label: "Apply & Reflect", href: "/live-jobs" },
];

/* ───────────────── aurora bg ───────────────── */
function AuroraBackground() {
  const mx = useMotionValue(0),
    my = useMotionValue(0);
  const rx = useTransform(my, [-50, 50], [8, -8]);
  const ry = useTransform(mx, [-50, 50], [-8, 8]);
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mx.set((e.clientX / window.innerWidth) * 100 - 50);
      my.set((e.clientY / window.innerHeight) * 100 - 50);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        style={{ rotateX: rx as any, rotateY: ry as any }}
        className="absolute -inset-[28%]"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#11162a] to-[#1b1440]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            background:
              "radial-gradient(1200px 600px at 20% -10%, rgba(99,102,241,.9), transparent 60%)," +
              "radial-gradient(900px 500px at 80% 10%, rgba(139,92,246,.85), transparent 60%)," +
              "radial-gradient(1100px 700px at 50% 120%, rgba(56,189,248,.65), transparent 60%)",
          }}
        />
        <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:4px_4px]" />
      </motion.div>
    </div>
  );
}

/* ───────────────── header ───────────────── */
/* read first name from profile, with safe fallbacks (no SSR mismatch) */
function useFirstName() {
  const mounted = useMounted();
  const [first, setFirst] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!mounted) return;
    try {
      // Try a few sensible keys you likely already use
      const fromJSON = (s: string | null) => {
        if (!s) return null;
        try { return JSON.parse(s); } catch { return null; }
      };

      const candidates = [
        fromJSON(localStorage.getItem("profile.summary.v1")),
        fromJSON(localStorage.getItem("user.profile.summary")),
        fromJSON(localStorage.getItem("profile.v1")),
        fromJSON(sessionStorage.getItem("profile.summary.v1")),
      ].filter(Boolean) as Array<{ full_name?: string; name?: string }>;

      let fullName =
        (candidates[0]?.full_name || candidates[0]?.name) ??
        (candidates[1]?.full_name || candidates[1]?.name) ??
        (candidates[2]?.full_name || candidates[2]?.name) ??
        (candidates[3]?.full_name || candidates[3]?.name) ??
        // optional global (if you set it anywhere)
        ((window as any).__PROFILE__?.full_name as string | undefined);

      if (typeof fullName === "string" && fullName.trim()) {
        const f = fullName.trim().split(/\s+/)[0];
        setFirst(f);
      } else {
        setFirst(null);
      }
    } catch {
      setFirst(null);
    }
  }, [mounted]);

  return first; // null until we find it
}

/* ───────────────── header ───────────────── */
function HeaderWelcome() {
  const first = useFirstName(); // ← new
  const nameToShow = first || "Adithya"; // graceful fallback to your current static

  return (
    <div className="relative z-[1]">
      <h1
        className={cn(
          "text-[40px] md:text-[56px] font-extrabold leading-[1.05]",
          TOKENS.textPrimary
        )}
      >
        Welcome back,{" "}
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-400">
          {nameToShow}
        </span>{" "}
      </h1>
      <p className={cn("mt-2 text-sm md:text-base", TOKENS.textSecondary)}>
        Craft &gt; speed. You’re building something real.
      </p>
    </div>
  );
}


/* ───────────────── gamify: xp bar ───────────────── */
function XPBar({ pct }: { pct: number }) {
  const gradient =
    pct < 33
      ? "from-indigo-500 via-violet-500 to-sky-400"
      : pct < 66
        ? "from-violet-500 via-fuchsia-500 to-rose-400"
        : "from-emerald-500 via-teal-400 to-cyan-400";
  const tweened = useTweenedNumber(pct);
  return (
    <div className="relative rounded-2xl border border-white/10 p-3 backdrop-blur-xl bg-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-white/85">
          <Trophy className="h-4 w-4" />
          <span className="text-sm font-medium">XP Progress</span>
        </div>
        <span className="text-[11px] text-white/60">{Math.round(tweened)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className={cn("h-full bg-gradient-to-r", gradient)}
          style={{ width: `${Math.max(2, tweened)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/50">
        <span>Bronze</span>
        <span>Silver</span>
        <span>Gold</span>
      </div>
    </div>
  );
}

/* ───────────────── confetti ───────────────── */
function ConfettiBurst({ fire }: { fire: boolean }) {
  const pieces = Array.from({ length: 24 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {fire &&
        pieces.map((_, i) => (
          <span
            key={i}
            className="absolute top-1/2 left-1/2 h-2 w-2"
            style={{
              background: ["#f59e0b", "#94a3b8", "#fde047", "#38bdf8"][i % 4],
              borderRadius: 2,
              transform: "translate(-50%, -50%)",
              animation: `confetti-pop 900ms ease-out forwards`,
              animationDelay: `${(i % 12) * 15}ms`,
              ["--dx" as any]: `${(i % 8) - 4}rem`,
              ["--dy" as any]: `${(i % 6) * -1.6 - 3}rem`,
              ["--rz" as any]: `${(i % 12) * 35}deg`,
            } as React.CSSProperties}
          />
        ))}
      <style>{`
        @keyframes confetti-pop {
          0%{opacity:0;transform:translate(-50%,-50%) rotate(0) scale(.8)}
          10%{opacity:1}
          100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--rz)) scale(1)}
        }
      `}</style>
    </div>
  );
}

/* ───────────────── achievements (sequential + colored) ───────────────── */
type BadgeKey = "bronze" | "silver" | "gold";
const BADGE_THRESHOLDS: Record<BadgeKey, number> = {
  bronze: 33,
  silver: 66,
  gold: 100,
};
type Earned = { bronze: boolean; silver: boolean; gold: boolean };

type BadgeKey = "bronze" | "silver" | "gold";
type Earned = { bronze: boolean; silver: boolean; gold: boolean };

function useEarnedBadges(pct: number): [Earned, (e: Earned) => void, BadgeKey | null] {
  const [earned, setEarned] = React.useState<Earned>({
    bronze: false,
    silver: false,
    gold: false,
  });
  const [toast, setToast] = React.useState<BadgeKey | null>(null);

  // one-time load from storage
  const didInit = React.useRef(false);
  const prevEarnedRef = React.useRef<Earned>(earned);

  React.useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    try {
      const v = localStorage.getItem("dashboard.badges.v1");
      if (v) {
        const parsed = JSON.parse(v) as Partial<Earned>;
        const init: Earned = {
          bronze: !!parsed.bronze,
          silver: !!parsed.silver,
          gold: !!parsed.gold,
        };
        prevEarnedRef.current = init;
        setEarned(init);
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  // derive target state from current progress (with gating)
  const target: Earned = React.useMemo(() => {
    const bronze = pct >= 33;
    const silver = bronze && pct >= 66;
    const gold = silver && pct >= 100;
    return { bronze, silver, gold };
  }, [pct]);

  // sync earned with target; toast only on upward threshold crossings
  React.useEffect(() => {
    const prev = prevEarnedRef.current;

    let newToast: BadgeKey | null = null;
    if (!prev.bronze && target.bronze) newToast = "bronze";
    else if (!prev.silver && target.silver) newToast = "silver";
    else if (!prev.gold && target.gold) newToast = "gold";

    prevEarnedRef.current = target;
    setEarned(target);
    localStorage.setItem("dashboard.badges.v1", JSON.stringify(target));

    if (newToast) {
      setToast(newToast);
      const t = setTimeout(() => setToast(null), 1800);
      return () => clearTimeout(t);
    } else {
      setToast(null); // no toast on downgrades
    }
  }, [target]);

  return [earned, setEarned, toast];
}


function AchievementsPanel({ pct }: { pct: number }) {
  const [earned] = useEarnedBadges(pct);
  const [toast, setToast] = React.useState<BadgeKey | null>(null);

  React.useEffect(() => {
    if (pct >= 100 && earned.gold) setToast("gold");
    else if (pct >= 66 && earned.silver) setToast("silver");
    else if (pct >= 33 && earned.bronze) setToast("bronze");
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earned.bronze, earned.silver, earned.gold]);

  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-3">
        <BadgeCard label="Bronze" active={earned.bronze} tone="bronze" />
        <BadgeCard label="Silver" active={earned.silver} tone="silver" />
        <BadgeCard label="Gold" active={earned.gold} tone="gold" />
      </div>

      <ConfettiBurst fire={!!toast} />
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 z-[5]"
          >
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-xl text-white/90 text-sm shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
              {toast === "gold"
                ? "Legend! Gold badge unlocked 🏆"
                : toast === "silver"
                  ? "Silver badge unlocked ✨"
                  : "Bronze badge unlocked 🌟"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BadgeCard({
  label,
  active,
  tone,
}: {
  label: string;
  active: boolean;
  tone: "bronze" | "silver" | "gold";
}) {
  const palette =
    tone === "bronze"
      ? {
        glow: "rgba(180, 83, 9, 0.35)",
        ring: "border-amber-600/60",
        fill: "from-amber-700 via-orange-600 to-amber-400",
      }
      : tone === "silver"
        ? {
          glow: "rgba(148,163,184,0.40)",
          ring: "border-zinc-300/70",
          fill: "from-zinc-200 via-slate-300 to-zinc-400",
        }
        : {
          glow: "rgba(234,179,8,0.40)",
          ring: "border-yellow-400/70",
          fill: "from-yellow-400 via-amber-300 to-yellow-200",
        };

  return (
    <div
      className={cn(
        "rounded-2xl border p-3 grid place-items-center transition pointer-events-none",
        TOKENS.glassBorder,
        TOKENS.glassBg,
        active ? `${palette.ring} shadow-[0_0_24px_${palette.glow}]` : "opacity-85"
      )}
      title={active ? `${label} achieved` : `${label} — locked`}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-xl grid place-items-center border border-white/15",
          active ? "bg-gradient-to-br " + palette.fill : "bg-white/10"
        )}
      >
        <Trophy className={cn("h-5 w-5", active ? "text-black/80" : "text-white/70")} />
      </div>
      <div className={cn("text-xs mt-2", active ? "text-white" : "text-white/70")}>
        {label}
      </div>
    </div>
  );
}

/* ───────────────── basic atoms ───────────────── */
function MiniBtn({
  children,
  href,
  primary,
}: {
  children: React.ReactNode;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs border transition",
        primary
          ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-transparent"
          : "text-white/85 border-white/15 hover:bg-white/10"
      )}
    >
      {children}
    </Link>
  );
}
function PrimaryBtn({
  href,
  children,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 font-medium text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-[0_10px_30px_rgba(99,102,241,0.35)] hover:shadow-[0_14px_40px_rgba(139,92,246,0.45)] transition"
    >
      {icon}
      {children}
    </Link>
  );
}
function GhostBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 font-medium text-white/90 border border-white/15 hover:bg-white/10 transition"
    >
      {children}
    </Link>
  );
}
function OrbitChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={cn(
        "rounded-full px-3 py-1 text-xs border",
        TOKENS.glassBorder,
        TOKENS.glassBg,
        "backdrop-blur-xl"
      )}
    >
      <span className="text-white/70">{label}</span>{" "}
      <span className="font-semibold">{value}</span>
    </div>
  );
}

/* >>>>>>>>>>>>>>>>>>>>>>>>>>  StepSwitch (missing piece)  <<<<<<<<<<<<<<<<<<<<<<<<<< */
function StepSwitch({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "w-full h-12",                           // ← same width & height
        "group flex items-center justify-between",
        "rounded-2xl border px-5 transition",
        TOKENS.glassBg,
        active
          ? "border-emerald-400/40 text-emerald-100"
          : "border-white/12 text-white/80 hover:bg-white/10"
      )}
      title="Local preview toggle"
    >
      <span className="text-sm">{label}</span>
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full shadow",
          active ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" : "bg-white/30"
        )}
      />
    </button>
  );
}


/* ───────────────── momentum (animated ring + hue + gated steps) ───────────────── */
/* ───────────────── MomentumCore (locked 1→2→3 forward, 3→2→1 backward) ───────────────── */
function MomentumCore({
  state,
  onToggle,
}: {
  state: SetupState;
  onToggle: (p: Partial<SetupState>) => void;
}) {
  /* ---- helpers to map boolean flags <-> a single level (0..3) ---- */
  const levelFromState = (s: SetupState): number => {
    if (!s.resumeUploaded) return 0;
    if (!s.analyzed) return 1;
    if (!s.coursesViewed) return 2;
    return 3;
  };
  const stateFromLevel = (lvl: number): Partial<SetupState> => {
    const L = Math.max(0, Math.min(3, lvl));
    return {
      resumeUploaded: L >= 1,
      analyzed: L >= 2,
      coursesViewed: L >= 3,
    };
  };

  const level = levelFromState(state); // 0..3

  // progress + visuals
  const pct = pctOfDone(state);
  const tweenedPct = useTweenedNumber(pct);
  const t = Math.min(1, Math.max(0, tweenedPct / 100));
  const hue = t < 0.66 ? lerp(260, 210, t / 0.66) : lerp(210, 160, (t - 0.66) / 0.34);
  const ringColor = `hsl(${hue}, 85%, 60%)`;

  // shake feedback when a click is disallowed
  const [shake, setShake] = React.useState<0 | 1 | 2 | 3 | null>(null);
  const nudge = (idx: 1 | 2 | 3) => {
    setShake(idx);
    setTimeout(() => setShake(null), 420);
  };

  // unified click handler per step index (1..3)
  const handleStepClick = (idx: 1 | 2 | 3) => {
    // Forward-only unlock: can ONLY go to level+1 by clicking that exact next step
    if (idx === (level + 1)) {
      onToggle(stateFromLevel(level + 1));
      return;
    }
    // Reverse-only lock: can ONLY go to level-1 by clicking the CURRENT top level
    if (idx === level && level > 0) {
      onToggle(stateFromLevel(level - 1));
      return;
    }
    // Otherwise, disallow and shake
    nudge(idx);
  };

  return (
    <div
      className={cn(
        "relative rounded-3xl border",
        TOKENS.glassBg,
        TOKENS.glassBorder,
        "backdrop-blur-2xl p-6 md:p-8 overflow-hidden min-h-[540px] md:min-h-[560px]"
      )}
    >
      <motion.div
        initial={{ opacity: 0.16, scale: 0.98 }}
        animate={{ opacity: [0.16, 0.22, 0.16], scale: [0.98, 1, 0.98] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl"
      />

      <div className="flex items-center gap-8 md:gap-10 flex-col md:flex-row">
        {/* Progress ring */}
        <div className="relative shrink-0">
          <div className="relative h-[230px] w-[230px] transition-[filter]">
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(${ringColor} ${tweenedPct * 3.6
                  }deg, rgba(255,255,255,0.08) 0)`,
              }}
              transition={{ duration: 0.3 }}
            />
            <div className="absolute inset-[16px] rounded-full border border-white/15 bg-[rgba(255,255,255,0.05)] backdrop-blur-xl" />
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-4xl font-extrabold">{Math.round(tweenedPct)}%</div>
              <div className="text-xs mt-1 text-white/70">Setup Complete</div>
            </div>
          </div>
          <div className="absolute -top-3 -right-3">
            <OrbitChip label="Skills" value={`${state.skillsMastered}`} />
          </div>
          <div className="absolute -bottom-3 -left-3">
            <OrbitChip label="Resume" value={`${state.resumeScore}`} />
          </div>
          <div className="absolute -bottom-4 -right-4">
            <OrbitChip label="Streak" value={`${state.streakDays}d`} />
          </div>
        </div>

        {/* Content + locked steps */}
        <div className="flex-1 w-full">
          <h3 className={cn("text-lg font-semibold", TOKENS.textPrimary)}>Momentum</h3>
          <p className={cn("text-sm mt-1", TOKENS.textSecondary)}>
            Unlock modules in order. You can only backtrack in reverse.
          </p>

          {/* Make all pills equal size */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
            {/* Step 1 */}
            <motion.div
              animate={shake === 1 ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
            >
              <StepSwitch
                label="Upload résumé"
                active={level >= 1}
                onClick={() => handleStepClick(1)}
              />
            </motion.div>

            {/* Step 2 (requires step 1 to go forward; only deselectable when at level 2) */}
            <motion.div
              animate={shake === 2 ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
            >
              <StepSwitch
                label="Analyze skills"
                active={level >= 2}
                onClick={() => handleStepClick(2)}
              />
              {level < 1 && <Hint>Complete step 1 first</Hint>}
            </motion.div>

            {/* Step 3 (requires steps 1 & 2; only deselectable when at level 3) */}
            <motion.div
              animate={shake === 3 ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
            >
              <StepSwitch
                label="View courses"
                active={level >= 3}
                onClick={() => handleStepClick(3)}
              />
              {level < 2 && <Hint>Finish steps 1 &amp; 2</Hint>}
            </motion.div>
          </div>

          {/* Contextual CTAs based on level */}
          <div className="mt-5 flex flex-wrap gap-3">
            {level === 0 && (
              <PrimaryBtn href="/resume" icon={<Upload className="h-4 w-4" />}>
                Upload Now
              </PrimaryBtn>
            )}
            {level === 1 && (
              <PrimaryBtn href="/compute-gaps" icon={<Brain className="h-4 w-4" />}>
                Compute Gaps
              </PrimaryBtn>
            )}
            {level === 2 && (
              <PrimaryBtn href="/course-genie" icon={<BookOpen className="h-4 w-4" />}>
                Open Course Genie
              </PrimaryBtn>
            )}
          </div>

          {/* Gamify */}
          <div className="mt-6 grid gap-3">
            <XPBar pct={pct} />
            <AchievementsPanel pct={pct} />
          </div>

          {/* NEW: subtle footer chips to anchor the bottom */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <OrbitChip
              label="Next step"
              value={
                level === 0 ? "Upload résumé" :
                  level === 1 ? "Compute gaps" :
                    level === 2 ? "Open Course Genie" : "Apply & Reflect"
              }
            />
            <OrbitChip label="Weekly goal" value="2h learning" />
            <OrbitChip label="Target streak" value="3d" />
          </div>

        </div>
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/70">
      <Info className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

/* ───────────────── other sections ───────────────── */
function JourneyPath({ state }: { state: SetupState }) {
  const done = {
    resume: state.resumeUploaded,
    analyze: state.analyzed,
    compute: state.analyzed,
    plan: state.coursesViewed,
    practice: false,
    apply: false,
  };
  return (
    <div
      className={cn(
        "relative rounded-3xl border",
        TOKENS.glassBg,
        TOKENS.glassBorder,
        "backdrop-blur-2xl p-4 md:p-5 overflow-hidden"
      )}
    >
      <h3 className={cn("px-1 pb-2 font-semibold", TOKENS.textPrimary)}>
        Your Journey
      </h3>
      <div className="relative overflow-x-auto">
        <div className="flex items-center gap-10 md:gap-12 min-w-max px-2 py-2">
          {PATH_STEPS.map((s, i) => {
            const isDone = (done as any)[s.key] as boolean;
            const isNext =
              !isDone && Object.values(done).slice(0, i).every(Boolean);
            return (
              <div key={s.key} className="relative flex items-center">
                <Link
                  href={s.href}
                  className={cn(
                    "group relative grid place-items-center rounded-2xl px-5 py-3 border transition hover:-translate-y-[1px]",
                    isDone
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-white/12 bg-white/6"
                  )}
                >
                  <span className="text-[11px] text-white/60">{`Step ${i + 1
                    }`}</span>
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span
                    className={cn(
                      "absolute -top-2 -right-2 h-3 w-3 rounded-full",
                      isDone
                        ? "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,.8)]"
                        : isNext
                          ? "bg-indigo-400 animate-pulse"
                          : "bg-white/25"
                    )}
                  />
                </Link>
                {i < PATH_STEPS.length - 1 && (
                  <span
                    className={cn(
                      "ml-6 mr-6 h-[2px] w-16 md:w-20 self-center",
                      isDone ? "bg-amber-400/60" : "bg-white/15"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SkillPulse() {
  // stats
  const vals = SKILL_RADAR_DATA.map((d) => d.value);
  const avgRaw = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const best = SKILL_RADAR_DATA.reduce((m, d) => (d.value > m.value ? d : m));
  const weak = SKILL_RADAR_DATA.reduce((m, d) => (d.value < m.value ? d : m));
  const tweenAvg = useTweenedNumber(avgRaw);

  // palette for legend dots
  const palette = ["#818cf8", "#a78bfa", "#60a5fa", "#22d3ee", "#c084fc", "#38bdf8"];
  const dot = (c: string) => (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ background: c, boxShadow: `0 0 8px ${c}80` }}
    />
  );

  const top3 = [...SKILL_RADAR_DATA].sort((a, b) => b.value - a.value).slice(0, 3);

  return (
    <div
      className={cn(
        "relative rounded-3xl border",
        TOKENS.glassBg,
        TOKENS.glassBorder,
        "backdrop-blur-2xl p-5 overflow-hidden"
      )}
    >
      <div className="flex items-baseline justify-between">
        <h3 className={cn("font-semibold leading-none", TOKENS.textPrimary)}>Skill Pulse</h3>
        <span className="text-[11px] text-white/60 leading-none">snapshot</span>
      </div>

      {/* radar */}
      <div className="mt-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={SKILL_RADAR_DATA} outerRadius="70%">
            <PolarGrid stroke="rgba(255,255,255,0.18)" />
            <PolarAngleAxis
              dataKey="area"
              stroke="rgba(255,255,255,0.65)"
              tick={{ fontSize: 12 }}
            />
            <PolarRadiusAxis
              stroke="rgba(255,255,255,0.35)"
              tick={{ fontSize: 10 }}
              tickCount={6}
            />
            <Radar
              name="You"
              dataKey="value"
              fill="rgba(99,102,241,0.45)"
              stroke="rgba(139,92,246,0.95)"
              fillOpacity={0.6}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* aligned footer */}
      <div className="mt-4 border-t border-white/10 pt-3 space-y-3">
        {/* legend: lock height & baseline */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 leading-none">
          {SKILL_RADAR_DATA.map((d, i) => (
            <span key={d.area} className="inline-flex items-center gap-2 text-[11px] text-white/70">
              {dot(palette[i % palette.length])}
              <span className="align-middle">{d.area}</span>
            </span>
          ))}
        </div>

        {/* insight chips: equal height + centered */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: "Overall",
              value: (
                <>
                  {Math.round(tweenAvg)}
                  <span className="text-white/60 text-[10px] ml-1">/100</span>
                </>
              ),
            },
            {
              label: "Strongest",
              value: (
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">
                  {best.area}
                </span>
              ),
            },
            {
              label: "Focus Next",
              value: (
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-cyan-300">
                  {weak.area}
                </span>
              ),
            },
          ].map((c) => (
            <div
              key={c.label}
              className={cn(
                "rounded-xl border px-3 py-2 min-h-[46px]",
                "grid grid-cols-[auto_1fr] items-center gap-2",
                TOKENS.glassBg,
                TOKENS.glassBorder
              )}
            >
              <div className="text-[11px] text-white/70">{c.label}</div>
              <div className="text-sm font-semibold text-right">{c.value}</div>
            </div>
          ))}
        </div>

        {/* bars: 2-col grid for perfect label/value alignment */}
        <div className="grid gap-2">
          {top3.map((t, idx) => (
            <div key={t.area} className="grid gap-1">
              <div className="grid grid-cols-[1fr_auto] items-baseline text-[11px]">
                <span className="text-white/70">{t.area}</span>
                <span className="text-white/70">{t.value}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${t.value}%`,
                    background:
                      idx === 0
                        ? "linear-gradient(90deg,#818cf8,#a78bfa)"
                        : idx === 1
                          ? "linear-gradient(90deg,#60a5fa,#22d3ee)"
                          : "linear-gradient(90deg,#a78bfa,#38bdf8)",
                    boxShadow: "0 0 14px rgba(99,102,241,0.45)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}




function LearningLab() {
  return (
    <div
      className={cn(
        "relative rounded-3xl border",
        TOKENS.glassBg,
        TOKENS.glassBorder,
        "backdrop-blur-2xl p-4 overflow-hidden"
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className={cn("font-semibold", TOKENS.textPrimary)}>Learning Lab</h3>
        <div className="hidden md:flex gap-2">
          {["Quick Wins", "Foundations", "Projects", "Certifications", "Stretch"].map(
            (c) => (
              <span
                key={c}
                className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white/70"
              >
                {c}
              </span>
            )
          )}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="grid grid-flow-col auto-cols-[78%] md:auto-cols-[33%] gap-3 pr-2">
          {COURSES.map((c) => (
            <div
              key={c.id}
              className={cn(
                "relative rounded-2xl border p-4 transition hover:-translate-y-[2px]",
                TOKENS.glassBg,
                TOKENS.glassBorder
              )}
            >
              <div className="text-xs text-white/60">{c.bucket}</div>
              <div className="text-sm font-semibold mt-1">{c.title}</div>
              <div className="mt-3 flex gap-2">
                <MiniBtn href="/course-genie">Details</MiniBtn>
                <MiniBtn href="/course-genie" primary>
                  Add to Plan
                </MiniBtn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  const items = [
    { href: "/resume", label: "Résumé", icon: <Upload className="h-5 w-5" /> },
    { href: "/extract-skills", label: "Skills", icon: <Brain className="h-5 w-5" /> },
    { href: "/compute-gaps", label: "Gaps", icon: <Sparkles className="h-5 w-5" /> },
    { href: "/course-genie", label: "Courses", icon: <BookOpen className="h-5 w-5" /> },
    { href: "/live-jobs", label: "Jobs", icon: <Search className="h-5 w-5" /> },
    { href: "/chat", label: "Chat", icon: <MessageCircle className="h-5 w-5" /> },
  ];
  return (
    <div
      className={cn(
        "relative rounded-3xl border",
        TOKENS.glassBg,
        TOKENS.glassBorder,
        "backdrop-blur-2xl p-4 overflow-hidden"
      )}
    >
      <h3 className={cn("font-semibold mb-3", TOKENS.textPrimary)}>
        Quick Actions
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className={cn(
              "group grid place-items-center rounded-2xl border h-20",
              TOKENS.glassBg,
              TOKENS.glassBorder,
              "transition hover:-translate-y-[2px]"
            )}
          >
            <div className="grid place-items-center gap-1">
              <div className="grid place-items-center rounded-full h-9 w-9 border border-white/15 bg-white/10">
                {it.icon}
              </div>
              <div className="text-[11px] text-white/80">{it.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FocusCard() {
  return (
    <div
      className={cn(
        "relative rounded-3xl border",
        TOKENS.glassBg,
        TOKENS.glassBorder,
        "backdrop-blur-2xl p-4 overflow-hidden"
      )}
    >
      <h3 className={cn("font-semibold", TOKENS.textPrimary)}>Today’s Focus</h3>
      <p className={cn("text-sm mt-1", TOKENS.textSecondary)}>
        Strengthen SQL fundamentals (45 mins). Try 3 joins + 2 window functions.
      </p>
      <div className="mt-4 flex gap-2">
        <PrimaryBtn href="/course-genie" icon={<BookOpen className="h-4 w-4" />}>
          View Plan
        </PrimaryBtn>
        <GhostBtn href="/chat">Ask Omni Chat</GhostBtn>
      </div>
    </div>
  );
}

/* ───────────────── page ───────────────── */
export default function DashboardPage() {
  const [state, patch] = useHydratedSetup();
  const progress = pctOfDone(state);

  return (
    <div className="relative min-h-[100dvh]">
      <AuroraBackground />
      <main className="relative z-[1] mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-10 space-y-6">
        <HeaderWelcome />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MomentumCore state={state} onToggle={patch} />
          </div>
          <SkillPulse />
        </div>

        <JourneyPath state={state} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LearningLab />
          </div>
          <div className="grid gap-6">
            <QuickActions />
            <FocusCard />
          </div>
        </div>

        <div className="relative">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-white/60">
            Weekly momentum: {progress}%
          </div>
        </div>
        <div className="h-4" />
      </main>
    </div>
  );
}
