"use client";
import { useEffect, useRef, useState } from "react";
import {
  getLiveJobs,
  type FeedResponse,
  type JobCard,
  type ModeFilter,
} from "@/lib/apiClient";

/* ───────────────────────────── Config ───────────────────────────── */
const AUTO_LOAD = false;
const CHENNAI: [number, number] = [13.0827, 80.2707];

/* ───────────────────────────── Theme tokens ───────────────────────────── */
const glassBG = "var(--glass-bg, rgba(255,255,255,0.06))";
const glassBorder = "var(--glass-border, rgba(255,255,255,0.14))";
const textMain = "var(--foreground, #eaeaf2)";
const textDim = "var(--muted-foreground, #b7b7c3)";
const brand = "var(--brand, #a78bfa)";
const brandAlt = "var(--brand-alt, #7c3aed)";
const layoutPad = 24;

/* ───────────────────────────── Layout styles (visual only) ───────────────────────────── */
const pageWrap: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 20,
  padding: `${layoutPad}px`,
  maxWidth: 1320,
  margin: "0 auto",
};
const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};
const h1S: React.CSSProperties = {
  fontSize: 44,
  fontWeight: 900,
  lineHeight: 1.05,
  letterSpacing: -0.5,
  // gradient text like your Skill Analysis screenshot
  backgroundImage:
    "linear-gradient(90deg, rgba(164,183,255,0.95), rgba(196,181,253,0.95))",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};
const helperPill: React.CSSProperties = {
  alignSelf: "flex-start",
  color: textDim,
  fontSize: 12,
  background: glassBG,
  padding: "10px 12px",
  borderRadius: 12,
border: "1px solid " + glassBorder,
  backdropFilter: "blur(12px)",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02), 0 10px 30px rgba(0,0,0,0.25)",
};
const card: React.CSSProperties = {
  background: glassBG,
border: "1px solid " + glassBorder,
  borderRadius: 18,
  padding: 12,
  color: textMain,
  backdropFilter: "blur(12px)",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02), 0 18px 50px rgba(0,0,0,0.35)",
};
const labelS: React.CSSProperties = { fontSize: 13, color: textDim, fontWeight: 700, letterSpacing: 0.2 };
const inputS: React.CSSProperties = {
  padding: "10px 12px",
border: "1px solid " + glassBorder,
  borderRadius: 12,
  background: "rgba(8,10,18,0.45)",
  color: textMain,
  fontSize: 14,
  outline: "none",
  boxShadow: "0 4px 16px rgba(0,0,0,0.25) inset",
};
const selectS: React.CSSProperties = {
  ...inputS,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  paddingRight: 34,
  background:
    `${(inputS as any).background || "rgba(8,10,18,0.45)"} ` +
    `no-repeat right 10px center / 12px 12px`,
  backgroundImage:
    `url("data:image/svg+xml;utf8,` +
    `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'>` +
    `<path fill='%23ffffff' fill-opacity='0.7' d='M7 10l5 5 5-5z'/></svg>")`,
  cursor: "pointer",
};
const btnBase: React.CSSProperties = {
  padding: "10px 14px",
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: 12,
  background: "rgba(0,0,0,0.25)",
  color: textMain,
  cursor: "pointer",
  fontWeight: 800,
  letterSpacing: 0.2,
  transition: "transform .15s ease, box-shadow .2s ease, background .2s ease",
};
const btn: React.CSSProperties = {
  ...btnBase,
  borderColor: glassBorder,
  boxShadow: "0 0 0 0 rgba(124,58,237,0)",
};
const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(90deg, rgba(167,139,250,.22), rgba(124,58,237,.22))",
  borderColor: brand,
  boxShadow: "0 10px 30px rgba(124,58,237,.18)",
};
const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: "rgba(255,99,132,0.12)",
  borderColor: "rgba(255,99,132,0.5)",
  color: "#ffd1d7",
};
const gridAfterSearch: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.12fr 1fr",
  gap: 18,
  alignItems: "start",
};
const mapShell: React.CSSProperties = { ...card, padding: 0, overflow: "hidden" };
const mapHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  borderBottom: `1px solid ${glassBorder}`,
  color: textDim,
};
const mapCanvasBase: React.CSSProperties = {
  background:
    "radial-gradient(1200px 320px at 20% 0%, rgba(63,110,255,0.15), transparent 60%), radial-gradient(900px 280px at 80% 0%, rgba(155,52,239,0.15), transparent 60%), #0b1020",
};
const listPanel: React.CSSProperties = {
  ...card,
  maxHeight: 460,
  overflow: "auto",
  paddingTop: 6,
  marginTop: 12, // small gap below the map
};
const listStatRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  margin: "0 6px 10px",
  color: textDim,
  fontSize: 13,
};
const listCard = {
  background: "rgba(255,255,255,0.03)",
border: "1px solid " + glassBorder,
  borderRadius: 14,
  padding: 12,
  cursor: "pointer",
  marginBottom: 8,
  transition: "transform .15s ease, box-shadow .2s ease, border-color .2s ease",
} as const;
const titleS: React.CSSProperties = { fontWeight: 900, color: textMain, fontSize: 16, marginBottom: 6 };
const metaRow: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", color: textDim, fontSize: 13 };
const detailsPanel: React.CSSProperties = { ...card };
const smTable: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 8 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "1px solid " + glassBorder, color: textDim, width: 120 };
const td: React.CSSProperties = { padding: "8px 6px", borderBottom: `1px solid rgba(255,255,255,0.06)`, color: textMain };
const heroWrap: React.CSSProperties = {
  position: "relative",
  height: 520,
  borderRadius: 18,
  overflow: "hidden",
border: "1px solid " + glassBorder,
  background:
    "radial-gradient(1000px 360px at 20% 0%, rgba(63,110,255,0.15), transparent 60%), radial-gradient(800px 320px at 80% 0%, rgba(155,52,239,0.15), transparent 60%), #0b1020",
};
const heroMapLayer: React.CSSProperties = { position: "absolute", inset: 0, zIndex: 0, pointerEvents: "auto" };
const heroFilterCard: React.CSSProperties = {
  position: "absolute",
  left: "50%", top: "50%", transform: "translate(-50%,-50%)",
  width: 740, maxWidth: "92vw",
  background: glassBG, border: "1px solid " + glassBorder, borderRadius: 18, padding: 16,
  backdropFilter: "blur(14px)", boxShadow: "0 10px 40px rgba(0,0,0,0.35)", zIndex: 1,
};
const stickyBar: React.CSSProperties = { ...card, position: "relative", zIndex: 5 };

