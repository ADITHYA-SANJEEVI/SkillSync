"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useSpring,
  useMotionValue,
  useAnimationControls,
} from "framer-motion";
import {
  Sparkles, ShieldCheck, BarChart3, Bot, FileCheck2, GraduationCap,
  Rocket, Check, ArrowRight, Users2, GaugeCircle, Lock, Trophy, School,
  Cpu, TerminalSquare, Zap, Award
} from "lucide-react";
import * as React from "react";
import { useMounted } from "./hooks/useMounted"; // <-- keep this single import

/* ─────────────────────────── scroll-direction (global, light) ─────────────────────────── */
/* ───────────────── Fade strongest on first pass; softer on later passes ───────────────── */
/* ───────── Fade strongest on first pass; do NOT hide on leave ───────── */
function useScrollDirection() {
  const last = useRef(0);
  const [dir, setDir] = useState<"down" | "up">("down");
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      const d = y > last.current ? "down" : "up";
      if (d !== dir && Math.abs(y - last.current) > 2) setDir(d);
      last.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dir]);
  return dir;
}




/**
 * Reveal: first viewport pass per direction is strong; subsequent passes are light.
 * Up and down are tracked separately for every instance.
 */


function Reveal({
  children,
  as = "div",
  className = "",
  delayChildren = 0,
}: {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  delayChildren?: number;
}) {
  // @ts-ignore
  const Tag = motion[as] ?? motion.div;
  const dir = useScrollDirection();
  const counts = React.useRef<{ up: number; down: number }>({ up: 0, down: 0 });
  const controls = useAnimationControls();
  const mounted = useMounted();

  const safeSet = React.useCallback(
    (v: any) => {
      if (!mounted.current) return;
      controls.set(v);
    },
    [controls, mounted]
  );

  const setHidden = (y: number, blur: number) =>
    safeSet({ opacity: 0, y, filter: `blur(${blur}px)` });

  const compute = (pass: number) => {
    const strong = pass <= 1;
    return {
      y: strong ? 28 : 10,
      blur: strong ? 6 : 2,
      dur: strong ? 0.6 : 0.28,
      stag: strong ? 0.08 : 0.03,
      ease: strong ? [0.16, 1, 0.3, 1] : [0.22, 0.9, 0.24, 1],
    };
  };

  return (
    <Tag
      className={`will-change-transform transform-gpu ${className}`}
      initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
      animate={controls}
      onViewportEnter={() => {
        counts.current[dir] += 1;
        const { dur, stag, ease } = compute(counts.current[dir]);
        controls.start({
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: dur, ease, delayChildren, staggerChildren: stag },
        });
      }}
      onViewportLeave={() => {
        const { y, blur } = compute(Math.max(2, counts.current[dir]));
        setHidden(y, blur);
      }}
      viewport={{ once: false, amount: 0.25, margin: "0px 0px -10% 0px" }}
    >
      {children}
    </Tag>
  );
}


