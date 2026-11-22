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
    assert res_acad.category == "Academic & Research"

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
    assert res_med.category == "Medical & Healthcare"

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
    assert fields["category"] == "Academic & Research"
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


def test_workflow_rules_admin_rbac() -> None:
    from fastapi.testclient import TestClient
    from backend.app.main import app, get_current_user
    from backend.app.models.user import User

    client = TestClient(app)

    user_normal = User(id="user-normal", name="Normal", email="normal@example.com", role="user")
    user_admin = User(id="user-admin", name="Admin", email="admin@example.com", role="admin")

    try:
        app.dependency_overrides[get_current_user] = lambda: user_normal

        # 1. Non-admin can list rules
        list_resp = client.get("/workflows/rules")
        assert list_resp.status_code == 200

        # 2. Non-admin cannot create rules
        create_payload = {
            "name": "Malicious Bypass Rule",
            "rule_type": "auto_approval",
            "conditions": {"min_confidence": 0.1},
            "action": {"target_status": "approved"},
        }
        resp_create_unauth = client.post("/workflows/rules", json=create_payload)
        assert resp_create_unauth.status_code == 403

        # 3. Non-admin cannot modify rules
        resp_mod_unauth = client.patch("/workflows/rules/rule-auto-approval", json={"enabled": False})
        assert resp_mod_unauth.status_code == 403

        # 4. Non-admin cannot delete rules
        resp_del_unauth = client.delete("/workflows/rules/rule-auto-approval")
        assert resp_del_unauth.status_code == 403

        # 5. Admin CAN create, modify, and delete rules
        app.dependency_overrides[get_current_user] = lambda: user_admin
        resp_create_admin = client.post("/workflows/rules", json=create_payload)
        assert resp_create_admin.status_code == 200
        created_rule = resp_create_admin.json()["rule"]
        rule_id = created_rule["id"]

        resp_mod_admin = client.patch(f"/workflows/rules/{rule_id}", json={"enabled": False})
        assert resp_mod_admin.status_code == 200
        assert resp_mod_admin.json()["rule"]["enabled"] is False

        resp_del_admin = client.delete(f"/workflows/rules/{rule_id}")
        assert resp_del_admin.status_code == 200
    finally:
        app.dependency_overrides.clear()


def test_workflow_logs_tenant_isolation(monkeypatch) -> None:
    from fastapi.testclient import TestClient
    from backend.app.main import app, get_current_user
    from backend.app.models.user import User
    from backend.app.models.document import Document
    from datetime import datetime

    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(bind=test_engine)
    monkeypatch.setattr("backend.app.main.SessionLocal", TestSession)

    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())
    admin_id = str(uuid.uuid4())

    user_a = User(id=user_a_id, name="User A", email="a@example.com", role="user")
    user_b = User(id=user_b_id, name="User B", email="b@example.com", role="user")
    user_admin = User(id=admin_id, name="Admin", email="admin@example.com", role="admin")

    client = TestClient(app)

    with TestSession() as session:
        doc_a = Document(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            filename="user_a_confidential_payroll.pdf",
            status="processed",
            file_type="pdf",
            document_type="salary_slip",
            extracted_json={
                "category": "Financial",
                "workflow": {
                    "log_id": "log-doc-a",
                    "triggered_rules": [{"rule_name": "High-Confidence Auto-Approval"}],
                    "applied_tags": ["auto_approved"],
                    "alerts": [],
                },
            },
            confidence_scores={"overall": 0.95},
            upload_time=datetime.utcnow(),
        )
        doc_b = Document(
            id=str(uuid.uuid4()),
            owner_id=user_b_id,
            filename="user_b_private_medical.pdf",
            status="secure_archived",
            file_type="pdf",
            document_type="medical_prescription",
            extracted_json={
                "category": "Medical",
                "workflow": {
                    "log_id": "log-doc-b",
                    "triggered_rules": [{"rule_name": "Medical Confidentiality & HIPAA/PHI Shield"}],
                    "applied_tags": ["phi_confidential"],
                    "alerts": ["Protected health information detected."],
                },
            },
            confidence_scores={"overall": 0.88},
            upload_time=datetime.utcnow(),
        )
        session.add_all([doc_a, doc_b])
        session.commit()

    try:
        # User A requests logs: must only see doc_a
        app.dependency_overrides[get_current_user] = lambda: user_a
        logs_resp_a = client.get("/workflows/logs")
        assert logs_resp_a.status_code == 200
        filenames_a = [l["filename"] for l in logs_resp_a.json()["logs"]]
        assert "user_a_confidential_payroll.pdf" in filenames_a
        assert "user_b_private_medical.pdf" not in filenames_a

        # User B requests logs: must only see doc_b
        app.dependency_overrides[get_current_user] = lambda: user_b
        logs_resp_b = client.get("/workflows/logs")
        assert logs_resp_b.status_code == 200
        filenames_b = [l["filename"] for l in logs_resp_b.json()["logs"]]
        assert "user_b_private_medical.pdf" in filenames_b
        assert "user_a_confidential_payroll.pdf" not in filenames_b

        # Admin requests logs: sees both doc_a and doc_b
        app.dependency_overrides[get_current_user] = lambda: user_admin
        logs_resp_admin = client.get("/workflows/logs")
        assert logs_resp_admin.status_code == 200
        filenames_admin = [l["filename"] for l in logs_resp_admin.json()["logs"]]
        assert "user_a_confidential_payroll.pdf" in filenames_admin
        assert "user_b_private_medical.pdf" in filenames_admin
    finally:
        app.dependency_overrides.clear()


