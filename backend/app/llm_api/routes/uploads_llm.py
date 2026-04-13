from __future__ import annotations
from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from typing import Any, Dict, List
from datetime import datetime
from zoneinfo import ZoneInfo
import pathlib, json, uuid

from app.services.payloads import get_text_from_inputs

DB_PATH = pathlib.Path(__file__).resolve().parents[2] / "uploads" / "resume_index.json"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

def _load_db() -> List[Dict[str, Any]]:
    """Load JSON list from local index file (create if missing)."""
    if not DB_PATH.exists():
        DB_PATH.write_text("[]", encoding="utf-8")
    try:
        return json.loads(DB_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []

def _save_db(data: List[Dict[str, Any]]):
    DB_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def _next_id() -> int:
    """Auto-increment integer ID starting from 1."""
    data = _load_db()
    if not data:
        return 1
    # tolerate existing non-int ids by filtering
    current_max = max((r.get("id", 0) for r in data if isinstance(r.get("id"), int)), default=0)
    return current_max + 1

def _add_record(record: Dict[str, Any]):
    data = _load_db()
    data.append(record)
    _save_db(data)

def _sorted_db(desc: bool = True) -> List[Dict[str, Any]]:
    data = _load_db()
    data.sort(key=lambda r: r.get("uploaded_at", ""), reverse=desc)  # ISO strings sort correctly
    return data

# ============================================================
#  FastAPI Router — Upload Résumé (File-only)
# ============================================================
router = APIRouter(prefix="/api/v1/llm", tags=["llm-uploads"])

@router.post(
    "/upload-resume",
    summary="Upload résumé (.pdf or .txt) — stored locally and indexed (mock DB)"
)
async def llm_upload_resume(file: UploadFile = File(..., description="Upload your résumé as .pdf or .txt")):
    """
    Candidate-only endpoint.

    Accepts a résumé file (.pdf or .txt), extracts text via `get_text_from_inputs`,
    saves it under `backend/uploads/resumes/`, and records metadata to a mock JSON DB
    (`backend/uploads/resume_index.json`) for demo purposes.
    """
    # ---------- Validation ----------
    name = (file.filename or "").lower()
    if not name.endswith((".pdf", ".txt")):
        raise HTTPException(status_code=415, detail="Only .pdf or .txt files are supported.")

    # ---------- Extract text ----------
    resume_text, meta = await get_text_from_inputs(inline_text=None, file=file)
    if not resume_text or len(resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Résumé text is empty or unreadable.")

    # ---------- Save file ----------
    base_dir = pathlib.Path(__file__).resolve().parents[2]
    save_dir = base_dir / "uploads" / "resumes"
    save_dir.mkdir(parents=True, exist_ok=True)

    fname = meta.get("filename") or f"resume_{uuid.uuid4().hex}.txt"
    out_path = save_dir / fname
    out_path.write_text(resume_text or "", encoding="utf-8", errors="ignore")

    # ---------- Record mock DB entry ----------
    record = {
        "id": _next_id(),  # sequential integer id
        "filename": fname,
        "path": str(out_path),
        "length": len(resume_text or ""),
        # IST timestamp, still ISO 8601 (keeps standard, shows +05:30)
        "uploaded_at": datetime.now(ZoneInfo("Asia/Kolkata")).isoformat(),
        "uploaded_by": "demo-user",
        "summary": f"{resume_text[:120]}..."  # preview snippet
    }
    _add_record(record)

    return {
        "mode": "student",
        "source": meta,
        "mock_db_entry": record,
        "message": "Résumé uploaded successfully and indexed (mock DB)."
    }

# ============================================================
#  Read-only listing APIs (mock DB)
# ============================================================
@router.get(
    "/resume-list",
    summary="List uploaded résumés (mock DB)"
)
def list_resumes(
    limit: int = Query(20, ge=1, le=200, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip from start"),
):
    """Returns a paginated list of résumé records from the mock JSON DB."""
    items = _sorted_db(desc=True)
    total = len(items)
    page = items[offset: offset + limit]
    return {
        "mode": "student",
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": page,
    }

@router.get(
    "/resumes/{resume_id}",
    summary="Fetch a single résumé record (mock DB)"
)
def get_resume(resume_id: int):
    """Returns one record by its integer `id`."""
    for rec in _load_db():
        if rec.get("id") == resume_id:
            return {"mode": "student", "item": rec}
    raise HTTPException(status_code=404, detail="Resume not found")
# ============================================================
#  Delete one résumé (mock DB)  —  NON-breaking addition
# ============================================================
@router.delete(
    "/resumes/{resume_id}",
    summary="Delete a résumé record (and stored file) from the mock DB",
    status_code=204,
)
def delete_resume(resume_id: int):
    """
    Removes a single résumé by its *integer* id.
    - Updates backend/app/uploads/resume_index.json
    - Attempts to remove the stored file at `record['path']` if it exists
    - Returns 204 No Content on success (idempotent if the file is already missing)
    """
    data = _load_db()
    keep: List[Dict[str, Any]] = []
    removed: Dict[str, Any] | None = None

    for rec in data:
        if rec.get("id") == resume_id:
            removed = rec
        else:
            keep.append(rec)

    if removed is None:
        # Stay consistent with your GET 404 behavior
        raise HTTPException(status_code=404, detail="Resume not found")

    # Try to delete the file; ignore errors (mock DB should still update)
    try:
        p = pathlib.Path(removed.get("path", ""))
        # Safety: only delete inside uploads/resumes
        uploads_root = pathlib.Path(__file__).resolve().parents[2] / "uploads" / "resumes"
        if p.is_file() and uploads_root in p.resolve().parents:
            p.unlink(missing_ok=True)
    except Exception:
        pass  # non-fatal

    _save_db(keep)
    # 204 No Content
    return
