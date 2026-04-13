# app/utils.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence, Tuple, Optional
import math
import re
from collections import Counter, defaultdict

# ---- Optional TF-IDF (scikit-learn). We fallback if unavailable. ----------------
try:
    from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore
    _HAS_SKLEARN = True
except Exception:
    _HAS_SKLEARN = False

# ==============================================================================
# Tokenization / Normalization
# ==============================================================================

# Keep tech-y tokens, including dots/plus/hyphen for things like "c++", ".net", "node.js", "power-bi"
_TOKEN_RE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9.+\-_/]*")

# Very lightweight stoplist – extend when you see noise
_STOP = {
    "and", "or", "the", "a", "an", "to", "of", "in", "on", "for", "with", "using",
    "is", "are", "be", "as", "by", "we", "you", "they", "our", "their",
    "must", "should", "nice", "plus", "good", "strong", "solid",
    "experience", "experiences", "knowledge", "tools", "tool",
    "developer", "engineer", "analyst", "analysis", "position", "role", "team",
    "based", "etc", "etc.", "etcetera",
}

# Curated canonical skill lexicon: synonyms/variants → canonical label
# Add as you encounter more.
SKILL_LEXICON: Dict[str, str] = {
    "aws": "aws",
    "amazon": "aws",
    "amazon-web-services": "aws",
    "amazon web services": "aws",

    "gcp": "gcp",
    "google-cloud": "gcp",
    "google cloud": "gcp",

    "azure": "azure",
    "microsoft-azure": "azure",

    "sql": "sql",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "mysql": "mysql",
    "sqlite": "sqlite",

    "python": "python",
    "py": "python",

    "pandas": "pandas",
    "numpy": "numpy",
    "np": "numpy",

    "scikit-learn": "scikit-learn",
    "sklearn": "scikit-learn",

    "matplotlib": "matplotlib",
    "seaborn": "seaborn",

    "tableau": "tableau",
    "powerbi": "power-bi",
    "power-bi": "power-bi",
    "power bi": "power-bi",

    "docker": "docker",
    "k8s": "kubernetes",
    "kubernetes": "kubernetes",

    "git": "git",
    "github": "github",
    "gitlab": "gitlab",

    "js": "javascript",
    "javascript": "javascript",
    "ts": "typescript",
    "typescript": "typescript",
    "node": "nodejs",
    "nodejs": "nodejs",
    "node.js": "nodejs",
    "react": "react",
    "reactjs": "react",
    "react.js": "react",

    ".net": ".net",
    "dotnet": ".net",
    "c#": "csharp",
    "csharp": "csharp",
    "c++": "cpp",
    "cpp": "cpp",
}

# Phrases to retain as bigrams (token tuples) → canonical label
# These get a small score boost to keep important concepts intact.
PHRASES: Dict[Tuple[str, str], str] = {
    ("machine", "learning"): "machine-learning",
    ("deep", "learning"): "deep-learning",
    ("data", "science"): "data-science",
    ("data", "engineering"): "data-engineering",
    ("data", "visualization"): "data-visualization",
    ("power", "bi"): "power-bi",
    ("sql", "server"): "sql-server",
    ("amazon", "web"): "aws",           # handles "amazon web services"
    ("web", "services"): "aws",
}

def _normalize_token(t: str) -> str:
    t = t.strip().lower()
    # unify some common punctuation variants
    t = t.replace(" ", "-")
    return SKILL_LEXICON.get(t, t)

def _tokenize(text: str) -> List[str]:
    if not text:
        return []
    toks = [m.group(0).lower() for m in _TOKEN_RE.finditer(text)]
    # Split obvious dotted tech names into simpler variants too
    expanded: List[str] = []
    for tok in toks:
        if tok in {".", "-", "_"}:
            continue
        expanded.append(tok)
        # Add variants for certain forms (e.g., "node.js" → "nodejs")
        if "." in tok:
            compact = tok.replace(".", "")
            if compact not in expanded:
                expanded.append(compact)
    # filter stopwords & trivial length
    return [t for t in expanded if t not in _STOP and len(t) > 1]

