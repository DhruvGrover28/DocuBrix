from __future__ import annotations

import io
import uuid
import pytest
from fastapi import BackgroundTasks, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.database import Base
from backend.app.models.user import User
from backend.app.services.classifier import (
    DOCUMENT_CATEGORY_MAP,
    classify_document_result,
)
from backend.app.services.document_processor import (
    classify_document,
    extract_domain_fields,
    validate_extracted_fields,
)
from backend.app.services.workflow import (
    add_workflow_rule,
    evaluate_document_workflows,
    get_workflow_logs,
    get_workflow_rules,
)


def test_multidomain_classification() -> None:
    academic_text = (
        "DELHI TECHNOLOGICAL UNIVERSITY\n"
        "TRANSCRIPT OF ACADEMIC RECORD\n"
        "Student Name: Pranav Bisht\n"
        "Roll No: 2K20/CO/315\n"
        "Degree: Bachelor of Technology\n"
        "Cumulative GPA: 8.84 / 10.0\n"
        "Semester: VII Semester Examination 2026\n"
        "Result: First Class with Distinction"
    )
    res_acad = classify_document_result(academic_text)
    assert res_acad.document_type == "academic_transcript"
    assert res_acad.category == "Academic"

    legal_text = (
        "MUTUAL NON-DISCLOSURE AGREEMENT\n"
        "This Non-Disclosure Agreement is entered into between Acme Corp (Disclosing Party) "
        "and Beta Labs (Receiving Party). Confidential Information shall remain protected. "
        "Governing Law: Laws of India. Effective Date: 2026-05-12."
    )
    res_legal = classify_document_result(legal_text)
    assert res_legal.document_type == "non_disclosure_agreement"
    assert res_legal.category == "Legal"

    medical_text = (
        "APOLLO HOSPITALS CLINICAL PRESCRIPTION\n"
        "Patient Name: John Doe\n"
        "Age/Gender: 32 Yrs / Male\n"
        "Consultant: Dr. Arvind Sharma, MD\n"
        "Rx:\n"
        "1. Tab Paracetamol 650mg - 1 tablet twice daily after meals\n"
        "2. Syrup CoughRelief 10ml before bed\n"
        "Consultation Date: 2026-11-10"
    )
    res_med = classify_document_result(medical_text)
    assert res_med.document_type == "medical_prescription"
    assert res_med.category == "Medical"

    salary_text = (
        "GLOBAL TECH SOLUTIONS LTD.\n"
        "SALARY SLIP FOR THE MONTH OF OCTOBER 2026\n"
        "Employee Name: Dhruv Grover\n"
        "Employee ID: EMP-9921\n"
        "Gross Pay: $6,500.00\n"
        "Provident Fund: $450.00\n"
        "Net Salary: $6,050.00"
    )
    res_sal = classify_document_result(salary_text)
    assert res_sal.document_type == "salary_slip"
    assert res_sal.category == "Financial"


def test_multidomain_extraction() -> None:
    academic_text = (
        "DELHI TECHNOLOGICAL UNIVERSITY\n"
        "TRANSCRIPT OF ACADEMIC RECORD\n"
        "Student Name: Pranav Bisht\n"
        "Roll No: 2K20-CO-315\n"
        "Degree: Bachelor of Technology\n"
        "Cumulative GPA: 8.84\n"
        "Semester: VII"
    )
    fields = extract_domain_fields(academic_text, "academic_transcript")
    assert fields["category"] == "Academic"
    assert "Pranav Bisht" in fields["student_name"]
    assert "8.84" in fields["cgpa_percentage"]

    val = validate_extracted_fields("academic_transcript", fields)
    assert val["is_valid"] is True


def test_workflow_rule_evaluation() -> None:
    doc_payload = {
        "filename": "quarterly_invoice.pdf",
        "document_type": "invoice",
        "category": "Financial",
        "confidence": {"overall": 0.92},
        "validation": {"is_valid": True},
        "extracted_fields": {"total_amount": "3450.00"},
        "status": "processed",
    }
    result = evaluate_document_workflows(doc_payload)
    # Total amount 3450 > 1000 should trigger high-value invoice spend gate
    assert "rule-high-value-invoice" in [r["rule_id"] for r in result["triggered_rules"]]
    assert result["final_status"] == "pending_approval"
    assert "high_value_spend" in result["applied_tags"]
