# backend/app/main.py
from __future__ import annotations

import os
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse

# --- Optional: load .env early (no-op fallback allowed) ---
try:
    from app.core.env import load_env  # type: ignore
except Exception:  # pragma: no cover
    def load_env() -> None:
        pass


def _cors_origins_from_env() -> List[str]:
    """
    Determine allowed origins for CORS.

    Env vars (first match wins):
      - ALL_ORIGINS=1           -> ["*"]  (dev only)
      - FRONTEND_ORIGIN=...     -> single origin (e.g., http://localhost:3000)
      - FRONTEND_ORIGINS=...    -> csv list (e.g., http://a:3000,http://b:5173)

    Defaults to ["http://localhost:3000"] if nothing set (useful for Next.js).
    """
    if os.getenv("ALL_ORIGINS") == "1":
        return ["*"]

    if origin := os.getenv("FRONTEND_ORIGIN"):
        return [origin.strip()]

    if origins_csv := os.getenv("FRONTEND_ORIGINS"):
        return [o.strip() for o in origins_csv.split(",") if o.strip()]

    return ["http://localhost:3000"]


def create_app() -> FastAPI:
    # Load env (if module exists) before building app
    load_env()

    app = FastAPI(
        title="SkillSync API",
        version="1.0.0",
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url="/api/v1/redoc",
    )

    # -------- CORS --------
    allowed = _cors_origins_from_env()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    # -------- Health & Root redirect --------
    @app.get("/", include_in_schema=False)
    def root_redirect():
        """Redirect root to the interactive docs."""
        return RedirectResponse(url="/api/v1/docs", status_code=302)

    @app.get("/healthz", include_in_schema=False)
    async def healthz():
        return JSONResponse({"status": "ok"})

    # -------- Routers (keep existing mounts intact) --------
    from app.llm_api.routes.ai_llm import router as llm_ai_router            # type: ignore
    from app.llm_api.routes.feedback_llm import router as llm_feedback_router # type: ignore
    from app.llm_api.routes.ml_llm import router as llm_ml_router             # type: ignore
    from app.llm_api.routes.jobs_llm import router as llm_jobs_router         # type: ignore
    from app.llm_api.routes.match_llm import router as llm_match_router       # type: ignore
    from app.llm_api.routes.uploads_llm import router as llm_uploads_router   # type: ignore
    from app.llm_api.routes.enrich_llm import router as llm_enrich_router     # type: ignore

    app.include_router(llm_ai_router)
    app.include_router(llm_feedback_router)
    app.include_router(llm_ml_router)
    app.include_router(llm_jobs_router)
    app.include_router(llm_match_router)
    app.include_router(llm_uploads_router)
    app.include_router(llm_enrich_router)

    # Safe mount for Job Feed (Adzuna-backed)
    try:
        from app.api.routes.jobfeed import router as jobfeed_router  # type: ignore
        app.include_router(jobfeed_router)
    except Exception as e:
        print({"level": "warn", "msg": "jobfeed router not mounted", "error": str(e)})

    # -------- Startup log --------
    @app.on_event("startup")
    async def _startup():
        print(
            {
                "level": "info",
                "msg": "SkillSync API up",
                "cors_allow_origins": allowed,
            }
        )

    return app


app = create_app()

# --- Optional: analyze-jobs override (safe, idempotent) ---
try:
    from app.api.v1.routers.analyze_jobs_override import (  # type: ignore
        install as _install_analyze_override,
    )
    _install_analyze_override(app)
except Exception:
    pass
