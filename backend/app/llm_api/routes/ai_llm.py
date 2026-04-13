from __future__ import annotations
from fastapi import APIRouter, HTTPException, Body, Query
from app.services.chutes_client import llm_complete, ChutesError
import os

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])

@router.post(
    "/prompt",
    summary="Candidate Assistant (text-only) — refined, structured, India-first",
    response_model=None
)
def llm_prompt(
    prompt: str = Body(
        ...,
        media_type="text/plain",
        embed=False,
        description="Ask your career question in plain text (résumé tips, role fit, learning plan, interview prep, etc.)",
        examples=[
            "What’s the best path from Data Analyst to Machine Learning Engineer in 6 months with 8 hrs/week?",
            "How can I tailor my resume for Python developer roles in Chennai?",
            "What interview plan should I follow for a React developer internship?"
        ],
    ),
    temperature: float = Query(0.25, ge=0.0, le=1.0, description="Lower = crisper, higher = more creative"),
    max_tokens: int = Query(900, ge=200, le=1600, description="Max response length"),
):
    # Validate body
    text = (prompt or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty prompt. Type your question in plain English.")

    # Validate environment early
    for key in ("CHUTES_API_KEY", "CHUTES_BASE_URL", "CHUTES_MODEL"):
        if not os.getenv(key):
            raise HTTPException(status_code=502, detail=f"Missing {key} in environment")

    # ——— Style & policy guardrails (dense but friendly) ———
    system = (
        "You are a precise, encouraging **career copilot** for *students and early-career candidates in India*.\n"
        "OUTPUT STYLE:\n"
        "- Use crisp markdown with short sections and bullets; keep it under ~350 words when possible.\n"
        "- Prefer actions, timelines, and measurable outcomes over generic advice.\n"
        "- Use **canonical skill names** (e.g., 'PostgreSQL', 'React', 'FastAPI').\n"
        "- India-first by default (titles, LPA bands, hiring norms). If the user specifies another region, adapt.\n"
        "- Be supportive, realistic, and concrete. Avoid filler, clichés, and disclaimers.\n"
        "SAFETY & QUALITY:\n"
        "- Don’t invent personal facts; if something is missing, add a one-line ‘What I still need’ note.\n"
        "- Avoid risky guidance; suggest safer alternatives when needed.\n"
        "- If asked for sensitive/ethical topics, pivot to constructive, lawful guidance."
    )

    # ——— Compact, friendly structure that reads beautifully ———
    user = f"""
User question:
{text}

Please return a *well-structured* answer with these headings (omit any not relevant):

**Direct Answer**
- 2–4 bullets that address the question in plain language.

**Action Plan (Do this next)**
- 3–6 steps, each with *what*, *why it matters*, and a *time hint* (e.g., “30–45 min/day”, “1–2 weeks”).

**Skill Emphasis**
- Top 4–6 skills/tools to prioritise (canonical names).

**Proof of Work (Portfolio)**
- 2–3 compact project ideas; include a metric or outcome (e.g., “+12% F1 vs. baseline”).

**Local Insight (India)**
- Role titles, typical **LPA** bands (junior/mid), remote openness (%), and 1–2 city notes.

**Resources**
- 4–6 focused resources (sites, course types, keywords). Keep vendor-neutral if possible.

**What I still need (if any)**
- At most one line asking for a key missing detail (e.g., location, timeline, weekly hours).

Tone: warm, succinct, and confidence-building.
""".strip()

    try:
        reply = llm_complete(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return {
            "mode": "student",
            "query": text,
            "answer": reply.strip(),
            "model": os.getenv("CHUTES_MODEL"),
            "tokens": {"max": max_tokens},
        }
    except ChutesError as ce:
        raise HTTPException(status_code=502, detail=f"ChutesError: {str(ce)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unhandled error: {str(e)}")
