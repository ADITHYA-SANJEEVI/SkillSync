# app/services/llm_client.py
from __future__ import annotations
import json, time
from typing import List, Dict, Any, Tuple
import requests
from requests.adapters import HTTPAdapter, Retry
from app.core.config import settings


def _normalize_messages(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Coerce non-standard roles to OpenAI roles."""
    out: List[Dict[str, str]] = []
    for m in messages or []:
        role = m.get("role", "user")
        if role not in {"system", "user", "assistant"}:
            role = "user"
        out.append({"role": role, "content": m.get("content", "")})
    return out


def _extract_content(data: Dict[str, Any]) -> str:
    """
    Try multiple shapes:
      - OpenAI/compatible: choices[0].message.content
      - Some gateways: output_text
      - Fallback: dump JSON
    """
    try:
        c = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        if c:
            return c
    except Exception:
        pass
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    return json.dumps(data)


class LLMClient:
    def __init__(self):
        self.base_url = settings.CHUTES_BASE_URL.rstrip("/")
        self.path = settings.CHUTES_COMPLETIONS_PATH  # guaranteed to start with "/" from config
        self.model = settings.CHUTES_MODEL
        self.api_key = settings.CHUTES_API_KEY
        self.timeout = int(settings.CHUTES_TIMEOUT_SECONDS)

        # Reusable HTTP session with sane retries on idempotent errors
        self.session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=0.6,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset(["POST"]),
        )
        self.session.mount("https://", HTTPAdapter(max_retries=retries))
        self.session.mount("http://", HTTPAdapter(max_retries=retries))

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    # ---------- Public: simple text API (keeps your old return type) ----------
    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.2, max_retries: int = 3) -> str:
        """
        Backwards-compatible: returns just the text (or mock/error string).
        """
        result = self.chat_full(messages=messages, temperature=temperature, max_retries=max_retries)
        # Truncate to avoid gigantic payloads hitting DB/UI
        return (result["content"] or result.get("error", "") or "").strip()[:4000] or "LLM: empty response."

    # ---------- Public: richer response for APIs ----------
    def chat_full(self, messages: List[Dict[str, str]], temperature: float = 0.2, max_retries: int = 3) -> Dict[str, Any]:
        """
        Returns a dict with content, flags, http status, latency, etc.
        {
          content: str,
          llm_used: bool,
          status: int,
          latency_ms: int,
          model: str,
          raw: dict | None,
          error: str | None,
        }
        """
        if not self.enabled:
            last = (messages or [{}])[-1].get("content", "")
            return {
                "content": f"⚠️ [Mock LLM] No CHUTES_API_KEY set. Preview: {last[:300]}",
                "llm_used": False,
                "status": 200,
                "latency_ms": 0,
                "model": self.model,
                "raw": None,
                "error": None,
            }

        url = f"{self.base_url}{self.path}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": _normalize_messages(messages),
            "temperature": float(temperature),
        }

        delay = 0.8
        start = time.perf_counter()

        for attempt in range(1, max_retries + 1):
            try:
                resp = self.session.post(url, headers=headers, json=payload, timeout=self.timeout)
                latency_ms = int((time.perf_counter() - start) * 1000)

                if resp.status_code == 200:
                    data = resp.json()
                    text = _extract_content(data)
                    return {
                        "content": text,
                        "llm_used": True,
                        "status": 200,
                        "latency_ms": latency_ms,
                        "model": data.get("model", self.model),
                        "raw": data,
                        "error": None,
                    }

                # Retry on transient codes; otherwise return error now
                if resp.status_code in (429, 500, 502, 503, 504) and attempt < max_retries:
                    time.sleep(delay)
                    delay *= 2
                    continue

                return {
                    "content": "",
                    "llm_used": True,
                    "status": resp.status_code,
                    "latency_ms": latency_ms,
                    "model": self.model,
                    "raw": None,
                    "error": f"LLM error {resp.status_code}: {resp.text[:400]}",
                }

            except requests.RequestException as e:
                if attempt < max_retries:
                    time.sleep(delay)
                    delay *= 2
                    continue
                latency_ms = int((time.perf_counter() - start) * 1000)
                return {
                    "content": "",
                    "llm_used": True,
                    "status": 599,
                    "latency_ms": latency_ms,
                    "model": self.model,
                    "raw": None,
                    "error": f"LLM request failed: {e}",
                }

        # Shouldn’t reach here due to returns above
        latency_ms = int((time.perf_counter() - start) * 1000)
        return {
            "content": "",
            "llm_used": True,
            "status": 599,
            "latency_ms": latency_ms,
            "model": self.model,
            "raw": None,
            "error": "LLM: all retries failed.",
        }


llm = LLMClient()