/* ─────────────────────────── page ─────────────────────────── */
export default function Landing() {
  // Kill taskbar/hover reveal just for this page
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("no-taskbar");
    body.classList.add("no-taskbar");
    (window as any).__openTaskbar = () => { };
    (window as any).__revealSidebar = () => { };
    (window as any).__showNav = () => { };
    return () => {
      html.classList.remove("no-taskbar");
      body.classList.remove("no-taskbar");
    };
  }, []);

  // Top scroll progress
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 25, mass: 0.2 });

  return (
    <div className="relative min-h-screen text-white">
      {/* top progress bar */}
      <motion.div
        style={{ scaleX: progress }}
        className="fixed left-0 top-0 z-[60] h-[3px] w-full origin-left bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400"
      />



      <main className="mx-auto max-w-7xl px-6 pb-16">
        {/* ================= HERO ================= */}
        <section className="grid gap-10 pt-20 md:grid-cols-2 md:pt-28">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/85 backdrop-blur">
              <Sparkles className="size-3.5 text-indigo-200" />
              AI-powered career studio • glassmorphic elegance
            </div>

            <h1 className="mt-4 text-[2.8rem] leading-[1.05] font-semibold tracking-tight md:text-[3.7rem]">
              Skill<span className="bg-gradient-to-r from-indigo-300 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">Sync</span>
            </h1>

            <p className="mt-3 max-w-xl text-[1.02rem] text-white/85 md:text-[1.08rem]">
              Score résumés, visualize skills, and close gaps with guided learning — premium feel, zero clutter.
            </p>

            <ul className="mt-6 space-y-2">
              {[
                ["Transparent scoring", "Rationale with concrete edits."],
                ["Role-aware visuals", "Coverage • Density • Overlap."],
                ["Privacy-first", "Your data stays yours — erasable/exportable."],
              ].map(([a, b], i) => (
                <Reveal key={i}>
                  <li className="flex list-none items-start gap-3 text-[0.98rem]">
                    <Check className="mt-0.5 size-5 text-indigo-200" />
                    <span>
                      <span className="font-medium">{a}</span> — {b}
                    </span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </Reveal>

          {/* Parallax/tilt visual */}
          <Reveal>
            <TiltCard>
              <div className="rounded-[18px] border border-white/12 bg-white/5 p-2 backdrop-blur">
                <FallbackImg
                  alt="Team collaborating around laptops"
                  className="h-[320px] w-full rounded-xl object-cover md:h-[380px]"
                  srcs={[
                    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=3840&q=80&fm=jpg",
                    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=3840&q=80&fm=jpg",
                    "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=3840&q=80&fm=jpg",
                  ]}
                />
              </div>
            </TiltCard>
          </Reveal>
        </section>

        {/* thin color ribbon (thinner per your note) */}
        <Reveal>
          <div
            className="my-12 h-3 w-full rounded-full md:h-3.5"
            style={{
              background:
                "linear-gradient(90deg, rgba(99,102,241,0.35), rgba(139,92,246,0.32), rgba(217,70,239,0.30))",
              filter: "blur(0.5px)",
            }}
          />
        </Reveal>

        {/* ================= VALUE PILLARS ================= */}
        <section className="grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Section-wise résumé feedback",
              desc: "Crystal-clear scores with rationale, risks, strengths, and quick wins.",
              icon: <FileCheck2 className="size-5 text-indigo-200" />,
            },
            {
              title: "Coverage • Density • Overlap",
              desc: "Skill graphs quantify where you stand against role archetypes and JDs.",
              icon: <BarChart3 className="size-5 text-indigo-200" />,
            },
            {
              title: "Guided learning plans",
              desc: "Tracks that move you: Quick Wins → Foundations → Projects → Certs → Stretch.",
              icon: <GraduationCap className="size-5 text-indigo-200" />,
            },
          ].map((b, i) => (
            <Reveal key={i}>
              <GlowCard>
                <h3 className="flex items-center gap-2 text-[1.15rem] font-semibold">
                  {b.icon}
                  {b.title}
                </h3>
                <p className="mt-2 text-[0.96rem] text-white/80">{b.desc}</p>
              </GlowCard>
            </Reveal>
          ))}
        </section>

        {/* ================= STORY BEATS ================= */}
        <StoryBeat
          dir="left"
          eyebrow="01 — Understand your résumé"
          title="Section-wise scoring that explains itself"
          bullets={[
            "Structure & section detection",
            "Clear strengths / risks / quick wins",
            "Edits you can actually apply",
          ]}
          icon={<FileCheck2 className="size-5 text-indigo-200" />}
          images={[
            "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=3840&q=80&fm=jpg",
            "https://images.unsplash.com/photo-1551281044-8e8f1e95a8fd?auto=format&fit=crop&w=3840&q=80&fm=jpg",
          ]}
        />

        <StoryBeat
          dir="right"
          eyebrow="02 — Map your skills"
          title="Coverage • Density • Overlap"
          bullets={[
            "Quantified view vs. role archetypes",
            "What helps interviews, surfaced",
            "Gaps that turn into a plan",
          ]}
          icon={<BarChart3 className="size-5 text-indigo-200" />}
          images={[
            "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=3840&q=80&fm=jpg",
            "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=3840&q=80&fm=jpg",
          ]}
        />

        <StoryBeat
          dir="left"
          eyebrow="03 — Focus your learning"
          title="Guided plans that respect your bandwidth"
          bullets={[
            "Quick Wins → Foundations → Projects",
            "Certifications & Stretch when it’s time",
            "Realistic time budgets",
          ]}
          icon={<GraduationCap className="size-5 text-indigo-200" />}
          images={[
            "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=3840&q=80&fm=jpg",
            "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=3840&q=80&fm=jpg",
          ]}
        />

        {/* ================= NEW: PRESS & BADGES ================= */}
        <Reveal className="mt-16">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex flex-wrap items-center gap-6">
              <span className="inline-flex items-center gap-2 text-indigo-200">
                <Award className="size-5" /> Featured by
              </span>
              <Logo text="DevDaily" />
              <Logo text="AI Today" />
              <Logo text="The Career Lab" />
              <Logo text="Stack Weekly" />
            </div>
          </div>
        </Reveal>

        {/* ================= PRINCIPLES (uniform tiles) ================= */}
        <section className="mt-16 grid gap-6 md:grid-cols-3 [grid-auto-rows:1fr]">
          {[
            {
              icon: <Trophy className="size-5 text-indigo-200" />,
              h: "Clarity over hype",
              p: "Every chart, score, and suggestion reduces ambiguity and increases forward momentum.",
            },
            {
              icon: <Lock className="size-5 text-indigo-200" />,
              h: "Privacy by default",
              p: "Local-first mindset and erasable datasets. Export your data or delete it anytime.",
            },
            {
              icon: <School className="size-5 text-indigo-200" />,
              h: "Learning you can stick to",
              p: "Plans that respect your week. Small wins → sustainable habits → real outcomes.",
            },
          ].map((x, i) => (
            <Reveal key={i}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur flex flex-col">
                <div className="mb-2 inline-flex items-center gap-2 text-indigo-200">
                  {x.icon}<span className="font-medium">{x.h}</span>
                </div>
                <p className="text-[0.95rem] text-white/80 leading-relaxed mt-1">{x.p}</p>
                {/* spacer to keep equal heights even if lines differ */}
                <div className="mt-auto" />
              </div>
            </Reveal>
          ))}
        </section>


        {/* ================= TECH STACK PEEK (uniform tiles) ================= */}
        <Reveal className="mt-16">
          <div className="grid gap-6 md:grid-cols-3 [grid-auto-rows:1fr]">
            {[
              { i: <Cpu className="size-5 text-indigo-200" />, h: "FastAPI + Next.js", d: "Typed APIs and a responsive, streaming UI." },
              { i: <TerminalSquare className="size-5 text-indigo-200" />, h: "LLM + heuristics", d: "Model reasoning blended with deterministic guards." },
              { i: <Zap className="size-5 text-indigo-200" />, h: "Responsive motion", d: "Framer Motion: smooth reveals, subtle parallax, no jank." },
            ].map((it, idx) => (
              <div key={idx} className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur flex flex-col">
                <div className="mb-2 inline-flex items-center gap-2 text-indigo-200">
                  {it.i}<span className="font-medium">{it.h}</span>
                </div>
                <p className="text-[0.95rem] text-white/80 leading-relaxed mt-1">{it.d}</p>
                <div className="mt-auto" />
              </div>
            ))}
          </div>
        </Reveal>

        {/* ================= METRICS / SOCIAL PROOF ================= */}
        <section className="mt-16 grid gap-6 md:grid-cols-[1.25fr_1fr]">
          <Reveal>
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div
                className="pointer-events-none absolute -inset-0.5 rotate-6 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(70% 50% at 0% 0%, rgba(129,140,248,0.25), transparent 60%), radial-gradient(60% 50% at 100% 0%, rgba(167,139,250,0.22), transparent 60%)",
                }}
              />
              <div className="relative z-10">
                <h3 className="text-[1.25rem] font-semibold">Why candidates love SkillSync</h3>
                <p className="mt-2 max-w-prose text-[0.95rem] text-white/80">
                  We turn vague advice into concrete, measurable steps — and we make it feel good so you keep going.
                </p>
                <div className="mt-6 grid gap-6 sm:grid-cols-3">
                  <Stat number="92%" label="see clearer edits in minutes" />
                  <Stat number="3×" label="faster from upload → plan" />
                  <Stat number="India-first" label="tuned to local roles & trends" />
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <ul className="grid content-start gap-3">
              {[
                ["Private by design", <ShieldCheck key="i" className="size-4 text-indigo-200" />],
                ["Transparent metrics", <GaugeCircle key="g" className="size-4 text-indigo-200" />],
                ["Human-centred AI", <Bot key="b" className="size-4 text-indigo-200" />],
              ].map(([t, ic], i) => (
                <li
                  key={i}
                  className="group rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[0.95rem]">{t}</span>
                    {ic as any}
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* ================= NEW: COMPARISON (friendly) ================= */}
        <Reveal className="mt-16">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="text-[1.2rem] font-semibold">Why not just any résumé tool?</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h4 className="font-medium">Generic tool</h4>
                <ul className="mt-2 space-y-1 text-white/80 text-[0.95rem]">
                  <li>• One overall score</li>
                  <li>• Vague tips</li>
                  <li>• Little sense of progress</li>
                </ul>
              </div>
              <div className="rounded-xl border border-indigo-300/20 bg-gradient-to-tr from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10 p-4">
                <h4 className="font-medium">SkillSync</h4>
                <ul className="mt-2 space-y-1 text-white/90 text-[0.95rem]">
                  <li>• Section-wise scoring + rationale</li>
                  <li>• Coverage • Density • Overlap visuals</li>
                  <li>• Guided plan you can follow</li>
                </ul>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ================= NEW: TESTIMONIALS MICRO-CARDS ================= */}
        <Reveal className="mt-16">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["“Finally, feedback I can act on.”", "— Shreya, student"],
              ["“The skill graphs made interviews easier.”", "— Asmi, student"],
              ["“Plans fit my week. No burnout.”", "— Adithya, student"],
            ].map(([q, by], i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <p className="text-[0.98rem]">{q}</p>
                <p className="mt-2 text-[0.9rem] text-white/70">{by}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ================= SHOWCASE ================= */}
        <Reveal className="mt-16">
          <h2 className="text-left text-[1.35rem] font-semibold">Looks sleek. Works hard.</h2>
          <p className="mt-2 max-w-3xl text-[0.95rem] text-white/80">
            A premium studio with glass surfaces, soft shadows, and responsive motion.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {[
              ["Résumé Score — section insights", "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=3840&q=80&fm=jpg"],
              ["Skill Graphs — coverage & density", "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=3840&q=80&fm=jpg"],
              ["Compute Gaps — JD vs Candidate", "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=3840&q=80&fm=jpg"],
              ["Course Genie — bucketed plan", "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=3840&q=80&fm=jpg"],
            ].map(([title, src], i) => (
              <figure key={i} className="group">
                <HoverCard tight>
                  <FallbackImg alt={title as string} className="h-56 w-full rounded-xl object-cover" srcs={[src as string]} />
                  <figcaption className="mt-3 px-1 text-[0.95rem] text-white/85">{title}</figcaption>
                </HoverCard>
              </figure>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/55">Images: Unsplash (free to use). Swap with your screenshots anytime.</p>
        </Reveal>

        {/* ================= SECURITY PLEDGE ================= */}
        <Reveal className="mt-16">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="mb-2 inline-flex items-center gap-2 text-indigo-200">
              <ShieldCheck className="size-5" /> Security & Privacy Pledge
            </div>
            <p className="max-w-4xl text-[0.95rem] text-white/80">
              Your documents remain yours. We don’t sell data, and you can export or erase it whenever you like.
              We use least-privilege access, server-side redaction where possible, and log only the minimum needed for reliability.
            </p>
          </div>
        </Reveal>

        {/* ================= FINAL CTA ================= */}
        <Reveal className="mt-12 mb-6 no-cv">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-500/25 via-violet-500/25 to-fuchsia-500/25 p-6 md:p-8 backdrop-blur">
            <div className="grid items-center gap-6 md:grid-cols-[1.25fr_1fr]">
              <div>
                <h2 className="text-[1.45rem] font-semibold">Start your SkillSync journey</h2>
                <p className="mt-2 max-w-prose text-[0.98rem] text-white/85">
                  Log in to unlock résumé scoring, skill maps, and guided learning — all in one elegant flow.
                </p>
              </div>
              <div className="md:text-right">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-white shadow-lg shadow-indigo-900/30 transition hover:brightness-110"
                >
                  Check it Out
                  <Rocket className="size-4" />
                </Link>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-white/65">
              © {new Date().getFullYear()} SkillSync — crafted with care.
            </p>
          </div>
        </Reveal>

      </main>

      {/* page-scoped global CSS ( + taskbar kill ) */}
      <style jsx global>{`
      /* prevent trailing reserved space at the end of page */
section:last-of-type { content-visibility: visible !important; contain-intrinsic-size: auto !important; }
/* manual opt-out helper */
.no-cv { content-visibility: visible !important; contain-intrinsic-size: auto !important; }
  .gpu { will-change: transform; transform: translate3d(0,0,0); }
  @keyframes driftX { from { transform: translate3d(-4%,0,0); } to { transform: translate3d(4%,0,0); } }
  @keyframes driftXSlow { from { transform: translate3d(4%,0,0); } to { transform: translate3d(-4%,0,0); } }
  .animate-drift-x { animation: driftX 40s linear infinite alternate; }
  .animate-drift-x-slow { animation: driftXSlow 65s linear infinite alternate; }
  @keyframes pulseLine { 0% { opacity: .35 } 50% { opacity: .6 } 100% { opacity: .35 } }
  .animate-pulse-line { animation: pulseLine 5s ease-in-out infinite; }

  /* Perf: avoid layout work for off-screen sections */
  section, .tile-grid { content-visibility: auto; contain-intrinsic-size: 800px; }
  hyphenate {
      hyphens: auto;
      overflow-wrap: anywhere;
      }
      
        .no-taskbar [data-taskbar], .no-taskbar .app-taskbar, .no-taskbar #taskbar, .no-taskbar .taskbar,
        .no-taskbar [data-taskbar-trigger], .no-taskbar .taskbar-trigger, .no-taskbar #taskbar-trigger,
        .no-taskbar .hover-reveal-left, .no-taskbar .sidebar-hover-zone {
          display: none !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
`}</style>

    </div>
  );
}

/* ───────────────── visuals & atoms ───────────────── */

/* ───────────────── Matchy moving background (GPU-friendly) ───────────────── */
function NeuralAuroraBG() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* soft colour field */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_15%_-10%,rgba(99,102,241,0.38),transparent_60%),radial-gradient(1100px_650px_at_85%_-5%,rgba(168,85,247,0.33),transparent_60%),radial-gradient(900px_550px_at_50%_120%,rgba(236,72,153,0.20),transparent_60%)]" />
      {/* drifting ribbons */}
      <div className="gpu absolute left-[-10%] top-[18%] h-64 w-[120%] rounded-full bg-gradient-to-r from-indigo-400/28 via-violet-400/24 to-fuchsia-400/22 blur-3xl animate-drift-x" />
      <div className="gpu absolute left-[-15%] top-[60%] h-56 w-[130%] rounded-full bg-gradient-to-r from-fuchsia-400/20 via-violet-400/22 to-indigo-400/24 blur-3xl animate-drift-x-slow" />
      {/* faint sparkline */}
      <div className="gpu absolute inset-x-0 top-24 mx-auto h-[2px] w-[86%] rounded-full bg-gradient-to-r from-indigo-300/25 via-violet-300/25 to-fuchsia-300/25 animate-pulse-line" />
      {/* gentle grain */}
      <div className="absolute inset-0 opacity-[0.06] [background-image:url('data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'160\\' height=\\'160\\'><filter id=\\'n\\'><feTurbulence type=\\'fractalNoise\\' baseFrequency=\\'0.8\\' numOctaves=\\'4\\' stitchTiles=\\'stitch\\'/></filter><rect width=\\'100%\\' height=\\'100%\\' filter=\\'url(%23n)\\' opacity=\\'0.25\\'/></svg>')]" />
    </div>
  );
}


