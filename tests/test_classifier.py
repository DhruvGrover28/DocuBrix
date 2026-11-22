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


def test_production_bundled_model_loads_and_classifies_all_12_classes() -> None:
    """Validate that the production model artifact loads and classifies all domain types with ML probabilities."""
    samples = {
        "invoice": (
            "TAX INVOICE\nVendor: Apex Cloud Technologies LLC\nBill To: Wayne Enterprises\n"
            "Invoice Number: INV-2026-9041\nSubtotal: $4,500.00\nTax: $450.00\nTotal Amount Due: $4,950.00\n"
            "Payment Terms: Net 30 Days",
            "Financial",
        ),
        "receipt": (
            "SuperMart Store #402\nSales Receipt: TXN-492102\nSubtotal: $45.00\nSales Tax: $3.60\n"
            "Total Paid: $48.60\nPayment Method: Credit Card ending 4128\nThank you for shopping!",
            "Financial",
        ),
        "bank_statement": (
            "JPMorgan Chase Bank, N.A.\nMONTHLY ACCOUNT STATEMENT\nAccount Name: Robert Langdon\n"
            "Account Number: XXXX-XXXX-4912\nBeginning Balance: $8,400.00\nEnding Balance: $9,250.00\n"
            "Transaction History: Direct Deposit Payroll $3,500.00",
            "Financial",
        ),
        "salary_slip": (
            "Infosys Global Technologies\nCONFIDENTIAL PAYSLIP\nEmployee Name: Dhruv Grover\n"
            "Employee ID: EMP-4921\nGross Pay: $6,500.00\nProvident Fund: $450.00\nNet Salary: $5,250.00",
            "Financial",
        ),
        "academic_transcript": (
            "DELHI TECHNOLOGICAL UNIVERSITY\nOFFICIAL TRANSCRIPT OF ACADEMIC RECORD\n"
            "Student Name: Pranav Bisht\nRoll Number: 2K20/CO/315\nDegree: Bachelor of Technology\n"
            "Credits Registered: 24 | Cumulative GPA (CGPA): 8.92 / 10.0\nSemester: VII Semester",
            "Academic",
        ),
        "academic_certificate": (
            "STANFORD UNIVERSITY\nDEGREE CERTIFICATE\nThe Chancellor and Academic Council hereby certify "
            "that the degree of Master of Science in Artificial Intelligence has been conferred upon "
            "Diana Prince having fulfilled all requirements.",
            "Academic",
        ),
        "legal_contract": (
            "MASTER SERVICES AGREEMENT\nThis Agreement is entered into by and between Acme Global Holdings "
            "('Client') and Beta Consulting ('Contractor').\nTerms and Conditions: Scope of Work, "
            "Warranties and Representations, Indemnification, Governing Law: Courts of Delhi.",
            "Legal",
        ),
        "non_disclosure_agreement": (
            "MUTUAL NON-DISCLOSURE AGREEMENT (NDA)\nThis Confidentiality Agreement is entered into between "
            "Alpha Dynamics ('Disclosing Party') and Pinnacle Technologies ('Receiving Party'). "
            "Confidential Information shall remain protected. Trade secret obligations survive 5 years.",
            "Legal",
        ),
        "medical_prescription": (
            "APOLLO CLINICAL HEALTHCARE\nOUTPATIENT CLINICAL PRESCRIPTION\nConsultant: Dr. Arvind Sharma, MD\n"
            "Patient Name: John Doe | Age/Sex: 34 Yrs / Male\nRx:\n1. Tab. Paracetamol 650mg - 1 tab three times daily\n"
            "2. Syrup CoughRelief 10ml at bedtime\nDoctor Signature",
            "Medical",
        ),
        "medical_lab_report": (
            "QUEST DIAGNOSTICS PATHOLOGY\nLABORATORY INVESTIGATION REPORT\nPatient Name: Jane Doe\n"
            "Department: Clinical Biochemistry\nTest Name: Complete Blood Count\n"
            "Haemoglobin | Observed Value: 14.2 g/dL | Biological Reference Interval: 13.0 - 17.0\nPathologist: Dr. N. Sengupta",
            "Medical",
        ),
        "identity_document": (
            "GOVERNMENT ISSUED OFFICIAL PASSPORT\nDocument Number: P9482014\nCardholder Full Name: PRANAV BISHT\n"
            "Date of Birth (DOB): 2002-05-14\nGender: MALE\nNationality: INDIAN\n"
            "Issuing Authority: Government Ministry of External Affairs\nExpiry Date: 2032-05-13",
            "Administrative",
        ),
        "official_notice": (
            "OFFICE OF THE REGISTRAR, CENTRAL UNIVERSITY\nOFFICE MEMORANDUM / OFFICIAL NOTICE\n"
            "Reference No: ADM/NOT/2026/412\nSubject: Administrative Circular regarding revised office hours.\n"
            "By Order of the Competent Authority\nJoint Secretary",
            "Administrative",
        ),
    }

    for expected_type, (sample_text, expected_category) in samples.items():
        res = classify_document_result(sample_text)
        assert res.method == "ml", f"Expected ML classification for {expected_type}, got {res.method}"
        assert res.status == "classified"
        assert res.document_type == expected_type, f"Expected {expected_type}, got {res.document_type}"
        assert res.category == expected_category, f"Expected category {expected_category}, got {res.category}"
        assert res.confidence is not None and res.confidence >= 0.30, f"Low confidence {res.confidence} for {expected_type}"
        assert res.model_name == "tfidf-logistic-regression"


