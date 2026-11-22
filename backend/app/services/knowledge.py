from __future__ import annotations

import json
import logging
import math
import os
import re
import urllib.error
import urllib.request
from typing import Any

logger = logging.getLogger("uvicorn.error")
if not logger.handlers and not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO)


def _clean_api_key(key: str | None) -> str:
    if not key:
        return ""
    return key.strip().strip("'\"").strip()


def get_gemini_api_key() -> str:
    return _clean_api_key(os.getenv("GEMINI_API_KEY"))


def get_embedding_api_key() -> str:
    key = _clean_api_key(os.getenv("EMBEDDING_API_KEY"))
    if key:
        return key
    return get_gemini_api_key()


def _sanitize_diagnostic_text(text: str, api_key: str | None = None) -> str:
    if not text:
        return ""
    sanitized = text
    cleaned_key = _clean_api_key(api_key)
    if cleaned_key:
        sanitized = sanitized.replace(cleaned_key, "[REDACTED_API_KEY]")
    if api_key and api_key.strip():
        sanitized = sanitized.replace(api_key.strip(), "[REDACTED_API_KEY]")
    # Redact Google API key format
    sanitized = re.sub(r"AIza[0-9A-Za-z-_]{35}", "[REDACTED_API_KEY]", sanitized)
    # Redact query param key=...
    sanitized = re.sub(r"([?&]key=)[^&\s]+", r"\1[REDACTED_KEY]", sanitized)
    # Redact key in JSON/headers
    sanitized = re.sub(
        r'("?(?:api[_-]?key|key|x-goog-api-key)"?\s*[:=]\s*"?[A-Za-z0-9_\-]+"?\b)',
        "[REDACTED_KEY]",
        sanitized,
        flags=re.IGNORECASE,
    )
    return sanitized



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
    return bool(get_embedding_api_key())


def is_llm_configured() -> bool:
    return bool(get_gemini_api_key())