/* ───────────────────────────── Map-pin styles (classic red, static) ───────────────────────────── */
const PIN_CORE = "#ef4444";
const PIN_RING = "rgba(239,68,68,0.28)";
const pinCss = `
.leaflet-marker-icon.pin-red .dot{
  width:12px;height:12px;border-radius:50%;
  background:${PIN_CORE};
  box-shadow:0 0 0 2px ${PIN_RING};
}
`;

/* ───────────────────────────── Loader keyframes ───────────────────────────── */
const loaderCSS = `@keyframes spin360 { to { transform: rotate(360deg); } }`;

/* ───────────────────────────── Tips CSS ───────────────────────────── */
const tipsCSS = `@keyframes tipFadeIn { from { opacity: 0; transform: translateY(8px) scale(.985);} to { opacity: 1; transform: translateY(0) scale(1);} }
.tips-fade { animation: tipFadeIn .45s ease; }

@keyframes shineSweep {
  0%   { transform: translateX(-130%); }
  65%  { transform: translateX(130%);  }
  100% { transform: translateX(130%);  }
}
.tip-line {
  position: relative;
  overflow: hidden;
}
.tip-line::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.12) 35%, rgba(255,255,255,0) 70%);
  transform: translateX(-130%);
  animation: shineSweep 5.5s ease-in-out infinite;
  pointer-events: none;
}

"@

# 2) tipsCard style object
 = 'const\s+tipsCard\s*:\s*React\.CSSProperties\s*=\s*\{[\s\S]*?\}\s*;'
 = @"
const tipsCard: React.CSSProperties = {
  marginTop: 16,
  padding: 18,
  borderRadius: 16,
border: "1px solid " + glassBorder,
  background: glassBG,
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02), 0 14px 34px rgba(0,0,0,0.33)",
  minHeight: 520,
  display: "flex",
  flexDirection: "column",
};`;

