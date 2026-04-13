/** frontend/lib/settings.ts
 * Ultra-light global settings bus (no deps).
 * - Persists to localStorage
 * - Applies side-effects on <html> + injects helper CSS for pins/motion
 * - Broadcasts CustomEvent("settings:changed")
 */

export type SettingsModel = {
  darkMode: boolean;
  reducedMotion: boolean;
  confetti: boolean;
  loaderStyle: "dots" | "ring" | "shimmer";
  loaderZ: number;
  mapPinColor: "red" | "violet";
  keepSession: boolean;
};

export const LS_KEY = "settings.v1";

export const DEFAULTS: SettingsModel = {
  darkMode: true,
  reducedMotion: false,
  confetti: true,
  loaderStyle: "dots",
  loaderZ: 41,
  mapPinColor: "red",
  keepSession: true,
};

let cache: SettingsModel | null = null;

function ensureStyleTag(id: string): HTMLStyleElement {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

function applyPinThemeCss(color: "red" | "violet") {
  // Recolor Leaflet default markers using CSS filters (no code changes elsewhere).
  // Targets all marker icons; tweakable later to specific classes if needed.
  const el = ensureStyleTag("pin-theme-style");
  const red = "invert(18%) sepia(96%) saturate(4223%) hue-rotate(350deg) brightness(94%) contrast(98%)";
  const violet = "invert(14%) sepia(73%) saturate(3812%) hue-rotate(262deg) brightness(89%) contrast(97%)";
  const filter = color === "red" ? red : violet;
  el.textContent = `
    .leaflet-pane .leaflet-marker-icon { filter: ${filter} !important; }
    .leaflet-pane .leaflet-marker-shadow { opacity: 0.7; }
  `;
}

function applyReducedMotionCss(on: boolean) {
  const el = ensureStyleTag("reduced-motion-style");
  el.textContent = on
    ? `
      html[data-reduced-motion="1"] * {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition: none !important;
      }
    `
    : "";
}

export function loadSettings(): SettingsModel {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    const s = { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
    cache = s;
    return s;
  } catch {
    cache = DEFAULTS;
    return DEFAULTS;
  }
}

export function getSettings(): SettingsModel {
  return cache ?? loadSettings();
}

export function applySideEffects(s: SettingsModel): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;

  // Dark theme
  s.darkMode ? html.classList.add("dark") : html.classList.remove("dark");

  // Motion
  html.setAttribute("data-reduced-motion", s.reducedMotion ? "1" : "0");
  applyReducedMotionCss(s.reducedMotion);

  // Loader style & z
  html.setAttribute("data-loader-style", s.loaderStyle);
  html.style.setProperty("--loader-z", String(s.loaderZ));

  // Map pin theme (CSS filter recolor)
  html.setAttribute("data-pin", s.mapPinColor);
  html.style.setProperty("--pin-theme", s.mapPinColor);
  applyPinThemeCss(s.mapPinColor);

  // Session persistence flag
  html.setAttribute("data-keep-session", s.keepSession ? "1" : "0");

  // Expose for quick access
  (window as any).__APP_SETTINGS = s;
}

export function saveSettings(s: SettingsModel): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(s));
  cache = s;
  applySideEffects(s);
  window.dispatchEvent(new CustomEvent<SettingsModel>("settings:changed", { detail: s }));
}

export function subscribeSettings(cb: (s: SettingsModel) => void): () => void {
  const fn = (e: Event) => cb((e as CustomEvent<SettingsModel>).detail ?? getSettings());
  window.addEventListener("settings:changed", fn);
  return () => window.removeEventListener("settings:changed", fn);
}

// Init on import in browser
if (typeof window !== "undefined") {
  const s = loadSettings();
  applySideEffects(s);
}