def get_embedding(text: str) -> list[float]:
    api_key = get_embedding_api_key()
    model = os.getenv("EMBEDDING_MODEL", "gemini-embedding-2")
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    if not api_key:
        vec = [0.0] * 32
        for word in cleaned.lower().split():
            h = abs(hash(word)) % 32
            vec[h] += 1.0
        norm = math.sqrt(sum(x * x for x in vec))
        return [round(x / norm, 6) for x in vec] if norm > 0 else vec

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={api_key}"
    payload = json.dumps({
        "model": f"models/{model}",
        "content": {"parts": [{"text": cleaned[:2048]}]}
    }).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )
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
    filename_map: dict[str, str] | None = None,
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
            "filename": (
                filename_map.get(str(getattr(chunk, "document_id", "")), filename)
                if filename_map and str(getattr(chunk, "document_id", "")) in filename_map
                else getattr(chunk, "filename", filename)
            ),
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
    api_key = get_gemini_api_key()
    raw_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip()
    # Normalize model names: gemini-3.8-flash does not exist in Google API; map to gemini-1.5-flash
    model = "gemini-1.5-flash" if raw_model in ("gemini-3.8-flash", "gemini-pro-vision") or not raw_model else raw_model
    if not api_key:
        logger.error(
            "[Gemini Diagnostic] [missing_api_key] GEMINI_API_KEY environment variable is not configured."
        )
        raise RuntimeError("GEMINI_API_KEY is not configured")
    if not sources:
        return "The available document content does not contain enough information to answer this question."

    try:
        prompt = build_gemini_prompt(question, sources)
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
        request = urllib.request.Request(
            endpoint,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            method="POST",
        )
    except Exception as exc:
        logger.error(
            "[Gemini Diagnostic] [request_construction_error] Failed to construct Gemini request. Exception: %s, Message: %s, Model: %s",
            exc.__class__.__name__,
            _sanitize_diagnostic_text(str(exc), api_key),
            model,
        )
        raise RuntimeError("The configured Gemini service could not answer the question.") from exc

    raw_response_text = ""
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw_response_text = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        raw_error_body = ""
        try:
            raw_error_body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            raw_error_body = "<failed to read error response body>"
        truncated_body = raw_error_body[:1000] if len(raw_error_body) > 1000 else raw_error_body
        safe_body = _sanitize_diagnostic_text(truncated_body, api_key)
        logger.error(
            "[Gemini Diagnostic] [http_error] Gemini API returned HTTP %s (%s). Exception: %s, Model: %s, Endpoint: https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent, Body: %s",
            exc.code,
            exc.reason,
            exc.__class__.__name__,
            model,
            model,
            safe_body,
        )
        raise RuntimeError("The configured Gemini service could not answer the question.") from exc
    except TimeoutError as exc:
        logger.error(
            "[Gemini Diagnostic] [timeout_network_error] Gemini API request timed out after 60s. Exception: %s, Model: %s",
            exc.__class__.__name__,
            model,
        )
        raise RuntimeError("The configured Gemini service could not answer the question.") from exc
    except urllib.error.URLError as exc:
        safe_reason = _sanitize_diagnostic_text(str(getattr(exc, "reason", exc)), api_key)
        logger.error(
            "[Gemini Diagnostic] [timeout_network_error] Network connection error communicating with Gemini API. Exception: %s, Reason: %s, Model: %s",
            exc.__class__.__name__,
            safe_reason,
            model,
        )
        raise RuntimeError("The configured Gemini service could not answer the question.") from exc
    except Exception as exc:
        logger.error(
            "[Gemini Diagnostic] [timeout_network_error] Unexpected error communicating with Gemini API. Exception: %s, Message: %s, Model: %s",
            exc.__class__.__name__,
            _sanitize_diagnostic_text(str(exc), api_key),
            model,
        )
        raise RuntimeError("The configured Gemini service could not answer the question.") from exc

    try:
        body = json.loads(raw_response_text)
    except json.JSONDecodeError as exc:
        truncated_raw = raw_response_text[:1000] if len(raw_response_text) > 1000 else raw_response_text
        safe_raw = _sanitize_diagnostic_text(truncated_raw, api_key)
        logger.error(
            "[Gemini Diagnostic] [response_parsing_error] Failed to decode Gemini JSON response. Exception: %s: %s, Model: %s, Raw Response: %s",
            exc.__class__.__name__,
            str(exc),
            model,
            safe_raw,
        )
        raise RuntimeError("The configured Gemini service could not answer the question.") from exc

    candidates = body.get("candidates") or []
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    answer = "".join(str(part.get("text", "")) for part in parts).strip()
    if not answer:
        candidate_meta = {
            "finishReason": candidates[0].get("finishReason") if candidates else None,
            "safetyRatings": candidates[0].get("safetyRatings") if candidates else None,
            "promptFeedback": body.get("promptFeedback"),
        }
        logger.error(
            "[Gemini Diagnostic] [response_parsing_error] Gemini returned no usable answer text. Model: %s, Metadata: %s",
            model,
            json.dumps(candidate_meta),
        )
        raise RuntimeError("The configured Gemini service returned no grounded answer.")
    return answer


