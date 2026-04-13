from __future__ import annotations
import os
from pathlib import Path

CANDIDATES = []  # filled at import time for clarity

def _init_candidates() -> None:
    """
    Build candidate .env locations relative to this file.
    """
    global CANDIDATES
    here = Path(__file__).resolve()                 # .../backend/app/core/env.py
    core_dir = here.parent                          # .../backend/app/core
    app_dir = core_dir.parent                       # .../backend/app
    backend_dir = app_dir.parent                    # .../backend
    repo_dir = backend_dir.parent                   # .../ (repo root)

    CANDIDATES = [
        backend_dir / ".env",       # backend/.env   (your current file)
        repo_dir / ".env",          # repo_root/.env
        app_dir / ".env",           # backend/app/.env (fallback)
        core_dir / ".env",          # backend/app/core/.env (last resort)
    ]

def _load_file(path: Path) -> bool:
    """
    Minimal .env parser (safe; ignores comments/blank lines).
    Does NOT overwrite existing os.environ entries.
    Returns True if the file existed and was parsed.
    """
    try:
        if not path.exists():
            return False
        text = path.read_text(encoding="utf-8", errors="ignore")
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip("'").strip('"')
            if k and v and k not in os.environ:
                os.environ[k] = v
        return True
    except Exception:
        # swallow parsing errors; we only log below
        return False

def load_env() -> None:
    """
    Load .env from well-known locations. Idempotent.
    Prints a concise, non-sensitive diagnostic so you can see what's happening.
    """
    if not CANDIDATES:
        _init_candidates()

    loaded_paths = []
    for cand in CANDIDATES:
        if _load_file(cand):
            loaded_paths.append(str(cand))

    chutes_present = {
        "CHUTES_API_KEY_present": bool(os.getenv("CHUTES_API_KEY")),
        "CHUTES_MODEL_set": bool(os.getenv("CHUTES_MODEL")),
        "CHUTES_BASE_URL_set": bool(os.getenv("CHUTES_BASE_URL")),
    }

    print({
        "level": "info",
        "msg": "env load complete",
        "loaded_any": bool(loaded_paths),
        "loaded_files": loaded_paths,           # which files were parsed
        **chutes_present                        # booleans only, never values
    })
