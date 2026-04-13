/* eslint-disable @typescript-eslint/no-explicit-any */
const DEFAULT_PORTS = [8000, 5173, 3000];

function inferBase(): string {
  try {
    if (typeof window !== "undefined") {
      const override = (window as any)?.ENV_API_BASE || (globalThis as any)?.ENV_API_BASE;
      if (override && typeof override === "string") return override;

      const env = (globalThis as any)?.process?.env;
      const fromEnv =
        env?.NEXT_PUBLIC_API_BASE ||
        env?.API_BASE;
      if (fromEnv) return fromEnv as string;

      const loc = window.location;
      const host = loc.hostname;
      if (loc.port === "3000" || loc.port === "5173") {
        return `http://${host}:8000`;
      }
      if (!DEFAULT_PORTS.includes(Number(loc.port))) {
        return `${loc.protocol}//${loc.host}`;
      }
      return "http://127.0.0.1:8000";
    }
  } catch {}
  return "http://127.0.0.1:8000";
}

export const API_BASE = inferBase();

/** Basic JSON fetch that tolerates non-JSON error bodies. */
async function doJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const txt = await res.text();
  let data: any = txt;
  try { data = txt ? JSON.parse(txt) : {}; } catch {}
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
    throw new Error(`Request failed: ${msg}`);
  }
  return data as T;
}

export const api = {
  get<T>(path: string) {
    return doJson<T>(`${API_BASE}${path}`, { method: "GET" });
  },
  postText<T>(path: string, body: string) {
    return doJson<T>(`${API_BASE}${path}`, {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain" },
    });
  },
  postForm<T>(path: string, fd: FormData) {
    return doJson<T>(`${API_BASE}${path}`, {
      method: "POST",
      body: fd,
    });
  },
};

/* ===================== Extract Skills ===================== */

export type ExtractSkillsResponse =
  | { skills: string[] }
  | { groups: Record<string, string[]> }
  | { languages?: string[]; frameworks?: string[]; tools?: string[]; cloud?: string[]; databases?: string[]; other?: string[] }
  | Record<string, any>;

export async function extractSkills(file: File): Promise<ExtractSkillsResponse> {
  const fd = new FormData();
  // Send both fields to avoid 422s across variants of the backend
  fd.append("file", file);
  fd.append("resume_file", file);

  const url = `${API_BASE}/api/v1/llm/ml/extract-skills`;
  return await doJson<ExtractSkillsResponse>(url, {
    method: "POST",
    body: fd,
  });
}

/* ===================== Live Jobs (Feed) ===================== */
/** Mode filter values seen in your codebase; kept permissive. */
export type ModeFilter = "remote" | "onsite" | "on-site" | "hybrid" | "any" | string;

export type JobCard = {
  id?: string;
  title: string;
  company: string;
  city?: string;
  state?: string;
  country?: string;
  url?: string;

  mode?: string;                  // remote/onsite/hybrid
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;

  location_lat?: number | null;
  location_lon?: number | null;

  posted_at?: string;             // ISO
  source?: string;                // e.g., "adzuna"
  [k: string]: any;               // forward-compat
};

export type FeedResponse = {
  items: JobCard[];
  total?: number;
  next_cursor?: string | null;
  [k: string]: any;
};

/** Build a query string from a params object (skips null/undefined/empty). */
function qs(params: Record<string, any>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? "?" + parts.join("&") : "";
}

/**
 * Fetch live job feed from your backend.
 * Backend route: GET /api/v1/jobfeed/feed
 * Example params: { q, city, mode, min_salary, max_salary, experience, page, cursor }
 */
export async function getLiveJobs(params: {
  q?: string;
  city?: string;
  mode?: ModeFilter;
  min_salary?: number;
  max_salary?: number;
  experience?: string | number;
  page?: number;
  cursor?: string;
} = {}): Promise<FeedResponse> {
  const url = `${API_BASE}/api/v1/jobfeed/feed${qs(params)}`;
  return await doJson<FeedResponse>(url, { method: "GET" });
}

// ---- [auto-append] analyzeResumeMatch ----
/* ===================== Skill Analysis (Match) ===================== */
/**
 * POST /api/v1/llm/match
 * - Accepts résumé PDF as multipart; we send both "file" and "resume_file"
 * - Optional job_name (string). Pass "" for no job name.
 */
export type AnalyzeMatchResponse = Record<string, any>;

export async function analyzeResumeMatch(file: File, jobName: string = ""): Promise<AnalyzeMatchResponse> {
  const base = (typeof API_BASE !== "undefined" && API_BASE) ? (API_BASE as string)
    : (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : "http://127.0.0.1:8000");

  const fd = new FormData();
  fd.append("file", file);
  fd.append("resume_file", file);
  if (jobName && jobName.trim().length) {
    fd.append("job_name", jobName.trim());
  }

  const url = `${base}/api/v1/llm/match`;
  try {
    // prefer helper if present
    // @ts-ignore
    if (typeof doJson === "function") return await doJson<AnalyzeMatchResponse>(url, { method: "POST", body: fd });
  } catch {}
  const res = await fetch(url, { method: "POST", body: fd });
  const txt = await res.text();
  let data: any = txt;
  try { data = txt ? JSON.parse(txt) : {}; } catch {}
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
    throw new Error(`Request failed: ${msg}`);
  }
  return data as AnalyzeMatchResponse;
}