def test_resume_and_general_documents_not_misclassified_as_financial() -> None:
    """Ensure generic non-financial documents (Resumes, cover letters) are classified as General / other_document."""
    resume_text = (
        "Pranav Bisht\n"
        "Email: pranav@example.com | Phone: +91-9876543210 | GitHub: github.com/Tester-acc-007\n"
        "LinkedIn: linkedin.com/in/pranavbisht\n\n"
        "PROFESSIONAL SUMMARY\n"
        "Full Stack & ML Engineer with hands-on experience developing document workflows, "
        "FastAPI backends, and React single-page applications.\n\n"
        "TECHNICAL SKILLS\n"
        "Python, JavaScript, React, FastAPI, SQLite, PostgreSQL, PyTorch, Scikit-learn, TailwindCSS\n\n"
        "WORK EXPERIENCE\n"
        "Software Engineering Intern — Cloud Systems (2025 - Present)\n"
        "• Built automated microservices for document parsing and workflow gates.\n"
        "• Implemented JWT authentication and responsive UI cards.\n\n"
        "EDUCATION\n"
        "Bachelor of Technology in Computer Science, GPA: 8.9/10.0\n"
        "PROJECTS & CERTIFICATIONS\n"
        "DocuBrix: End-to-end intelligent document platform."
    )
    res_resume = classify_document_result(resume_text)
    assert res_resume.document_type == "other_document"
    assert res_resume.category == "General"
    assert res_resume.category != "Financial"

    cover_letter = (
        "Date: November 21, 2026\n"
        "Hiring Manager\n"
        "Technology Solutions Group\n\n"
        "Dear Hiring Team,\n\n"
        "I am writing to express my enthusiasm for the Software Engineering position. "
        "With expertise in scalable systems, I look forward to discussing my qualifications.\n\n"
        "Sincerely,\n"
        "Pranav Bisht"
    )
    res_letter = classify_document_result(cover_letter)
    assert res_letter.document_type == "other_document"
    assert res_letter.category == "General"
    assert res_letter.category != "Financial"


def test_heuristic_fallback_prevents_resume_from_misclassification(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Ensure that even in fallback mode, resumes and general text are General/other_document and not Financial."""
    monkeypatch.setenv("DOCUBRIX_CLASSIFIER_PATH", str(tmp_path / "absent_model.pkl"))

    resume_text = (
        "Candidate Resume\n"
        "Name: Alex Taylor\n"
        "Professional Summary: Senior Developer\n"
        "Work Experience: 6 years in software development\n"
        "Technical Skills: Python, TypeScript, Docker\n"
        "Education: B.S. in Computer Science"
    )
    res = classify_document_result(resume_text)
    assert res.method == "heuristic_fallback"
    assert res.document_type == "other_document"
    assert res.category == "General"
    assert res.category != "Financial"

    generic_note = "Meeting Notes\nDiscussed sprint milestones and team alignment for Q4."
    res_note = classify_document_result(generic_note)
    assert res_note.method == "heuristic_fallback"
    assert res_note.category == "General"
    assert res_note.category != "Financial"