def build_chat_prompt(
    question: str,
    sources: list[dict[str, Any]],
    chat_history: list[dict[str, str]] | None = None,
) -> str:
    instructions = (
        "You are DocuBrix AI Assistant, an expert, articulate, and conversational document intelligence assistant.\n"
        "Your mission is to understand user questions thoroughly, explain concepts clearly, and provide comprehensive, structured answers like a top-tier LLM.\n\n"
        "Guidelines:\n"
        "1. Understand & Explain: Truly answer what the user is asking. If the user asks to summarize, provide a clean executive summary with key takeaways, parties, dates, amounts, and purpose. If they ask a specific question, explain the answer directly with helpful context.\n"
        "2. Natural, Engaging Tone: Speak naturally, professionally, and conversationally like a helpful AI assistant. Avoid robotic boilerplate, repetitive chunk dumping, or reciting raw text unedited.\n"
        "3. Document Fidelity: When stating document facts (numbers, dates, clauses, names, compliance rules), be strictly accurate based on the retrieved context. Do not invent numbers or facts not in the documents.\n"
        "4. Seamless Citing: Mention document names naturally in your prose (e.g. 'According to Apex Cloud Invoice #INV-2026-9810...') or use clean inline brackets like [invoice.pdf chunk 0].\n"
        "5. Multi-Turn Context: Use the conversation history to understand references ('it', 'that document', 'the earlier amount') and follow-ups naturally."
    )

    if sources:
        context_parts = []
        for index, source in enumerate(sources):
            context_parts.append(
                f"[Source {index + 1}: {source['filename']} chunk {source['chunk_index']}]\n{source['content']}"
            )
        context_str = "\n\n".join(context_parts)
    else:
        context_str = "No relevant document chunks found in user workspace."

    history_str = ""
    if chat_history:
        formatted_history = []
        for msg in chat_history:
            role = "User" if msg.get("role") == "user" else "Assistant"
            formatted_history.append(f"{role}: {msg.get('content', '')}")
        history_str = "\n\nRecent Conversation History:\n" + "\n".join(formatted_history)

    return (
        f"{instructions}\n\n"
        f"Retrieved Document Context:\n{context_str}"
        f"{history_str}\n\n"
        f"Current User Question: {question}\n\n"
        "Assistant Response:"
    )


def generate_chat_answer(
    question: str,
    sources: list[dict[str, Any]],
    chat_history: list[dict[str, str]] | None = None,
) -> str:
    api_key = get_gemini_api_key()
    configured_model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    if not api_key:
        logger.error(
            "[Gemini Diagnostic] [missing_api_key] GEMINI_API_KEY environment variable is not configured."
        )
        raise RuntimeError("GEMINI_API_KEY is not configured")

    prompt = build_chat_prompt(question, sources, chat_history=chat_history)

    # Build fallback model chain:
    # Try configured_model first (preserves test expectations), then fast reliable models if 503/404/timeout occurs
    models_to_try = [configured_model]
    for fallback in ("gemini-flash-lite-latest", "gemini-3.5-flash-lite"):
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    last_error: Exception | None = None
    for attempt_idx, model in enumerate(models_to_try):
        try:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
            request = urllib.request.Request(
                endpoint,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": api_key,
                },
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=12) as response:
                raw_response_text = response.read().decode("utf-8", errors="replace")

            try:
                body = json.loads(raw_response_text)
            except json.JSONDecodeError as exc:
                truncated_raw = raw_response_text[:1000] if len(raw_response_text) > 1000 else raw_response_text
                safe_raw = _sanitize_diagnostic_text(truncated_raw, api_key)
                logger.error(
                    "[Gemini Diagnostic] [response_parsing_error] Failed to decode Gemini chat JSON response. Exception: %s: %s, Model: %s, Raw Response: %s",
                    exc.__class__.__name__,
                    str(exc),
                    model,
                    safe_raw,
                )
                raise RuntimeError("The configured Gemini service could not answer the question.") from exc

            candidates = body.get("candidates") or []
            parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
            answer = "".join(str(part.get("text", "")) for part in parts).strip()
            if answer:
                return answer
        except urllib.error.HTTPError as exc:
            last_error = exc
            raw_error_body = ""
            try:
                raw_error_body = exc.read().decode("utf-8", errors="replace")
            except Exception:
                raw_error_body = "<failed to read error response body>"
            truncated_body = raw_error_body[:1000] if len(raw_error_body) > 1000 else raw_error_body
            safe_body = _sanitize_diagnostic_text(truncated_body, api_key)
            logger.error(
                "[Gemini Diagnostic] [http_error] Gemini API returned HTTP %s (%s). Exception: %s, Model: %s, Endpoint: https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent, Body: %s",
                exc.code,
                exc.reason,
                exc.__class__.__name__,
                model,
                model,
                safe_body,
            )
            # If the model is not found or experiencing 503 high demand spike, try fallback model
            if attempt_idx + 1 < len(models_to_try):
                continue
            raise RuntimeError("The configured Gemini service could not answer the question.") from exc
        except TimeoutError as exc:
            last_error = exc
            logger.error(
                "[Gemini Diagnostic] [timeout_network_error] Gemini API chat request timed out after 60s. Exception: %s, Model: %s",
                exc.__class__.__name__,
                model,
            )
            if attempt_idx + 1 < len(models_to_try):
                continue
            raise RuntimeError("The configured Gemini service could not answer the question.") from exc
        except Exception as exc:
            last_error = exc
            if isinstance(exc, RuntimeError):
                raise
            safe_reason = _sanitize_diagnostic_text(str(getattr(exc, "reason", exc)), api_key)
            logger.error(
                "[Gemini Diagnostic] [timeout_network_error] Network connection error communicating with Gemini API. Exception: %s, Reason: %s, Model: %s",
                exc.__class__.__name__,
                safe_reason,
                model,
            )
            if attempt_idx + 1 < len(models_to_try):
                continue
            raise RuntimeError("The configured Gemini service could not answer the question.") from exc

    raise RuntimeError("The configured Gemini service could not answer the question.") from last_error


