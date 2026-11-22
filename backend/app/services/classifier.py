from __future__ import annotations

import os
import pickle
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DOCUMENT_CATEGORY_MAP: dict[str, str] = {
    # Financial
    "invoice": "Financial",
    "receipt": "Financial",
    "bank_statement": "Financial",
    "salary_slip": "Financial",
    "other_financial_document": "Financial",
    # Academic
    "academic_transcript": "Academic",
    "academic_certificate": "Academic",
    # Legal
    "legal_contract": "Legal",
    "non_disclosure_agreement": "Legal",
    # Medical
    "medical_prescription": "Medical",
    "medical_lab_report": "Medical",
    # Administrative
    "identity_document": "Administrative",
    "official_notice": "Administrative",
    # General
    "other_document": "General",
    "unknown": "General",
}


@dataclass(frozen=True)
class ClassificationResult:
    document_type: str
    category: str = "General"
    method: str = "heuristic_fallback"
    model: str | None = None
    model_name: str | None = None
    model_version: str | None = None
    confidence: float | None = None
    status: str = "fallback"
    classified_at: str = ""
    scores: dict[str, float] | None = None

    def as_dict(self) -> dict[str, Any]:
        data = asdict(self)
        if not data.get("model") and self.model_name:
            data["model"] = f"{self.model_name}:{self.model_version}" if self.model_version else self.model_name
        return data


MARKERS: dict[str, tuple[str, ...]] = {
    "salary_slip": (
        "salary slip", "payslip", "pay slip", "gross salary", "net salary", "basic salary",
        "basic pay", "gross earnings", "net earnings", "deductions", "provident fund", "pf deduction", "employee id",
        "pay period", "month of pay", "ctc", "take home", "hra", "da", "conveyance",
    ),
    "invoice": (
        "tax invoice", "commercial invoice", "invoice no", "invoice #", "bill to",
        "vendor", "invoice date", "amount due", "total due", "balance due",
        "tax due", "subtotal", "gstin", "vat", "remit to", "payment terms", "due date",
    ),
    "receipt": (
        "sales receipt", "cash receipt", "payment receipt", "payment received", "total paid",
        "amount paid", "change returned", "cash tendered", "pos terminal", "card ending",
        "subtotal", "tax", "store #", "merchant", "thank you for your purchase",
    ),
    "bank_statement": (
        "bank statement", "account statement", "account number", "account summary", "beginning balance",
        "ending balance", "opening balance", "closing balance", "transaction history", "debit",
        "credit", "checking account", "savings account", "branch code", "ifsc", "swift",
    ),
    "academic_transcript": (
        "transcript of records", "marksheet", "mark sheet", "grade card", "academic record",
        "semester", "cumulative gpa", "cgpa", "sgpa", "gpa", "credits earned", "credits registered",
        "roll no", "roll number", "enrollment no", "registration number", "course code",
        "marks obtained", "grade point", "examination", "provisional certificate",
    ),
    "academic_certificate": (
        "conferred upon", "hereby certifies that", "certificate of graduation", "degree of",
        "diploma in", "bachelor of", "master of", "doctor of philosophy", "has successfully completed",
        "in witness whereof", "seal of the university", "academic council", "chancellor",
        "vice chancellor", "dean of academic",
    ),
    "non_disclosure_agreement": (
        "non-disclosure agreement", "nda", "confidentiality agreement", "confidential information",
        "disclosing party", "receiving party", "proprietary information", "non-disclosure",
        "trade secret", "recipient agrees", "obligation of confidentiality",
    ),
    "legal_contract": (
        "agreement between", "master services agreement", "terms and conditions", "parties hereto",
        "herein represented", "effective date", "governing law", "jurisdiction", "indemnification",
        "severability", "termination clause", "in witness whereof", "force majeure",
        "warranties and representations", "obligations of contractor",
    ),
    "medical_prescription": (
        "prescription", "rx", "dr.", "doctor", "patient name", "age/gender", "age / sex",
        "dosage", "mg", "tablet", "capsule", "syrup", "take once daily", "take twice daily",
        "after meals", "before meals", "dispense", "clinic", "hospital", "consultation date",
    ),
    "medical_lab_report": (
        "laboratory report", "diagnostic report", "pathology report", "lab investigation",
        "test name", "observed value", "reference range", "reference interval", "specimen type",
        "sample collected", "haematology", "biochemistry", "urine analysis", "blood test",
        "clinical notes", "pathologist",
    ),
    "identity_document": (
        "identity card", "national id", "passport", "driving licence", "driver license",
        "voter id", "date of birth", "dob", "nationality", "place of birth", "gender",
        "identification no", "issuing authority", "expiry date", "valid until",
    ),
    "official_notice": (
        "official notice", "office memorandum", "circular", "public notification",
        "reference no", "to all staff", "order no", "competent authority", "issued by",
        "gazette notification", "administrative order",
    ),
    "other_document": (
        "curriculum vitae", "resume", "work experience", "professional summary",
        "technical skills", "projects & certifications", "hiring manager", "dear hiring",
        "sincerely", "cover letter", "to whom it may concern", "job application",
    ),
}

