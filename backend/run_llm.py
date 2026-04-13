"""
run_llm.py — minimal Chutes (DeepSeek) client used by the API.

Environment (already in your .env):
  CHUTES_API_KEY
  CHUTES_BASE_URL            e.g., https://llm.chutes.ai
  CHUTES_COMPLETIONS_PATH    e.g., /v1/chat/completions
  CHUTES_MODEL               e.g., deepseek-ai/DeepSeek-V3-0324
  CHUTES_TIMEOUT_SECONDS     e.g., 60
"""

import os, json, time
from typing import List, Dict, Any, Optional
import requests

BASE_URL   = os.getenv("CHUTES_BASE_URL", "").rstrip("/")
PATH       = os.getenv("CHUTES_COMPLETIONS_PATH", "/v1/chat/completions")
API_KEY    = os.getenv("CHUTES_API_KEY", "")
MODEL      = os.getenv("CHUTES_MODEL", "deepseek-ai/DeepSeek-V3-0324")
TIMEOUT    = int(os.getenv("CHUTES_TIMEOUT_SECONDS", "60"))

HEADERS = {
    "Authorization": f"Bearer {API_KEY}" if API_KEY else "",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

def _post(payload: Dict[str, Any]) -> Dict[str, Any]:
    """POST to Chutes with basic retry. Raises on final failure."""
    url = f"{BASE_URL}{PATH}"
    last_err = None
    for attempt in range(2):
        try:
            resp = requests.post(url, headers=HEADERS, data=json.dumps(payload), timeout=TIMEOUT)
            if resp.status_code >= 200 and resp.status_code < 300:
                return resp.json()
            last_err = RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")
        except Exception as e:
            last_err = e
        time.sleep(0.7)
    raise last_err if last_err else RuntimeError("Unknown LLM error")

def _ensure_messages(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    out = []
    for m in messages:
        role = m.get("role", "user")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        out.append({"role": role, "content": content})
    return out or [{"role": "user", "content": "Hello"}]

def chat(messages: List[Dict[str, str]], *, temperature: float = 0.2,
         max_tokens: int = 400, top_p: float = 1.0) -> str:
    """
    OpenAI-style chat() -> returns assistant content.
    messages: [{role: "system"|"user"|"assistant", content: "..."}]
    """
    if not (BASE_URL and API_KEY):
        raise RuntimeError("CHUTES env not set (BASE_URL/API_KEY).")
    payload = {
        "model": MODEL,
        "messages": _ensure_messages(messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
        "top_p": top_p,
        "stream": False,
    }
    data = _post(payload)
    try:
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return json.dumps(data)

def complete(prompt: str, *, system: Optional[str] = None,
             max_tokens: int = 400, temperature: float = 0.2) -> str:
    """
    Convenience wrapper used by your endpoints.
    """
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    return chat(msgs, temperature=temperature, max_tokens=max_tokens)