def is_conversational_greeting(text: str) -> bool:
    """Return True if the user input is a casual conversational greeting, pleasantry, or intro."""
    clean = re.sub(r"[^\w\s]", "", (text or "").strip().lower())
    greetings = {
        "hi", "hello", "hey", "hola", "greetings", "good morning",
        "good evening", "good afternoon", "who are you", "what can you do",
        "help", "test", "thanks", "thank you", "how are you", "howdy", "sup"
    }
    if clean in greetings:
        return True
    return clean.startswith(("hi ", "hello ", "hey ", "help ", "greetings ", "good morning ", "good evening "))


def is_summarization_request(text: str) -> bool:
    """Return True if the user is asking for a summary, overview, breakdown, or key points."""
    clean = (text or "").strip().lower()
    patterns = [
        r"\bsummar(y|ize|ise|izing)\b",
        r"\boverview\b",
        r"\bbrief(ly)?\b",
        r"\bkey\s+points?\b",
        r"\bmain\s+(points?|takeaways?|ideas?)\b",
        r"\btldr\b",
        r"\bwhat\s+is\s+this\s+(document|file|doc)\s+about\b",
        r"\bexplain\s+this\s+(document|file|doc)\b",
        r"\bbreak\s*down\b",
        r"\bwalk\s+me\s+through\b",
    ]
    return any(re.search(pat, clean) for pat in patterns)


def generate_extractive_fallback(question: str, sources: list[dict[str, Any]]) -> str:
    """
    Deterministic grounded fallback when cloud generative LLM is rate-limited (429),
    offline, or unconfigured. Formats retrieved chunks directly with source citations.
    """
    if is_conversational_greeting(question):
        return (
            "Hello! I am DocuBrix AI Assistant, your intelligent document lifecycle and analytics assistant.\n\n"
            "I can help you search, summarize, extract information, and answer questions across all your uploaded documents "
            "(financial invoices, tax receipts, medical prescriptions, legal agreements, and academic transcripts).\n\n"
            "Feel free to ask me about specific payment amounts, dates, vendor details, or compliance requirements!"
        )

    if not sources:
        return (
            f"I searched your workspace across all indexed documents, but no relevant content matching '{question}' was found.\n\n"
            "Please ensure you have uploaded documents in the Document Processing section so I can analyze them for you."
        )

    parts = [
        "Based on your uploaded documents, here is the relevant extracted information:\n"
    ]
    for idx, s in enumerate(sources, 1):
        filename = s.get("filename", "Document")
        chunk_idx = s.get("chunk_index", 0)
        content = s.get("content", "").strip()
        snippet = content[:350] + ("..." if len(content) > 350 else "")
        parts.append(f"• **[{filename} — chunk {chunk_idx}]**\n  > {snippet}\n")

    parts.append("*(Note: Response grounded directly in verified workspace document chunks)*")
    return "\n".join(parts)