function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const px = (x / r.width) * 2 - 1;
    const py = (y / r.height) * 2 - 1;
    rx.set(py * 10);
    ry.set(px * -10);
  };
  const onLeave = () => { rx.set(0); ry.set(0); };
  return (
    <motion.div
      ref={ref}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="transition-transform duration-200"
    >
      {children}
    </motion.div>
  );
}

function HoverCard({ children, tight = false }: { children: React.ReactNode; tight?: boolean }) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 ${tight ? "p-3" : "p-0"} backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20`}>
      <div className="pointer-events-none absolute -inset-0.5 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(70% 50% at 0% 0%, rgba(129,140,248,0.22), transparent 60%), radial-gradient(55% 45% at 100% 0%, rgba(167,139,250,0.20), transparent 60%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function GlowCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20">
      <div className="pointer-events-none absolute -inset-0.5 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(80% 60% at 20% 0%, rgba(129,140,248,0.26), transparent 60%), radial-gradient(60% 50% at 100% 0%, rgba(167,139,250,0.24), transparent 60%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function FallbackImg({ srcs, alt, className }: { srcs: string[]; alt: string; className?: string }) {
  const [idx, setIdx] = useState(0);
  const tune = (u: string) =>
    u.includes("images.unsplash.com")
      ? `${u}${u.includes("?") ? "&" : "?"}w=1920&q=75&auto=format&fit=crop`
      : u;
  const src = tune(srcs[Math.min(idx, srcs.length - 1)] || srcs[0]);
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      decoding="async"
      loading={idx === 0 ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      onError={() => setIdx((i) => Math.min(i + 1, srcs.length - 1))}
    />
  );
}


function StoryBeat({
  dir,
  eyebrow,
  title,
  bullets,
  icon,
  images,
}: {
  dir: "left" | "right";
  eyebrow: string;
  title: string;
  bullets: string[];
  icon: React.ReactNode;
  images: string[];
}) {
  const left = dir === "left";
  return (
    <section className={`mt-16 grid items-center gap-8 md:grid-cols-2 ${left ? "" : "md:[&>*:first-child]:order-2"}`}>
      <Reveal>
        <HoverCard tight>
          <div className="rounded-[18px] border border-white/12 bg-white/5 p-2 backdrop-blur">
            <FallbackImg alt={title} className="h-64 w-full rounded-xl object-cover md:h-80" srcs={images} />
          </div>
        </HoverCard>
      </Reveal>
      <Reveal>
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[0.9rem] text-indigo-200/90">
            {icon}
            <span>{eyebrow}</span>
          </div>
          <h3 className="text-[1.9rem] font-semibold leading-tight md:text-[2.15rem]">{title}</h3>
          <ul className="mt-4 space-y-2 text-[1rem] text-white/85">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3">
                <ArrowRight className="mt-0.5 size-4 text-indigo-200" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-[1.9rem] font-semibold">{number}</div>
      <div className="mt-1 text-[0.85rem] text-white/80">{label}</div>
    </div>
  );
}

function Logo({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80 backdrop-blur">
      {text}
    </span>
  );
}
