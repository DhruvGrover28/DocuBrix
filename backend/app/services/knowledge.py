from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


import math
import re


def chunk_text(text: str, size: int = 700, overlap: int = 100) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(len(words), start + size)
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start = max(start + 1, end - overlap)
    return chunks


def query_terms(question: str) -> list[str]:
    tokens = re.findall(r"[A-Za-z0-9_\-\$]+", (question or "").lower())
    filtered = [term for term in tokens if len(term) >= 2]
    return filtered if filtered else [term for term in tokens if term]


def cosine_similarity(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return round(dot / (norm_a * norm_b), 6)


def is_embedding_configured() -> bool:
    return bool(os.getenv("EMBEDDING_API_KEY") or os.getenv("GEMINI_API_KEY"))


def is_llm_configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))


def get_embedding(text: str) -> list[float]:
    api_key = os.getenv("EMBEDDING_API_KEY") or os.getenv("GEMINI_API_KEY")
    model = os.getenv("EMBEDDING_MODEL", "text-embedding-004")
    if not api_key:
        raise RuntimeError("Embedding API key is not configured.")
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={api_key}"
    payload = json.dumps({
        "model": f"models/{model}",
        "content": {"parts": [{"text": cleaned[:2048]}]}
    }).encode("utf-8")
    request = urllib.request.Request(endpoint, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
            values = data.get("embedding", {}).get("values", [])
            return [round(float(v), 6) for v in values]
    except Exception as exc:
        raise RuntimeError(f"Embedding request failed: {exc}") from exc


def batch_embed_texts(texts: list[str]) -> list[list[float]]:
    embeddings: list[list[float]] = []
    for text in texts:
        if not text.strip():
            embeddings.append([])
            continue
        try:
            embeddings.append(get_embedding(text))
        except Exception:
            embeddings.append([])
    return embeddings


def extract_snippet(text: str, terms: list[str], max_len: int = 160) -> str:
    cleaned = (text or "").strip()
    if not cleaned:
        return ""
    if not terms:
        return cleaned[:max_len] + ("..." if len(cleaned) > max_len else "")

    lower_text = cleaned.lower()
    first_pos = -1
    matched_term = None
    for term in terms:
        clean_term = term.strip().lower()
        if not clean_term:
            continue
        pos = lower_text.find(clean_term)
        if pos != -1 and (first_pos == -1 or pos < first_pos):
            first_pos = pos
            matched_term = clean_term

    if first_pos == -1:
        return cleaned[:max_len] + ("..." if len(cleaned) > max_len else "")

    if len(cleaned) <= max_len:
        return cleaned

    term_len = len(matched_term or "")
    half = max(0, (max_len - term_len) // 2)
    start = max(0, first_pos - half)
    end = start + max_len
    if end > len(cleaned):
        end = len(cleaned)
        start = max(0, end - max_len)

    snippet = cleaned[start:end].strip()
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(cleaned) else ""
    return f"{prefix}{snippet}{suffix}"


def extract_highlighted_snippet(text: str, terms: list[str], max_len: int = 160) -> str:
    raw_snippet = extract_snippet(text, terms, max_len=max_len)
    if not terms or not raw_snippet:
        return raw_snippet
    valid_terms = [re.escape(t.strip()) for t in terms if t.strip()]
    if not valid_terms:
        return raw_snippet
    pattern = re.compile(f"({'|'.join(valid_terms)})", re.IGNORECASE)
    return pattern.sub(r"<mark>\1</mark>", raw_snippet)


def extract_excerpts(text: str, terms: list[str], max_excerpts: int = 3, max_len: int = 160) -> list[str]:
    cleaned = (text or "").strip()
    if not cleaned or not terms:
        return []
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    excerpts: list[str] = []
    seen: set[str] = set()
    for line in lines:
        lower_line = line.lower()
        if any(term.lower() in lower_line for term in terms if term.strip()):
            snippet = extract_highlighted_snippet(line, terms, max_len=max_len)
            if snippet and snippet not in seen:
                seen.add(snippet)
                excerpts.append(snippet)
                if len(excerpts) >= max_excerpts:
                    break
    if not excerpts:
        general_snippet = extract_highlighted_snippet(cleaned, terms, max_len=max_len)
        if general_snippet:
            excerpts.append(general_snippet)
    return excerpts


def rank_chunks_by_relevance(
    question: str,
    chunks: list[Any],
    filename: str = "document",
    top_k: int = 5,
) -> list[dict[str, Any]]:
    if not chunks:
        return []

    terms = query_terms(question)
    has_embeddings = any(bool(getattr(chunk, "embedding", None)) for chunk in chunks)
    query_emb = None

    if has_embeddings and is_embedding_configured():
        try:
            query_emb = get_embedding(question)
        except Exception:
            query_emb = None

    scored: list[tuple[Any, float, str]] = []
    for chunk in chunks:
        content = str(getattr(chunk, "content", "") or "")
        emb = getattr(chunk, "embedding", None)
        if query_emb and emb:
            sim = cosine_similarity(query_emb, emb)
            scored.append((chunk, sim, "semantic"))
        else:
            term_matches = sum(term in content.lower() for term in terms) if terms else 0
            scored.append((chunk, float(term_matches), "keyword"))

    scored.sort(key=lambda item: item[1], reverse=True)
    selected = scored[:top_k]

    return [
        {
            "document_id": getattr(chunk, "document_id", None),
            "filename": filename,
            "chunk_index": getattr(chunk, "chunk_index", 0),
            "content": getattr(chunk, "content", ""),
            "relevance_score": round(score, 4),
            "retrieval_method": method,
        }
        for chunk, score, method in selected
    ]


def build_gemini_prompt(question: str, sources: list[dict[str, Any]]) -> str:
    context = "\n\n".join(
        f"[Source {index + 1}: {source['filename']} chunk {source['chunk_index']}]\n{source['content']}"
        for index, source in enumerate(sources)
    )
    return (
        "Answer the question strictly from the supplied document context below. "
        "If the context does not contain enough information to answer, state clearly that the answer is unavailable in the document. "
        "Do not invent facts, numbers, or citations.\n\n"
        f"Question: {question}\n\nContext:\n{context}"
    )


def generate_grounded_answer(question: str, sources: list[dict[str, Any]]) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
    if not sources:
        return "The available document content does not contain enough information to answer this question."

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = json.dumps({"contents": [{"parts": [{"text": build_gemini_prompt(question, sources)}]}]}).encode("utf-8")
    request = urllib.request.Request(endpoint, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("The configured Gemini service could not answer the question.") from exc

    candidates = body.get("candidates") or []
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    answer = "".join(str(part.get("text", "")) for part in parts).strip()
    if not answer:
        raise RuntimeError("The configured Gemini service returned no grounded answer.")
    return answer