ANCHORS: dict[str, list[str]] = {
    "salary_slip": [r"\b(?:salary\s*slip|payslip|pay\s*slip)\b", r"\b(?:net\s*pay|gross\s*pay)\b"],
    "invoice": [r"\binvoice\b", r"\bbill\s*to\b", r"\binv(?:oice)?\s*#?\s*\d+"],
    "receipt": [r"\breceipt\b", r"\btotal\s*paid\b", r"\bcash\s*receipt\b"],
    "bank_statement": [r"\bbank\s*statement\b", r"\baccount\s*statement\b", r"\b(?:opening|ending|beginning|closing)\s*balance\b"],
    "academic_transcript": [r"\b(?:transcript|marksheet|mark\s*sheet|grade\s*card)\b", r"\b(?:cgpa|sgpa|semester)\b"],
    "academic_certificate": [r"\b(?:hereby\s*certifies|conferred\s*upon|degree\s*of)\b"],
    "non_disclosure_agreement": [r"\b(?:non-disclosure|confidentiality\s*agreement|nda)\b"],
    "legal_contract": [r"\b(?:agreement|contract)\b", r"\b(?:governing\s*law|parties\s*hereto)\b"],
    "medical_prescription": [r"\b(?:prescription|rx)\b", r"\b(?:patient\s*name|dosage)\b"],
    "medical_lab_report": [r"\b(?:lab(?:oratory)?\s*report|pathology|reference\s*(?:range|interval))\b"],
    "identity_document": [r"\b(?:identity\s*card|passport|driving\s*licen[sc]e|voter\s*id)\b", r"\bdate\s*of\s*birth\b"],
    "official_notice": [r"\b(?:office\s*memorandum|circular|official\s*notice)\b"],
    "other_document": [
        r"\b(?:curriculum\s*vitae|resume|c\.?v\.?)\b",
        r"\b(?:professional\s*summary|work\s*experience|technical\s*skills)\b",
        r"\b(?:dear\s*(?:hiring|team|mr\.|ms\.)|to\s*whom\s*it\s*may\s*concern)\b",
    ],
}


