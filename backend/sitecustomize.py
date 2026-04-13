# Auto-applied by Python when present on sys.path
try:
    from app.services import chutes_client as _c
    if getattr(_c, "llm_complete", None) is not getattr(_c, "llm_complete_flex", None):
        _c.llm_complete = _c.llm_complete_flex  # now llm_complete(messages=...) works too
except Exception:
    # Never block app startup because of patching; routes will raise their own errors if any
    pass
