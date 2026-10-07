from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


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
    return [term.lower() for term in question.split() if len(term.strip()) > 2]


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
