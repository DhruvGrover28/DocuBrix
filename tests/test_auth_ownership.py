from __future__ import annotations

import io
import uuid

import fitz
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def register(email: str, name: str, password: str = "correct-password") -> dict:
    response = client.post("/auth/register", json={"name": name, "email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


def invoice_file(filename: str) -> tuple[str, bytes, str]:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "Invoice 1001\nVendor: Acme Labs\nTotal: $120.50\nDue: 2026-10-15")
    output = io.BytesIO()
    document.save(output)
    document.close()
    return filename, output.getvalue(), "application/pdf"


def test_authentication_and_two_user_document_isolation(db_required) -> None:
    suffix = uuid.uuid4().hex[:10]
    email_a = f"user_a_{suffix}@example.com"
    email_b = f"user_b_{suffix}@example.com"

    user_a = register(email_a, "User A")
    user_b = register(email_b, "User B")
    token_a = user_a["access_token"]
    token_b = user_b["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    assert client.get("/auth/me", headers=headers_a).json()["user"]["email"] == email_a
    assert client.get("/auth/me").status_code == 401
    assert client.post("/auth/login", json={"email": email_a, "password": "wrong-password"}).status_code == 401
    assert client.post("/auth/register", json={"name": "Duplicate", "email": email_a, "password": "correct-password"}).status_code == 409

    document_a = client.post("/documents/upload", files={"file": invoice_file("document-a.pdf")}, headers=headers_a)
    document_b = client.post("/documents/upload", files={"file": invoice_file("document-b.pdf")}, headers=headers_b)
    assert document_a.status_code == 200, document_a.text
    assert document_b.status_code == 200, document_b.text
    document_a_id = document_a.json()["document_id"]
    document_b_id = document_b.json()["document_id"]

    list_a = client.get("/documents", headers=headers_a).json()["documents"]
    list_b = client.get("/documents", headers=headers_b).json()["documents"]
    assert {item["document_id"] for item in list_a} == {document_a_id}
    assert {item["document_id"] for item in list_b} == {document_b_id}

    assert client.get(f"/documents/{document_b_id}", headers=headers_a).status_code == 404
    assert client.post(f"/documents/{document_b_id}/review", json={"manual_corrections": {"vendor": "Other"}}, headers=headers_a).status_code == 404
    assert client.delete(f"/documents/{document_b_id}", headers=headers_a).status_code == 404
    assert client.get(f"/documents/{document_a_id}", headers=headers_b).status_code == 404
    assert client.post(f"/documents/{document_a_id}/review", json={"manual_corrections": {"vendor": "Other"}}, headers=headers_b).status_code == 404
    assert client.delete(f"/documents/{document_a_id}", headers=headers_b).status_code == 404

    correction = client.post(
        f"/documents/{document_a_id}/review",
        json={"manual_corrections": {"vendor": "Corrected Labs"}},
        headers=headers_a,
    )
    assert correction.status_code == 200, correction.text
    reloaded = client.get(f"/documents/{document_a_id}", headers=headers_a)
    assert reloaded.status_code == 200
    assert reloaded.json()["final_values"]["vendor"] == "Corrected Labs"

    assert client.post("/auth/logout", headers=headers_a).status_code == 200
    assert client.get("/auth/me", headers=headers_a).status_code == 401


def test_admin_endpoint_requires_admin_role(db_required) -> None:
    suffix = uuid.uuid4().hex[:10]
    user = register(f"regular_{suffix}@example.com", "Regular User")
    admin = register("admin@example.com", "Test Admin")

    assert client.get("/admin/overview", headers={"Authorization": f"Bearer {user['access_token']}"}).status_code == 403
    response = client.get("/admin/overview", headers={"Authorization": f"Bearer {admin['access_token']}"})
    assert response.status_code == 200, response.text
    assert "document_count" in response.json()