def test_workflow_queue_action_authorization(monkeypatch) -> None:
    from fastapi.testclient import TestClient
    from backend.app.main import app, get_current_user
    from backend.app.models.user import User
    from backend.app.models.document import Document
    from datetime import datetime

    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(bind=test_engine)
    monkeypatch.setattr("backend.app.main.SessionLocal", TestSession)

    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())
    admin_id = str(uuid.uuid4())

    user_a = User(id=user_a_id, name="User A", email="a@example.com", role="user")
    user_b = User(id=user_b_id, name="User B", email="b@example.com", role="user")
    user_admin = User(id=admin_id, name="Admin", email="admin@example.com", role="admin")

    client = TestClient(app)

    doc_id = str(uuid.uuid4())
    with TestSession() as session:
        doc = Document(
            id=doc_id,
            owner_id=user_a_id,
            filename="high_value_invoice.pdf",
            status="pending_approval",
            file_type="pdf",
            document_type="invoice",
            extracted_json={"total_amount": "5000.00"},
            review_json={},
            upload_time=datetime.utcnow(),
        )
        session.add(doc)
        session.commit()

    try:
        # 1. User B tries to act on User A's document: 404 Not Found
        app.dependency_overrides[get_current_user] = lambda: user_b
        resp_cross = client.post(f"/workflows/queue/{doc_id}/action", json={"action": "flag"})
        assert resp_cross.status_code == 404

        # 2. Non-admin User A tries to self-approve: 403 Forbidden
        app.dependency_overrides[get_current_user] = lambda: user_a
        resp_approve_unauth = client.post(f"/workflows/queue/{doc_id}/action", json={"action": "approve"})
        assert resp_approve_unauth.status_code == 403
        assert "Administrator access is required" in resp_approve_unauth.json()["detail"]

        # 3. Non-admin User A tries to reject: 403 Forbidden
        resp_reject_unauth = client.post(f"/workflows/queue/{doc_id}/action", json={"action": "reject"})
        assert resp_reject_unauth.status_code == 403

        # 4. Non-admin User A CAN flag their own document
        resp_flag = client.post(f"/workflows/queue/{doc_id}/action", json={"action": "flag", "note": "Needs manager check"})
        assert resp_flag.status_code == 200
        assert resp_flag.json()["status"] == "flagged"

        # 5. Admin CAN approve the document
        app.dependency_overrides[get_current_user] = lambda: user_admin
        resp_approve_admin = client.post(f"/workflows/queue/{doc_id}/action", json={"action": "approve", "note": "Approved by CFO"})
        assert resp_approve_admin.status_code == 200
        assert resp_approve_admin.json()["status"] == "approved"
    finally:
        app.dependency_overrides.clear()
