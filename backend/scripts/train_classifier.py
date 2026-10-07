from __future__ import annotations

import argparse
import csv
import json
import pickle
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


from collections import Counter
from datetime import datetime, timezone

SUPPORTED_LABELS = {"invoice", "receipt", "bank_statement", "other_financial_document"}


def read_rows(path: Path) -> tuple[list[str], list[str]]:
    texts: list[str] = []
    labels: list[str] = []
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")
    with path.open("r", encoding="utf-8", newline="") as source:
        if path.suffix.lower() == ".csv":
            rows = csv.DictReader(source)
        else:
            rows = (json.loads(line) for line in source if line.strip())
        for row in rows:
            text = str(row.get("text") or row.get("raw_text") or "").strip()
            label = str(row.get("label") or row.get("document_type") or "").strip().lower()
            if text and label in SUPPORTED_LABELS:
                texts.append(text)
                labels.append(label)
    if len(set(labels)) < 2:
        raise ValueError("The labeled dataset must contain at least two supported classes.")
    return texts, labels


def train_and_evaluate(
    dataset_path: Path,
    output_path: Path,
    model_version: str = "1.0.0",
    test_size: float = 0.2,
    random_state: int = 42,
) -> dict[str, Any]:
    texts, labels = read_rows(dataset_path)
    counts = Counter(labels)
    can_stratify = all(count >= 2 for count in counts.values()) and len(texts) >= 5

    train_texts, test_texts, train_labels, test_labels = train_test_split(
        texts,
        labels,
        test_size=test_size,
        random_state=random_state,
        stratify=labels if can_stratify else None,
    )
    pipeline = Pipeline(
        [
            ("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), min_df=1, sublinear_tf=True)),
            ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=random_state)),
        ]
    )
    pipeline.fit(train_texts, train_labels)
    predictions = pipeline.predict(test_texts)
    metrics = {
        "accuracy": round(float(accuracy_score(test_labels, predictions)), 4),
        "precision_macro": round(float(precision_score(test_labels, predictions, average="macro", zero_division=0)), 4),
        "recall_macro": round(float(recall_score(test_labels, predictions, average="macro", zero_division=0)), 4),
        "f1_macro": round(float(f1_score(test_labels, predictions, average="macro", zero_division=0)), 4),
        "train_size": len(train_labels),
        "test_size": len(test_labels),
        "class_distribution": dict(counts),
        "classification_report": classification_report(test_labels, predictions, zero_division=0, output_dict=True),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as output:
        pickle.dump(
            {
                "vectorizer": pipeline.named_steps["tfidf"],
                "classifier": pipeline.named_steps["classifier"],
                "model_name": "tfidf-logistic-regression",
                "model_version": model_version,
                "metrics": metrics,
                "labels": sorted(set(labels)),
                "trained_at": datetime.now(timezone.utc).isoformat(),
            },
            output,
        )
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and evaluate the DocuBrix document classifier.")
    parser.add_argument("dataset", type=Path, help="CSV or JSONL file with text and label columns")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("backend/models/document_classifier.pkl"),
        help="Output classifier artifact path (default: backend/models/document_classifier.pkl)",
    )
    parser.add_argument("--model-version", type=str, default="1.0.0", help="Model version identifier")
    parser.add_argument("--test-size", type=float, default=0.2, help="Fraction of data reserved for test set")
    args = parser.parse_args()

    metrics = train_and_evaluate(
        dataset_path=args.dataset,
        output_path=args.output,
        model_version=args.model_version,
        test_size=args.test_size,
    )
    print(json.dumps(metrics, indent=2, default=str))


if __name__ == "__main__":
    main()
