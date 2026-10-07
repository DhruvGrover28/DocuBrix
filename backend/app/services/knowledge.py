from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


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


def build_gemini_prompt(question: str, sources: list[dict[str, Any]]) -> str:
    context = "\n\n".join(
        f"[Source {index + 1}: {source['filename']} chunk {source['chunk_index']}]\n{source['content']}"
        for index, source in enumerate(sources)
    )
    return (
        "Answer the question only from the supplied document context. "
        "If the context does not contain the answer, say that it is unavailable. "
        "Do not invent facts or citations.\n\n"
        f"Question: {question}\n\nContext:\n{context}"
    )


def generate_grounded_answer(question: str, sources: list[dict[str, Any]]) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
    if not sources:
        return "The available documents do not contain enough information to answer this question."

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
