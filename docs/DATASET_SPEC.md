# DocuBrix Document Classification Dataset Specification

## Overview

DocuBrix provides a TF-IDF + Logistic Regression classification training and inference pipeline ([`backend/scripts/train_classifier.py`](../backend/scripts/train_classifier.py) and [`backend/app/services/classifier.py`](../backend/app/services/classifier.py)) to categorize financial documents into four standard document types:

- `invoice`: Commercial invoices with vendor, invoice number, date, and total due.
- `receipt`: Point-of-sale receipts and payment confirmations.
- `bank_statement`: Bank transaction reports with account details and balances.
- `other_financial_document`: General financial documents not fitting the three primary classes.

## Dataset Formats

The training script accepts either CSV or JSONL format.

### 1. CSV Format (`dataset.csv`)

Must contain headers `text` (or `raw_text`) and `label` (or `document_type`):

```csv
text,label
"INVOICE 1001 Vendor: Acme Labs Total Due: $120.50 Due Date: 2026-10-15",invoice
"RECEIPT Payment Received: $42.75 Subtotal: $40.00 Tax: $2.75",receipt
"BANK STATEMENT Account: Checking 1234 Beginning Balance: $1,000.00 Ending Balance: $1,550.25",bank_statement
"Q3 earnings report Revenue up 12% Board summary",other_financial_document
```

### 2. JSONL Format (`dataset.jsonl`)

One JSON object per line:

```json
{"text": "INVOICE 1001 Vendor: Acme Labs Total Due: $120.50", "label": "invoice"}
{"text": "RECEIPT Store: Coffee Shop Total Paid: $5.50", "label": "receipt"}
{"text": "BANK STATEMENT Checking 9876 Balance: $3,200.00", "label": "bank_statement"}
```

## How to Train & Evaluate

To train the model on a real dataset and save the artifact:

```bash
python -m backend.scripts.train_classifier path/to/dataset.csv --output backend/models/document_classifier.pkl --model-version 1.0.0
```

The script performs:
1. Data loading and validation of supported labels.
2. Train/test split (default 80% train, 20% test, with stratified splitting when class counts allow).
3. TF-IDF feature extraction (unigram and bigram features, sublinear term frequency).
4. Balanced Logistic Regression training.
5. Evaluation reporting macro precision, recall, F1, accuracy, and detailed per-class classification report.
6. Serialization of the vectorizer, classifier, model version, and genuine metrics into the pickle artifact.

## Operational Status

In accordance with project integrity standards:
- No synthetic or fabricated dataset has been committed.
- When no model artifact exists at `DOCUBRIX_CLASSIFIER_PATH`, the system explicitly reports `method="heuristic_fallback"` with `confidence=None`.
- Genuine probability values are only returned when an actual trained ML model artifact is loaded and computes class probabilities.