def _heuristic_label_and_confidence(raw_text: str) -> tuple[str, str, float, dict[str, float]]:
    normalized = raw_text.lower()
    raw_scores: dict[str, float] = {doc_type: 0.0 for doc_type in MARKERS}

    for doc_type, markers in MARKERS.items():
        for marker in markers:
            if marker in normalized:
                raw_scores[doc_type] += 2.0

        for pattern in ANCHORS.get(doc_type, []):
            if re.search(pattern, normalized, re.IGNORECASE):
                raw_scores[doc_type] += 3.5

    # Specific disambiguations
    if "payslip" in normalized or "salary slip" in normalized or "net salary" in normalized:
        raw_scores["salary_slip"] += 4.0
        # Lower invoice/receipt confusion if salary slip anchors exist
        raw_scores["invoice"] *= 0.5
        raw_scores["receipt"] *= 0.5

    if "non-disclosure" in normalized or "confidentiality agreement" in normalized:
        raw_scores["non_disclosure_agreement"] += 4.0

    if "prescription" in normalized or re.search(r"\brx\b", normalized):
        raw_scores["medical_prescription"] += 4.0

    if "transcript" in normalized or "marksheet" in normalized or "grade card" in normalized:
        raw_scores["academic_transcript"] += 4.0

    # Suppress false salary slip matches if academic or project keywords exist
    academic_keywords = ("roll number", "enrollment", "b.tech", "semester", "student", "group member", "minor project", "university school")
    if any(k in normalized for k in academic_keywords):
        raw_scores["salary_slip"] = 0.0
        if "transcript" not in normalized and "marksheet" not in normalized:
            raw_scores["official_notice"] += 2.0

    # Disambiguate resumes, CVs, and cover letters to prevent misclassification as salary slip / financial
    resume_indicators = ("curriculum vitae", "resume", "work experience", "technical skills", "professional summary", "projects & certifications")
    financial_core = ("invoice no", "amount due", "bill to", "tax invoice", "subtotal", "payment received", "ending balance", "net salary", "gross pay", "payslip")
    if any(ind in normalized for ind in resume_indicators) and not any(fc in normalized for fc in financial_core):
        raw_scores["other_document"] += 8.0
        raw_scores["salary_slip"] = 0.0
        raw_scores["invoice"] = 0.0
        raw_scores["receipt"] = 0.0

    best_type = max(raw_scores, key=raw_scores.get)
    best_score = raw_scores[best_type]

    if best_score < 2.5:
        # Check if financial terminology is present to distinguish financial vs general documents
        financial_patterns = [
            r"\b(?:revenue|earnings|operating\s*income|ebitda|balance\s*sheet|cash\s*flow|dividend|equity)\b",
            r"\b(?:fiscal\s*year|fiscal\s*quarter|financial\s*(?:report|results?|summary|disclosure))\b",
            r"\b(?:investor\s*relations|shareholder|board\s*(?:financial|finance)|annual\s*report)\b",
            r"\bq[1-4]\s*(?:earnings|revenue|financial|fiscal)\b",
        ]
        is_financial = any(re.search(pat, normalized, re.IGNORECASE) for pat in financial_patterns)
        if is_financial:
            return "other_financial_document", "Financial", 0.50, raw_scores
        return "other_document", "General", 0.50, raw_scores

    total_positive = sum(s for s in raw_scores.values() if s > 0)
    score_ratio = best_score / total_positive if total_positive > 0 else 0.5
    calibrated_confidence = round(min(0.98, max(0.68, 0.65 + 0.33 * score_ratio)), 4)
    category = DOCUMENT_CATEGORY_MAP.get(best_type, "General")

    return best_type, category, calibrated_confidence, raw_scores


def _heuristic_label(raw_text: str) -> str:
    best_type, _, _, _ = _heuristic_label_and_confidence(raw_text)
    return best_type


_CACHED_MODEL: dict[str, Any] | None = None
_CACHED_MODEL_PATH: str | None = None
_CACHED_MODEL_MTIME: float | None = None