def _extract_phrases(tokens: Sequence[str]) -> List[str]:
    out: List[str] = []
    for i in range(len(tokens) - 1):
        pair = (tokens[i], tokens[i + 1])
        if pair in PHRASES:
            out.append(PHRASES[pair])
    return out

# ==============================================================================
# Ranking logic
# ==============================================================================

@dataclass
class TopTermsConfig:
    use_tfidf: bool = True             # try TF-IDF if sklearn is present
    include_bigrams: bool = True       # add phrase features (PHRASES) as extra tokens
    top_k: int = 25
    bigram_boost: float = 1.3          # boost factor in fallback mode for bigrams
    min_token_len: int = 2

def _prepare_docs(job_texts: Iterable[str], include_bigrams: bool) -> List[List[str]]:
    """
    Tokenize/normalize job texts into per-doc token lists.
    When include_bigrams is True, phrase features are added as extra tokens.
    """
    docs: List[List[str]] = []
    for raw in (job_texts or []):
        if not raw or not raw.strip():
            continue
        toks = _tokenize(raw)
        toks = [t for t in toks if len(t) >= 2]
        if include_bigrams:
            toks += _extract_phrases(toks)
        # canonicalize
        toks = [_normalize_token(t) for t in toks]
        docs.append(toks)
    return docs

def _tfidf_top_terms(docs: List[List[str]], top_k: int) -> List[str]:
    """
    Rank by max TF-IDF across docs (robust & proven).
    """
    if not docs:
        return []

    # Build "documents" as space-joined tokens
    texts = [" ".join(doc) for doc in docs if doc]
    if not texts:
        return []

    vec = TfidfVectorizer(
        analyzer="word",
        token_pattern=r"(?u)\b\w[\w.+\-_/]*\b",
        lowercase=False,
        ngram_range=(1, 1),
        min_df=1,
    )
    X = vec.fit_transform(texts)  # sparse
    # max per feature across docs
    scores = X.max(axis=0).toarray().ravel()   # <-- avoids .A1 bug
    vocab = vec.get_feature_names_out()

    # Merge canonical synonyms: sum scores for same canonical term
    merged: Dict[str, float] = defaultdict(float)
    for idx, term in enumerate(vocab):
        canon = _normalize_token(term)
        merged[canon] += float(scores[idx])

    ranked = sorted(merged.items(), key=lambda kv: kv[1], reverse=True)
    return [t for t, _ in ranked[:top_k] if t]

def _fallback_top_terms(docs: List[List[str]], top_k: int, bigram_boost: float) -> List[str]:
    """
    No sklearn? Use a robust frequency counter with a small bigram boost.
    """
    if not docs:
        return []

    c = Counter()
    for doc in docs:
        # frequency per doc (binary presence => less bias by long postings)
        seen = set(doc)
        for t in seen:
            c[t] += 1

    # gentle boost for phrases
    boosted: Dict[str, float] = {t: float(n) for t, n in c.items()}
    for doc in docs:
        for phrase in _extract_phrases(doc):
            boosted[phrase] = boosted.get(phrase, 0.0) + bigram_boost

    ranked = sorted(boosted.items(), key=lambda kv: kv[1], reverse=True)
    return [t for t, _ in ranked[:top_k] if t]

# ==============================================================================
# Public API
# ==============================================================================

