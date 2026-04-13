import os, httpx

CHUTES_API_KEY = os.getenv("CHUTES_API_KEY")
CHUTES_BASE_URL = os.getenv("CHUTES_BASE_URL", "https://llm.chutes.ai")
CHUTES_PATH = os.getenv("CHUTES_COMPLETIONS_PATH", "/v1/chat/completions")
CHUTES_MODEL = os.getenv("CHUTES_MODEL", "deepseek-ai/DeepSeek-V3-0324")
CHUTES_TIMEOUT = int(os.getenv("CHUTES_TIMEOUT_SECONDS", "60"))

class ChutesError(Exception):
    pass


def llm_complete(
    prompt: str | None = None,
    *,
    messages: list[dict] | None = None,
    temperature: float = 0.2,
    max_tokens: int = 512,
) -> str:
    """
    Send either a raw `prompt` or a list of `messages` to Chutes.ai LLM.
    Compatible with both /prompt and /ml routes.
    """
    if not CHUTES_API_KEY:
        raise ChutesError("Missing CHUTES_API_KEY in environment")

    headers = {
        "Authorization": f"Bearer {CHUTES_API_KEY}",
        "Content-Type": "application/json",
    }

    # Build body depending on input type
    if messages:
        body = {"model": CHUTES_MODEL, "temperature": temperature, "max_tokens": max_tokens, "messages": messages}
    elif prompt:
        body = {
            "model": CHUTES_MODEL,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
    else:
        raise ChutesError("Neither `prompt` nor `messages` provided")

    url = f"{CHUTES_BASE_URL.rstrip('/')}{CHUTES_PATH}"

    try:
        with httpx.Client(timeout=CHUTES_TIMEOUT) as client:
            r = client.post(url, headers=headers, json=body)
        if r.status_code >= 400:
            raise ChutesError(f"HTTP {r.status_code}: {r.text}")
        data = r.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print("🔥 CHUTES REQUEST FAILED:", repr(e))
        raise ChutesError(str(e))
