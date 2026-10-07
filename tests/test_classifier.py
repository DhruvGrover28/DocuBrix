from __future__ import annotations

import csv
import json
import pickle
from pathlib import Path

import pytest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from backend.app.services.classifier import (
    ClassificationResult,
    _heuristic_label,
    _load_model,
    classify_document_result,
)
from backend.scripts.train_classifier import read_rows, train_and_evaluate


def test_classification_result_as_dict() -> None:
    result = ClassificationResult(
        document_type="invoice",
        method="heuristic_fallback",
        model_name=None,
        model_version=None,
        confidence=None,
        status="fallback",
        classified_at="2026-10-07T12:00:00Z",
    )
    data = result.as_dict()
    assert data["document_type"] == "invoice"
    assert data["method"] == "heuristic_fallback"
    assert data["confidence"] is None
    assert data["status"] == "fallback"
    assert data["model_name"] is None
    assert data["model_version"] is None


def test_heuristic_fallback_when_model_absent(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    # Ensure pointing to a non-existent model artifact path
    monkeypatch.setenv("DOCUBRIX_CLASSIFIER_PATH", str(tmp_path / "non_existent_model.pkl"))

    invoice_text = "INVOICE 1001\nVendor: Acme Labs\nTotal Due: $120.50\nDue Date: 2026-10-15"
    receipt_text = "RECEIPT\nPayment Received: $42.75\nSubtotal: $40.00\nTax: $2.75"
    statement_text = "BANK STATEMENT\nAccount: Checking 1234\nBeginning Balance: $1,000.00\nEnding Balance: $1,550.25"
    other_text = "Q3 earnings report\nRevenue up 12%\nBoard summary"

    res_inv = classify_document_result(invoice_text)
    assert res_inv.document_type == "invoice"
    assert res_inv.method == "heuristic_fallback"
    assert res_inv.confidence is None
    assert res_inv.model_name is None
    assert res_inv.model_version is None
    assert res_inv.status == "fallback"

    res_rec = classify_document_result(receipt_text)
    assert res_rec.document_type == "receipt"
    assert res_rec.method == "heuristic_fallback"
    assert res_rec.confidence is None

    res_stmt = classify_document_result(statement_text)
    assert res_stmt.document_type == "bank_statement"
    assert res_stmt.method == "heuristic_fallback"
    assert res_stmt.confidence is None

    res_oth = classify_document_result(other_text)
    assert res_oth.document_type == "other_financial_document"
    assert res_oth.method == "heuristic_fallback"
    assert res_oth.confidence is None
    assert res_oth.status == "fallback_unmatched"


def test_empty_or_whitespace_text_classification(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("DOCUBRIX_CLASSIFIER_PATH", str(tmp_path / "non_existent_model.pkl"))

    res_empty = classify_document_result("")
    assert res_empty.document_type == "unknown"
    assert res_empty.method == "unknown"
    assert res_empty.confidence is None
    assert res_empty.status == "unknown"

    res_whitespace = classify_document_result("   \n\t  ")
    assert res_whitespace.document_type == "unknown"
    assert res_whitespace.method == "unknown"
    assert res_whitespace.confidence is None
    assert res_whitespace.status == "unknown"


def test_corrupted_model_file_falls_back_gracefully(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    bad_model_path = tmp_path / "corrupted_model.pkl"
    bad_model_path.write_bytes(b"invalid pickle data here")

    monkeypatch.setenv("DOCUBRIX_CLASSIFIER_PATH", str(bad_model_path))

    invoice_text = "INVOICE 1001\nVendor: Acme Labs\nTotal Due: $120.50"
    res = classify_document_result(invoice_text)
    assert res.document_type == "invoice"
    assert res.method == "heuristic_fallback"
    assert res.confidence is None


def test_ml_model_inference_with_probability(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    # Build a minimal pipeline for testing loader & inference mechanics
    pipeline = Pipeline(
        [
            ("tfidf", TfidfVectorizer(lowercase=True)),
            ("classifier", LogisticRegression()),
        ]
    )
    texts = [
        "Invoice from Acme Labs total amount due",
        "Invoice for services rendered vendor amount due",
        "Receipt store payment received cash total",
        "Receipt coffee tax total paid",
    ]
    labels = ["invoice", "invoice", "receipt", "receipt"]
    pipeline.fit(texts, labels)

    model_artifact_path = tmp_path / "test_model.pkl"
    with model_artifact_path.open("wb") as f:
        pickle.dump(
            {
                "vectorizer": pipeline.named_steps["tfidf"],
                "classifier": pipeline.named_steps["classifier"],
                "model_name": "tfidf-logistic-regression",
                "model_version": "1.0.0-test",
            },
            f,
        )

    monkeypatch.setenv("DOCUBRIX_CLASSIFIER_PATH", str(model_artifact_path))

    query_text = "Acme Labs invoice amount due"
    res = classify_document_result(query_text)

    assert res.method == "ml"
    assert res.model_name == "tfidf-logistic-regression"
    assert res.model_version == "1.0.0-test"
    assert res.status == "classified"
    assert res.document_type == "invoice"
    assert res.confidence is not None
    assert 0.0 <= res.confidence <= 1.0


def test_train_classifier_read_rows_csv(tmp_path: Path) -> None:
    csv_file = tmp_path / "dataset.csv"
    with csv_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "label"])
        writer.writeheader()
        writer.writerow({"text": "Sample invoice text", "label": "invoice"})
        writer.writerow({"text": "Sample receipt text", "label": "receipt"})
        writer.writerow({"text": "Unsupported class item", "label": "medical_report"})

    texts, labels = read_rows(csv_file)
    assert len(texts) == 2
    assert labels == ["invoice", "receipt"]


def test_train_classifier_read_rows_jsonl(tmp_path: Path) -> None:
    jsonl_file = tmp_path / "dataset.jsonl"
    with jsonl_file.open("w", encoding="utf-8") as f:
        f.write(json.dumps({"raw_text": "Sample invoice text", "document_type": "invoice"}) + "\n")
        f.write(json.dumps({"raw_text": "Sample bank statement text", "document_type": "bank_statement"}) + "\n")

    texts, labels = read_rows(jsonl_file)
    assert len(texts) == 2
    assert set(labels) == {"invoice", "bank_statement"}


def test_train_classifier_read_rows_validation_errors(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        read_rows(tmp_path / "missing.csv")

    single_class_file = tmp_path / "single_class.csv"
    with single_class_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "label"])
        writer.writeheader()
        writer.writerow({"text": "Invoice 1", "label": "invoice"})
        writer.writerow({"text": "Invoice 2", "label": "invoice"})

    with pytest.raises(ValueError, match="at least two supported classes"):
        read_rows(single_class_file)


def test_train_and_evaluate_pipeline(tmp_path: Path) -> None:
    dataset_file = tmp_path / "train_eval.csv"
    with dataset_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "label"])
        writer.writeheader()
        for i in range(5):
            writer.writerow({"text": f"Invoice {i} bill to customer amount due", "label": "invoice"})
            writer.writerow({"text": f"Receipt {i} payment received store change", "label": "receipt"})

    artifact_path = tmp_path / "output_model.pkl"
    metrics = train_and_evaluate(
        dataset_path=dataset_file,
        output_path=artifact_path,
        model_version="1.2.0",
        test_size=0.2,
    )

    assert "accuracy" in metrics
    assert "precision_macro" in metrics
    assert "recall_macro" in metrics
    assert "f1_macro" in metrics
    assert artifact_path.exists()

    with artifact_path.open("rb") as f:
        loaded = pickle.load(f)
    assert loaded["model_name"] == "tfidf-logistic-regression"
    assert loaded["model_version"] == "1.2.0"
    assert "vectorizer" in loaded
    assert "classifier" in loaded