def get_top_terms(
    job_texts: List[str],
    top_k: int = 25,
    use_tfidf: bool = True,
    include_bigrams: bool = True,
) -> List[str]:
    """
    Robust keyword/skill extraction across job descriptions.
    - Cleans & canonicalizes tokens (lexicon)
    - Optionally adds bigrams (PHRASES)
    - Uses TF-IDF if sklearn available (and use_tfidf=True), otherwise a good fallback
    - Returns a simple ranked list of skill strings
    """
    cfg = TopTermsConfig(use_tfidf=use_tfidf, include_bigrams=include_bigrams, top_k=top_k)
    docs = _prepare_docs(job_texts, include_bigrams=cfg.include_bigrams)
    if not docs:
        return []

    if cfg.use_tfidf and _HAS_SKLEARN:
        try:
            return _tfidf_top_terms(docs, cfg.top_k)
        except Exception:
            # Safety net: never crash the API – fallback gracefully
            pass

    return _fallback_top_terms(docs, cfg.top_k, cfg.bigram_boost)

# Optional: richer output if you ever want debugging/inspection in Swagger.
def get_top_terms_debug(
    job_texts: List[str],
    top_k: int = 25,
    use_tfidf: bool = True,
    include_bigrams: bool = True,
) -> Dict[str, object]:
    docs = _prepare_docs(job_texts, include_bigrams=include_bigrams)
    method = "tfidf" if (use_tfidf and _HAS_SKLEARN) else "fallback"
    terms = get_top_terms(job_texts, top_k=top_k, use_tfidf=use_tfidf, include_bigrams=include_bigrams)
    return {
        "method": method,
        "top_terms": terms,
        "doc_count": len(docs),
        "docs_preview": [" ".join(d[:30]) for d in docs[:3]],
    }

# ==============================================================================
# File/Text helper + lightweight PDF extraction
# ==============================================================================

from io import BytesIO
try:
    # Only used for type hints at runtime
    from fastapi import UploadFile  # type: ignore
except Exception:
    UploadFile = None  # allows utils to be imported outside FastAPI contexts

def extract_text_from_pdf_bytes(data: bytes) -> str:
    # 1) pypdf (preferred)
    try:
        from pypdf import PdfReader  # modern fork
        reader = PdfReader(BytesIO(data))
        pages = []
        for p in reader.pages:
            try:
                pages.append(p.extract_text() or "")
            except Exception:
                pages.append("")
        txt = "\n".join(pages).strip()
        if txt:
            return txt
    except Exception:
        pass

    # 2) PyPDF2 (legacy)
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(BytesIO(data))
        pages = []
        for p in reader.pages:
            try:
                pages.append(p.extract_text() or "")
            except Exception:
                pages.append("")
        txt = "\n".join(pages).strip()
        if txt:
            return txt
    except Exception:
        pass

    # 3) pdfminer.six
    try:
        from pdfminer.high_level import extract_text
        txt = extract_text(BytesIO(data)).strip()
        if txt:
            return txt
    except Exception:
        pass

    raise ValueError(
        "Could not extract text from PDF. Install 'pypdf' or 'pdfminer.six', "
        "or provide plain text instead."
    )

async def read_text_or_file(text: Optional[str], file: Optional["UploadFile"]) -> str:
    """
    Returns text from either a provided text field or an uploaded file.
    Supports: PDF (application/pdf) and TXT (text/plain).
    """
    if text and text.strip():
        return text.strip()

    if file is None:
        raise ValueError("Provide either 'text' or upload a 'file'.")

    # Read file content once
    data = await file.read()
    ct = (file.content_type or "").lower()

    if ct == "application/pdf" or file.filename.lower().endswith(".pdf"):
        out = extract_text_from_pdf_bytes(data)
        if not out.strip():
            raise ValueError("No readable text found in the uploaded PDF.")
        return out

    if ct.startswith("text/") or file.filename.lower().endswith((".txt", ".log", ".csv", ".md")):
        try:
            return data.decode("utf-8", errors="ignore").strip()
        except Exception:
            # Last-resort decoding
            return data.decode("latin-1", errors="ignore").strip()

    raise ValueError(f"Unsupported file type: {file.content_type}. Use PDF or TXT.")
