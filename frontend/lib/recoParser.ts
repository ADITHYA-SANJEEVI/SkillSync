/**
 * recoParser.ts — Parses LLM "reply" into Course Genie buckets.
 * Supports:
 *   A) strict JSON with { courses: [...] }
 *   B) fenced ```json ... ``` or raw { ... }
 *   C) markdown-ish fallback with "## Quick Wins" etc.
 */

export type CourseItem = {
  title: string;
  provider?: string;
  duration?: string;
  price?: string;
  url?: string;
  why?: string;
  badge?: "Free" | "Paid" | undefined;
};

export type Buckets = {
  "Quick Wins": CourseItem[];
  "Foundations": CourseItem[];
  "Projects": CourseItem[];
  "Certifications": CourseItem[];
  "Stretch": CourseItem[];
};

const EMPTY: Buckets = {
  "Quick Wins": [],
  "Foundations": [],
  "Projects": [],
  "Certifications": [],
  "Stretch": [],
};

function clean(s?: string | null): string | undefined {
  if (!s) return undefined;
  return s.replace(/\s+/g, " ").trim();
}

function normalizeUrl(u?: string, provider?: string): string | undefined {
  if (!u) return undefined;
  const url = u.trim();
  if (url.toLowerCase() !== "search") return url;

  const p = (provider || "").toLowerCase();
  const q = encodeURIComponent(provider || "");
  // Turn "search" placeholder into a platform search
  if (p.includes("coursera")) return "https://www.coursera.org/search?query=backend%20python%20sql";
  if (p.includes("udemy"))    return "https://www.udemy.com/courses/search/?q=backend%20python%20sql";
  if (p.includes("edx"))      return "https://www.edx.org/search?q=backend%20python%20sql";
  if (p.includes("kaggle"))   return "https://www.kaggle.com/learn";
  if (p.includes("youtube"))  return "https://www.youtube.com/results?search_query=backend+python+sql";
  return "https://www.google.com/search?q=" + q;
}

function coerceCourse(x: any): CourseItem | null {
  if (!x) return null;
  const title = clean(x.title || x.name || x.course || x.label);
  if (!title) return null;

  const provider = clean(x.platform || x.provider || x.source || x.site);
  const url = normalizeUrl(clean(x.link || x.url || x.href), provider);

  let price: string | undefined = clean(x.price || x.cost || x.fee);
  let badge: CourseItem["badge"];
  if (!price || /free/i.test(price)) { price = "Free"; badge = "Free"; }
  else if (/^\$?\d+/.test(price)) { badge = "Paid"; }

  return {
    title,
    provider,
    duration: clean(x.duration || x.length || x.hours),
    price,
    url,
    why: clean(x.why || x.reason),
    badge,
  };
}

function emptyBuckets(): Buckets {
  return JSON.parse(JSON.stringify(EMPTY));
}

function put(b: Buckets, key: keyof Buckets, c: CourseItem | null) {
  if (c) b[key].push(c);
}

function bucketByHeuristics(c: CourseItem): keyof Buckets {
  const t = (c.title || "").toLowerCase();
  const p = (c.provider || "").toLowerCase();

  const has = (re: RegExp) => re.test(t);

  // Projects first
  if (has(/\bproject|build|hands[-\s]?on|capstone|workshop\b/i)) return "Projects";
  // Certifications
  if (has(/\bcertificate|certification|professional certificate|exam|prep\b/i)) return "Certifications";
  // Quick wins: Free/Kaggle/YouTube/Micro/Intro/Fundamentals/Short vibes
  if (c.badge === "Free" || /kaggle|youtube|micro|crash|intro|fundamentals|essentials/i.test(t)) return "Quick Wins";
  // Foundations: bootcamp/basics/introductory/for beginners
  if (has(/\bbootcamp|basics|foundation|foundations|beginner|introductory|for beginners\b/i)) return "Foundations";
  // Stretch: mastery/advanced/expert
  if (has(/\badvanced|expert|mastery|masterclass|deep dive\b/i)) return "Stretch";

  // Provider hints
  if (/kaggle|youtube/.test(p)) return "Quick Wins";
  if (/coursera|edx|udacity|linux academy|plural|oreilly/.test(p)) return "Foundations";

  // Default: Foundations
  return "Foundations";
}

function parseStrictJson(reply: string): any | null {
  try { return JSON.parse(reply); } catch { return null; }
}

function tryExtractJsonBlock(reply: string): any | null {
  const fence = /```json([\s\S]*?)```/i.exec(reply);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }

  const s = reply.indexOf("{"), e = reply.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(reply.slice(s, e + 1)); } catch {} }

  return null;
}

function mdFallback(reply: string): Buckets {
  // Supports "## Quick Wins" then bullet list lines
  const out = emptyBuckets();
  const sections = reply.split(/\n(?=##\s+)/g);
  const map: Record<string, keyof Buckets> = {
    "quick wins": "Quick Wins", "foundations": "Foundations",
    "projects": "Projects", "certifications": "Certifications", "stretch": "Stretch",
  };
  for (const sec of sections) {
    const m = /^##\s+([^\n]+)/.exec(sec); if (!m) continue;
    const bucket = map[m[1].trim().toLowerCase()]; if (!bucket) continue;
    for (const line of sec.split("\n").slice(1)) {
      const text = line.replace(/^[-*]\s*/, "").trim(); if (!text) continue;
      // naive parse
      const title = text.replace(/\(https?:\/\/[^\s)]+\)/, "").replace(/—.+$/, "").trim();
      const url = (text.match(/\((https?:\/\/[^\s)]+)\)/) || [])[1];
      const provider = (text.match(/—\s*([^()]+?)(?:\(|$)/) || [])[1]?.trim();
      const duration = (text.match(/\b(\d+\s*(?:h|hrs|hours))\b/i) || [])[1];
      const price = (text.match(/\b(Free|\$\d+)/i) || [])[1];
      put(out, bucket, { title, provider, duration, price, url });
    }
  }
  return out;
}

export function parseRecommendations(reply: string): Buckets {
  if (!reply || typeof reply !== "string") return emptyBuckets();

  // A) strict JSON
  const j = parseStrictJson(reply) ?? tryExtractJsonBlock(reply);
  if (j) {
    // if { courses: [...] }
    if (Array.isArray(j.courses)) {
      const out = emptyBuckets();
      for (const raw of j.courses) {
        const c = coerceCourse(raw);
        if (!c) continue;
        const bucket = bucketByHeuristics(c);
        put(out, bucket, c);
      }
      return out;
    }
    // if already bucketed
    if (typeof j === "object") {
      const out = emptyBuckets();
      const map: Record<string, keyof Buckets> = {
        "quick wins": "Quick Wins", "foundations": "Foundations",
        "projects": "Projects", "certifications": "Certifications", "stretch": "Stretch",
      };
      for (const [k, v] of Object.entries(j)) {
        const bk = map[k.toLowerCase().replace(/\s+/g, " ")];
        if (!bk) continue;
        const arr = Array.isArray(v) ? v : [v];
        for (const one of arr) put(out, bk, coerceCourse(one));
      }
      return out;
    }
  }

  // C) markdown fallback
  return mdFallback(reply);
}

export function countAll(b: Buckets): number {
  return b["Quick Wins"].length + b["Foundations"].length + b["Projects"].length + b["Certifications"].length + b["Stretch"].length;
}