/* ───────────────────────────── Helpers ───────────────────────────── */
const CITY_CENTER: Record<string, [number, number]> = {
  chennai: [13.0827, 80.2707],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  mumbai: [19.076, 72.8777],
  delhi: [28.6139, 77.209],
  hyderabad: [17.385, 78.4867],
  pune: [18.5204, 73.8567],
};
function pickLatLon(j: JobCard): [number, number] | null {
  const lat = (j as any).location_lat ?? (j as any).lat;
  const lon = (j as any).location_lon ?? (j as any).lon;
  if (typeof lat === "number" && typeof lon === "number") return [lat, lon];
  const key = (j.location_city || j.location_region || "").toLowerCase();
  return CITY_CENTER[key] ?? null;
}
async function geocode(q: string): Promise<[number, number] | null> {
  try {
    const url = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(q);
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const j = await res.json();
    if (j?.[0]?.lat && j?.[0]?.lon) return [parseFloat(j[0].lat), parseFloat(j[0].lon)];
  } catch {}
  return null;
}

/* ───────────────────────────── Loader Overlay ───────────────────────────── */
function LoaderOverlay({ open, onCancel }: { open: boolean; onCancel: () => void; }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const backdrop: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 30, // below your taskbar (40s)
    background:
      "radial-gradient(1200px 400px at 20% 0%, rgba(63,110,255,0.14), transparent 60%), radial-gradient(900px 300px at 80% 0%, rgba(155,52,239,0.14), transparent 60%), rgba(5,8,15,0.55)",
    backdropFilter: "blur(8px) saturate(1.1)",
    WebkitBackdropFilter: "blur(8px) saturate(1.1)",
    display: "grid",
    placeItems: "center",
    pointerEvents: "auto",
  };
  const modal: React.CSSProperties = {
    width: 480, maxWidth: "92vw",
    background: glassBG, border: "1px solid " + glassBorder, borderRadius: 20, padding: 20,
    boxShadow: "0 18px 60px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.02)",
  };
  const ring: React.CSSProperties = {
    width: 120, height: 120, borderRadius: "50%",
    border: "6px solid rgba(167,139,250,.18)", borderTopColor: "rgba(124,58,237,.9)",
    animation: "spin360 1.1s linear infinite", boxShadow: "0 0 30px rgba(124,58,237,0.35)",
    margin: "10px auto 0",
  };

  return (
    <div style={backdrop} role="alertdialog" aria-live="assertive" aria-busy="true" aria-label="Loading">
      <div style={modal}>
        <div style={{ color: textDim, fontSize: 13, display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div>Fetching live jobs…</div>
          <div style={{ opacity: 0.7 }}>Press <b>Esc</b> to cancel</div>
        </div>
        <div style={{ display: "grid", placeItems: "center", paddingBottom: 6 }}>
          <div style={ring} />
          <div style={{ color: textDim, fontSize: 12, marginTop: 12 }}>
            Smoothing coordinates • Preparing pins
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={onCancel} style={{ ...btnDanger, padding: "10px 16px", borderRadius: 12 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Confirm Modal ───────────────────────────── */
function ConfirmModal({
  open, title, body, confirmText = "Confirm", cancelText = "Cancel", onClose, onConfirm,
}: {
  open: boolean; title: string; body: string; confirmText?: string; cancelText?: string;
  onClose: () => void; onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "Enter") onConfirm(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onConfirm]);

  if (!open) return null;

  const backdrop: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 31, // above loader, below taskbar
    background: "linear-gradient(180deg, rgba(10,15,26,0.70), rgba(10,15,26,0.55))",
    backdropFilter: "blur(10px) saturate(1.05)", WebkitBackdropFilter: "blur(10px) saturate(1.05)",
    display: "grid", placeItems: "center",
  };
  const sheet: React.CSSProperties = {
    width: 520, maxWidth: "92vw", background: glassBG, border: "1px solid " + glassBorder, borderRadius: 18, padding: 18,
    boxShadow: "0 18px 60px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 40px rgba(124,58,237,0.18)",
  };
  const head: React.CSSProperties = { fontSize: 16, fontWeight: 900, color: textMain, marginBottom: 8 };
  const bodyS: React.CSSProperties = { color: textDim, fontSize: 14 };
  const row: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 };

  return (
    <div style={backdrop} role="dialog" aria-modal="true" aria-label={title}>
      <div style={sheet}>
        <div style={head}>{title}</div>
        <div style={bodyS}>{body}</div>
        <div style={row}>
          <button style={btn} onClick={onClose}>{cancelText}</button>
          <button style={btnPrimary} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Tips (fills right-bottom space) ───────────────────────────── */
const tipsCard: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 16,
  border: "1px solid " + glassBorder,
  background: glassBG,
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02), 0 10px 28px rgba(0,0,0,0.28)",
};
const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid " + glassBorder,
  background: "rgba(18,22,34,.55)",
  color: textMain,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.2,
  boxShadow: "0 6px 18px rgba(0,0,0,0.25)"
};
const tipLine: React.CSSProperties = {
  fontSize: 15,
  color: textMain,
  opacity: 0.95,
  lineHeight: 1.55,
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid " + glassBorder,
  background: "rgba(255,255,255,0.03)",
};
type TipBucket = { name: string; items: string[] };
const TIP_BUCKETS: TipBucket[] = [
  {
    name: "Interview",
    items: [
      "Quantify impact: “reduced API p95 from 820→210ms” beats generic bullets.",
      "Bring 1–2 failure stories; emphasize diagnosis → fix → measurable outcome.",
      "For light system design, cover traffic, storage, scaling, and failure modes.",
    ],
  },
  {
    name: "Company",
    items: [
      "Skim latest press/blogs to infer product direction & hiring intent.",
      "Glassdoor is noisy; triangulate with LinkedIn headcount and funding news.",
      "Engineering blog cadence hints at documentation culture & tech depth.",
    ],
  },
  {
    name: "Application",
    items: [
      "Mirror keywords from JD in top bullets to pass ATS.",
      "1-page PDF with links > multi-page CV; recruiters skim fast.",
      "Attach a project link that matches the JD’s stack for instant relevance.",
    ],
  },
];
function TipsTicker() {
  const [bucketIdx, setBucketIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setItemIdx((i) => {
        const items = TIP_BUCKETS[bucketIdx].items;
        if (i + 1 < items.length) return i + 1;
        setBucketIdx((b) => (b + 1) % TIP_BUCKETS.length);
        return 0;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [bucketIdx]);

  const bucket = TIP_BUCKETS[bucketIdx];

  return (
    <div style={tipsCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={pill}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(124,58,237,.9)" }} />
          <span>{bucket.name}</span>
        </div>
        <div style={{ fontSize: 12, color: textDim }}>Auto-cycling tips • 4s</div>
      </div>
      <div className="tips-fade" style={tipLine}>
        {bucket.items[itemIdx]}
      </div>
    </div>
  );
}

/* ───────────────────────────── Component ───────────────────────────── */
export default function LiveJobsPage() {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState<ModeFilter>("any");
  const [internship, setInternship] = useState(false);
  const [minSalary, setMinSalary] = useState("");
  const [enrich, setEnrich] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 15;

  const [resp, setResp] = useState<FeedResponse | null>(null);
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [selected, setSelected] = useState<JobCard | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(AUTO_LOAD);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [leafletReady, setLeafletReady] = useState(false);

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const heroMapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);
  const markerByIdRef = useRef<Record<string, any>>({});
  const lastTooltipRef = useRef<any | null>(null);
  const didFitRef = useRef(false);
  const currentTargetRef = useRef<[number, number] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const heroFlyTimer = useRef<number | null>(null);

  /* CSS injection: Leaflet + pin + loader + tips */
  useEffect(() => {
    const id = "leaflet-css";
    const existing = document.getElementById(id) as HTMLLinkElement | null;
    if (existing) {
      setLeafletReady(true);
    } else {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.onload = () => setLeafletReady(true);
      document.head.appendChild(link);
    }
  }, []);
  useEffect(() => {
    const pinId = "livejobs-pin-red-css";
    if (!document.getElementById(pinId)) {
      const s = document.createElement("style");
      s.id = pinId; s.textContent = pinCss;
      document.head.appendChild(s);
    }
    const lid = "livejobs-loader-css";
    if (!document.getElementById(lid)) {
      const s2 = document.createElement("style");
      s2.id = lid; s2.textContent = loaderCSS;
      document.head.appendChild(s2);
    }
    const tid = "livejobs-tips-css";
    if (!document.getElementById(tid)) {
      const s3 = document.createElement("style");
      s3.id = tid; s3.textContent = tipsCSS;
      document.head.appendChild(s3);
    }
  }, []);

  const createMap = async (host: HTMLDivElement) => {
    const { default: L } = await import("leaflet");
    const INDIA_BOUNDS = L.latLngBounds([6.5546079, 68.1113787], [35.6745457, 97.395561]);
    const map = L.map(host, {
      center: CHENNAI,
      zoom: 11,
      zoomControl: true,
      maxBounds: INDIA_BOUNDS,
      maxBoundsViscosity: 0.8,
      worldCopyJump: false,
      minZoom: 4,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    })
      .on("load", () => setTimeout(() => map.invalidateSize(), 0))
      .addTo(map);
    setTimeout(() => map.invalidateSize(), 50);
    return map;
  };

  useEffect(() => {
    if (!leafletReady) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    const host = hasSearched ? mapElRef.current : heroMapRef.current;
    if (!host) return;
    let cancelled = false;
    (async () => {
      const m = await createMap(host);
      if (cancelled) { m.remove(); return; }
      mapRef.current = m;
      didFitRef.current = false;
    })();
    return () => { cancelled = true; };
  }, [hasSearched, leafletReady]);

  // Rebuild markers (static red pins)
  useEffect(() => {
    (async () => {
      if (!mapRef.current) return;
      const { default: L } = await import("leaflet");
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      markerByIdRef.current = {};
      lastTooltipRef.current = null;
      if (!jobs.length) return;

      const bounds = L.latLngBounds([]);
      const icon = L.divIcon({
        className: "pin-red",
        html: `<div class="dot"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });

      jobs.forEach(j => {
        const pt = pickLatLon(j);
        if (!pt) return;
        const mk = L.marker(pt, { icon }).addTo(mapRef.current);
        const label = `<b>${(j.title || "Role").replace(/</g, "&lt;")}</b><br/>${[j.company, j.location_city].filter(Boolean).join(" · ")}`;
        mk.bindTooltip(label, { direction: "top", opacity: 0.95 });
        markersRef.current.push(mk);
        markerByIdRef.current[j.id] = mk;
        bounds.extend(pt);
      });

      if (bounds.isValid() && !didFitRef.current) {
        didFitRef.current = true;
        mapRef.current.fitBounds(bounds.pad(0.25), { animate: true });
      }
    })();
  }, [jobs]);

  // Selection: smooth fly & single tooltip
  useEffect(() => {
    if (!mapRef.current || !selected) return;
    const pt = pickLatLon(selected);
    if (!pt) return;
    const [lat, lon] = pt;
    const prev = currentTargetRef.current;
    const deltaOk = !prev || Math.hypot(prev[0] - lat, prev[1] - lon) > 0.0008; // ~80m
    if (deltaOk) {
      currentTargetRef.current = pt;
      mapRef.current.flyTo(pt, 14, { duration: 0.9, easeLinearity: 0.25 });
    }
    const mk = markerByIdRef.current[selected.id];
    if (mk) {
      if (lastTooltipRef.current && lastTooltipRef.current !== mk) {
        try { lastTooltipRef.current.closeTooltip(); } catch {}
      }
      setTimeout(() => {
        try { mk.openTooltip(); lastTooltipRef.current = mk; } catch {}
      }, 350);
    }
  }, [selected]);

  // HERO: debounced geocode on typing
  useEffect(() => {
    if (hasSearched || !mapRef.current) return;
    const val = location.trim();
    if (!val) return;
    if (heroFlyTimer.current) window.clearTimeout(heroFlyTimer.current);
    heroFlyTimer.current = window.setTimeout(async () => {
      const pt = await geocode(val + " India");
      if (!pt || !mapRef.current) return;
      const prev = currentTargetRef.current;
      const deltaOk = !prev || Math.hypot(prev[0] - pt[0], prev[1] - pt[1]) > 0.0008;
      if (deltaOk) {
        currentTargetRef.current = pt;
        mapRef.current.flyTo(pt, 11, { duration: 0.9 });
      }
    }, 350);
  }, [location, hasSearched]);

  /* ────────────── Search handlers (unchanged) ────────────── */
  async function onSearch(resetPage?: number) {
    setErr(null);
    setHasSearched(true);
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (typeof resetPage === "number") setPage(resetPage);

    try {
      const nothing =
        !q.trim() && !location.trim() && mode === "any" && !internship && !minSalary.trim() && !enrich;
      if (nothing) {
        const empty: FeedResponse = { provider: "adzuna", page: 1, per_page: perPage, total: 0, jobs: [] };
        setResp(empty); setJobs([]); setSelected(null); didFitRef.current = false;
        return;
      }

      const data = await getLiveJobs({
        q: q || undefined,
        location: location || undefined,
        mode,
        internship,
        min_salary: minSalary || undefined,
        enrich,
        page: typeof resetPage === "number" ? resetPage : page,
        per_page: perPage,
        signal: ctrl.signal,
      });

      const cleaned = (data.jobs || []).map((j) => ({ ...j, company: j.company?.trim() || undefined }));
      setResp({ ...data, jobs: cleaned });
      setJobs(cleaned);
      setSelected(cleaned[0] ?? null);
      didFitRef.current = false;
    } catch (e: any) {
      if (e?.name === "AbortError") setErr("Search cancelled.");
      else setErr(e?.message || "Failed to fetch live jobs.");
    } finally {
      setLoading(false);
    }
  }

  function onCancel() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function clearAll() {
    setQ(""); setLocation(""); setMode("any"); setInternship(false);
    setMinSalary(""); setEnrich(false);
    setResp(null); setJobs([]); setSelected(null); setErr(null);
    didFitRef.current = false; currentTargetRef.current = null;
    abortRef.current?.abort(); setLoading(false);
  }

  async function onPrev() {
    if ((resp?.page ?? 1) <= 1 || loading) return;
    setLoading(true);
    await onSearch((resp?.page ?? 2) - 1);
  }
  async function onNext() {
    if (loading) return;
    setLoading(true);
    await onSearch((resp?.page ?? 1) + 1);
  }

  const MODES: ModeFilter[] = ["any", "remote", "onsite", "hybrid"];
  const searching = loading;

  const FilterFields = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.9fr 1.2fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelS}>Role / stack</label>
          <input style={inputS} value={q} onChange={(e) => setQ(e.target.value)} placeholder='e.g., "Python FastAPI"' />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelS}>Location</label>
          <input style={inputS} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chennai" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelS}>Mode</label>
          <select style={selectS} value={mode} onChange={(e) => setMode(e.target.value as ModeFilter)}>
            {MODES.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelS}>Min salary</label>
          <input style={inputS} value={minSalary} onChange={(e) => setMinSalary(e.target.value)} placeholder="6 LPA, ₹50k pm etc" />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", color: textMain }}>
          <label>
            <input type="checkbox" checked={internship} onChange={(e) => setInternship(e.target.checked)} style={{ marginRight: 6 }} />
            Internships only
          </label>
          <label>
            <input type="checkbox" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} style={{ marginRight: 6 }} />
            Enrich (LLM)
          </label>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={btn} onClick={() => setConfirmOpen(true)}>Clear</button>
          {!searching ? (
            <button style={btnPrimary} onClick={() => onSearch(1)}>Search</button>
          ) : (
            <button style={btnDanger} onClick={onCancel}>Cancel</button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div style={pageWrap}>
      {/* Loader overlay */}
      <LoaderOverlay open={searching} onCancel={onCancel} />

      {/* Confirm-before-clear modal */}
      <ConfirmModal
        open={confirmOpen}
        title="Clear search & results?"
        body="This will reset role, location, filters, and remove the current results list."
        confirmText="Yes, clear all"
        cancelText="Keep"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); clearAll(); }}
      />

      <div style={headerRow}>
        <h1 style={h1S}>Live Jobs</h1>
        {searching ? <button style={btnDanger} onClick={onCancel}>Cancel</button> : null}
      </div>

      <div style={helperPill}>
        Type a city/area to preview on the map. After search we place accurate pins and keep movements smooth.
      </div>

      {!hasSearched && !searching && (
        <div style={heroWrap}>
          <div ref={heroMapRef} style={heroMapLayer} />
          <div style={heroFilterCard}>{FilterFields}</div>
        </div>
      )}

      {(hasSearched || searching) && (
        <>
          <div style={stickyBar}>{FilterFields}</div>
          {err ? (
            <div style={{ ...card, borderColor: "rgba(255,120,120,.35)", background: "rgba(255,0,0,.05)" }}>
              <strong style={{ color: "#ffb3b3" }}>{err}</strong>
            </div>
          ) : (
            <div style={gridAfterSearch}>
              <div>
                <div style={{ ...mapShell }}>
                  <div style={mapHeader}>
                    <div style={{ fontWeight: 800, color: textMain }}>India Map</div>
                    <div style={{ color: textDim, fontSize: 12 }}>
                      {jobs.length ? `${jobs.length} result${jobs.length > 1 ? "s" : ""}` : "—"}
                    </div>
                  </div>
                  <div ref={mapElRef} style={{ ...mapCanvasBase, height: 360 }} />
                </div>

                <div style={listPanel}>
                  <div style={listStatRow}>
                    <div>
                      Page {resp?.page ?? 1} · per page {resp?.per_page ?? 15}
                      {typeof resp?.total === "number" ? <> · total {resp?.total}</> : null}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={btn} onClick={onPrev}>Prev</button>
                      <button style={btn} onClick={onNext}>Next</button>
                    </div>
                  </div>

                  {!searching && jobs.length === 0 && (
                    <div style={{ color: textMain }}>No jobs found.</div>
                  )}

                  {jobs.map((j) => {
                    const isActive = selected?.id === j.id;
                    const company = j.company?.trim();
                    const cardStyle: React.CSSProperties = {
                      ...listCard,
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor: isActive ? brand : glassBorder,
                      boxShadow: isActive
                        ? "0 0 0 2px rgba(167,139,250,0.25) inset, 0 8px 30px rgba(124,58,237,0.12)"
                        : "0 0 0 0 rgba(0,0,0,0)",
                      transform: isActive ? "translateY(-1px)" : "none",
                    };

                    return (
                      <div key={j.id} style={cardStyle} onClick={() => setSelected(j)}>
                        <div style={titleS}>{j.title || "Untitled role"}</div>
                        <div style={metaRow}>
                          {company && <span style={{ fontWeight: 700 }}>{company}</span>}
                          {[j.location_city, j.location_region].filter(Boolean).length > 0 && (
                            <span>{[j.location_city, j.location_region].filter(Boolean).join(", ")}</span>
                          )}
                          {j.mode && <span>{j.mode}</span>}
                          {j.work_type && <span>{j.work_type}</span>}
                          {j.posted_at && <span>{new Date(j.posted_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={detailsPanel}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: textMain, marginBottom: 4 }}>
                      {selected?.title ?? "Select a job"}
                    </div>
                    <div style={{ color: textDim }}>
                      {selected
                        ? [selected.company, selected.location_city, selected.location_region].filter(Boolean).join(" · ")
                        : "Click a job on the left"}
                    </div>
                  </div>
                  {selected?.apply_url && (
                    <a href={selected.apply_url} target="_blank" rel="noreferrer" style={{ ...btnPrimary, textDecoration: "none" }}>
                      Apply
                    </a>
                  )}
                </div>

                {selected && (
                  <>
                    <table style={smTable}>
                      <tbody>
                        <tr><th style={th}>Mode</th><td style={td}>{selected.mode ?? "—"}</td></tr>
                        <tr><th style={th}>Type</th><td style={td}>{selected.work_type ?? "—"}</td></tr>
                        <tr><th style={th}>Salary</th><td style={td}>{(selected as any).salary_text ?? "—"}</td></tr>
                      </tbody>
                    </table>
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontWeight: 900, color: textMain, marginBottom: 6 }}>About the role</div>
                      <div style={{ color: textMain, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                        {selected.short_desc || "No description available."}
                      </div>
                    </div>

                    {/* Tips: fills the right-bottom space */}
                    <TipsTicker />
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