def _load_model(path: Path | str | None = None) -> dict[str, Any] | None:
    global _CACHED_MODEL, _CACHED_MODEL_PATH, _CACHED_MODEL_MTIME

    if path is None:
        path = Path(os.getenv("DOCUBRIX_CLASSIFIER_PATH", "backend/models/document_classifier.pkl"))
    elif isinstance(path, str):
        path = Path(path)

    resolved = path
    if not resolved.is_absolute():
        try:
            from backend.app.config import BASE_DIR
            resolved = BASE_DIR / resolved
        except Exception:
            resolved = Path.cwd() / resolved

    if not resolved.exists():
        _CACHED_MODEL = None
        _CACHED_MODEL_PATH = None
        _CACHED_MODEL_MTIME = None
        return None

    try:
        current_mtime = resolved.stat().st_mtime
        resolved_str = str(resolved)
        if (
            _CACHED_MODEL is not None
            and _CACHED_MODEL_PATH == resolved_str
            and _CACHED_MODEL_MTIME == current_mtime
        ):
            return _CACHED_MODEL

        with resolved.open("rb") as model_file:
            artifact = pickle.load(model_file)
        if not isinstance(artifact, dict) or not {"vectorizer", "classifier"}.issubset(artifact):
            return None

        _CACHED_MODEL = artifact
        _CACHED_MODEL_PATH = resolved_str
        _CACHED_MODEL_MTIME = current_mtime
        return artifact
    except (OSError, pickle.PickleError, ValueError, ImportError, AttributeError, EOFError, KeyError):
        return None


def load_classifier_model(path: Path | str | None = None) -> dict[str, Any] | None:
    """Explicitly load or reload the classifier model artifact."""
    return _load_model(path)


def classify_document_result(raw_text: str) -> ClassificationResult:
    timestamp = datetime.now(timezone.utc).isoformat()
    cleaned = (raw_text or "").strip()
    if not cleaned:
        return ClassificationResult(
            document_type="unknown",
            category="General",
            method="unknown",
            model=None,
            model_name=None,
            model_version=None,
            confidence=None,
            status="unknown",
            classified_at=timestamp,
            scores={},
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
            scores: dict[str, float] = {}
            if hasattr(classifier, "predict_proba"):
                probabilities = classifier.predict_proba(vector)[0]
                confidence = round(float(max(probabilities)), 4)
                if hasattr(classifier, "classes_"):
                    scores = {
                        str(cls_name): round(float(prob), 4)
                        for cls_name, prob in zip(classifier.classes_, probabilities)
                    }

            # Guardrail: prevent non-financial documents (e.g., resumes, cover letters) from being misclassified as Financial
            normalized = cleaned.lower()
            resume_markers = ("curriculum vitae", "resume", "professional summary", "work experience", "technical skills", "projects & certifications")
            financial_core = ("invoice no", "amount due", "bill to", "tax invoice", "subtotal", "payment received", "ending balance", "net salary", "gross pay", "payslip")
            if predicted_label in ("invoice", "receipt", "bank_statement", "salary_slip", "other_financial_document"):
                if any(m in normalized for m in resume_markers) and not any(f in normalized for f in financial_core):
                    predicted_label = "other_document"
                    confidence = scores.get("other_document", 0.92)

            model_name = str(artifact.get("model_name", "tfidf-logistic-regression"))
            model_ver = str(artifact.get("model_version", "1.0.0"))
            full_model_tag = f"{model_name}:{model_ver}"
            cat = DOCUMENT_CATEGORY_MAP.get(predicted_label, "General")

            return ClassificationResult(
                document_type=predicted_label,
                category=cat,
                method="ml",
                model=full_model_tag,
                model_name=model_name,
                model_version=model_ver,
                confidence=confidence,
                status="classified",
                classified_at=timestamp,
                scores=scores if scores else None,
            )
        except Exception:
            pass

    heuristic, category, _, raw_scores = _heuristic_label_and_confidence(cleaned)
    status = "fallback" if heuristic not in ("other_financial_document", "other_document") else "fallback_unmatched"
    return ClassificationResult(
        document_type=heuristic,
        category=category,
        method="heuristic_fallback",
        model=None,
        model_name=None,
        model_version=None,
        confidence=None,
        status=status,
        classified_at=timestamp,
        scores={k: round(v, 2) for k, v in raw_scores.items() if v > 0},
    )
