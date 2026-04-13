from __future__ import annotations

# ---- SYSTEM PROMPT ----
SYS_RESUME = (
    "You are a precise career assistant. "
    "Be concise, structured, and actionable. "
    "Prefer bullet points, short sentences, and JSON when requested. "
    "If information is missing, state assumptions explicitly."
)

# ---- RESUME SCORING ----
USR_RESUME_SCORE = """Score this resume out of 100 for ATS alignment. Then provide:
1) Top strengths (bullet points)
2) Missing/weak skills (bullet points)
3) Three concrete improvements (numbered)

Return a concise answer (<= 200 words for prose parts).

Resume:
{resume_text}
"""

# ---- SKILL EXTRACTION ----
USR_EXTRACT_SKILLS = """Extract skills (both hard and soft) as a JSON array of unique strings.
- Max 40 items
- Lowercase where appropriate
- No duplicates
- No commentary, only JSON

Text:
{text}
"""

# ---- JOB MATCHING ----
USR_MATCH = """You are given a RESUME and a set of JOBS (title + short description).
Task: Rank the best 5 matches.

Return STRICT JSON with an array named "matches", where each item has:
- job_title: string
- reason: short string (<= 30 words)
- overlap_skills: array of strings
- missing_skills: array of strings

RESUME:
{resume_text}

JOBS:
{jobs_text}
"""

# ---- SKILL GAP ANALYSIS ----
USR_GAPS = """Given RESUME skills vs TARGET ROLE skills, list the skill gaps grouped by category,
and propose a compact 1–2 month plan.

Output format (markdown):
- **Gap Categories**: bullet list with sub-bullets of specific gaps
- **Plan**: 4–8 bullet points, each actionable and time-bounded

RESUME:
{resume_text}

TARGET ROLE:
{role_text}
"""

# ---- COURSE RECOMMENDATION (Long-Term Stable Version) ----
USR_RECOMMEND = """You are an AI career mentor specializing in upskilling and personalized learning.
Analyze the following user’s background, weaknesses, and career goal.

Return STRICT JSON with an array named "courses":
[
  {{"title": "...", "platform": "...", "link": "...", "why": "..."}},
  ...
]

Guidelines:
- Recommend 6–8 diverse, high-quality courses.
- Include mix of Coursera, Udemy, edX, Kaggle, or YouTube if relevant.
- Each “why” must be one sentence describing fit or benefit.
- If no link is known, write "search" instead.

User Input:
{gaps_text}
"""


# ---- JOB INSIGHT ANALYSIS ----
USR_ANALYZE_JOBS = """You are analyzing a sample of job postings.

Return a succinct markdown report with:
- **Top Roles** (with rough frequencies)
- **Top 10 Skills** (comma-separated)
- **Trends/Notes** (2–4 bullets for resume tailoring)

JOBS SAMPLE:
{jobs_text}
"""
