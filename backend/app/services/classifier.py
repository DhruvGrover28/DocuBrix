from __future__ import annotations

import os
import pickle
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ClassificationResult:
    document_type: str
    method: str
    model_name: str | None = None
    model_version: str | None = None
    confidence: float | None = None
    status: str = "classified"
    classified_at: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _heuristic_label(raw_text: str) -> str:
    normalized = raw_text.lower()
    scores = {"invoice": 0, "receipt": 0, "bank_statement": 0}
    markers = {
        "invoice": ("invoice", "bill to", "vendor", "customer", "amount due", "total due", "balance due", "tax due"),
        "receipt": ("receipt", "payment received", "cash receipt", "subtotal", "tax", "total paid", "change"),
        "bank_statement": ("bank statement", "account", "statement", "beginning balance", "ending balance", "transaction", "debit", "credit", "checking", "savings"),
    }
    for label, words in markers.items():
        scores[label] = sum(2 for word in words if word in normalized)
    if "invoice" in normalized:
        scores["invoice"] += 2
    if "receipt" in normalized:
        scores["receipt"] += 2
    if re.search(r"\b(?:checking|savings|credit|debit|balance)\b", normalized):
        scores["bank_statement"] += 1
    label = max(scores, key=scores.get)
    return label if scores[label] else "other_financial_document"


def _load_model(path: Path) -> dict[str, Any] | None:
    resolved = path
    if not resolved.is_absolute():
        try:
            from backend.app.config import BASE_DIR
            resolved = BASE_DIR / resolved
        except Exception:
            resolved = Path.cwd() / resolved
    if not resolved.exists():
        return None
    try:
        with resolved.open("rb") as model_file:
            artifact = pickle.load(model_file)
        if not isinstance(artifact, dict) or not {"vectorizer", "classifier"}.issubset(artifact):
            return None
        return artifact
    except (OSError, pickle.PickleError, ValueError, ImportError, AttributeError, EOFError, KeyError):
        return None


def classify_document_result(raw_text: str) -> ClassificationResult:
    timestamp = datetime.now(timezone.utc).isoformat()
    cleaned = (raw_text or "").strip()
    if not cleaned:
        return ClassificationResult(
            document_type="unknown",
            method="unknown",
            model_name=None,
            model_version=None,
            confidence=None,
            status="unknown",
            classified_at=timestamp,
        )

    model_path = Path(os.getenv("DOCUBRIX_CLASSIFIER_PATH", "backend/models/document_classifier.pkl"))
    artifact = _load_model(model_path)

    if artifact is not None:
        try:
            vectorizer = artifact["vectorizer"]
            classifier = artifact["classifier"]
            vector = vectorizer.transform([cleaned])
            predicted_label = str(classifier.predict(vector)[0])
            confidence = None
            if hasattr(classifier, "predict_proba"):
                probabilities = classifier.predict_proba(vector)[0]
                confidence = round(float(max(probabilities)), 4)
            return ClassificationResult(
                document_type=predicted_label,
                method="ml",
                model_name=str(artifact.get("model_name", "tfidf-logistic-regression")),
                model_version=str(artifact.get("model_version", "1.0.0")),
                confidence=confidence,
                status="classified",
                classified_at=timestamp,
            )
        except Exception:
            pass

    heuristic = _heuristic_label(cleaned)
    status = "fallback" if heuristic != "other_financial_document" else "fallback_unmatched"
    return ClassificationResult(
        document_type=heuristic,
        method="heuristic_fallback",
        model_name=None,
        model_version=None,
        confidence=None,
        status=status,
        classified_at=timestamp,
    )
