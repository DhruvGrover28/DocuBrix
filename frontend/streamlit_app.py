import json
import os
from typing import Any

import httpx
import streamlit as st

API_BASE_URL = os.getenv("DOCUBRIX_API_URL", "http://127.0.0.1:8000").rstrip("/")

st.set_page_config(page_title="DocuBrix", page_icon="📄", layout="wide")

st.markdown(
    """
    <style>
        :root {
            --bg: #f5f7fb;
            --panel: #ffffff;
            --border: #dfe6f1;
            --primary: #1947c9;
            --primary-soft: #ebf0ff;
            --text: #162033;
            --muted: #5b6b84;
            --success: #1f9d67;
            --warning: #d97706;
            --danger: #c2333f;
            --shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
        }
        .stApp {
            background: var(--bg);
            color: var(--text);
        }
        .block-container {
            padding-top: 2rem;
            padding-bottom: 4rem;
        }
        .docubrix-shell {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 16px;
            box-shadow: var(--shadow);
            padding: 1.25rem 1.5rem;
            margin-bottom: 1.25rem;
        }
        .sidebar .sidebar-content {
            background: #f8faff;
        }
        .metric-card {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 1rem 1rem 0.75rem;
            height: 100%;
            box-shadow: var(--shadow);
        }
        .section-label {
            font-size: 0.72rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--muted);
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        .badge {
            display: inline-block;
            padding: 0.2rem 0.55rem;
            border-radius: 999px;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
        .badge-high { background: #dff7ec; color: #136c46; }
        .badge-medium { background: #fff3d9; color: #9a6100; }
        .badge-low { background: #ffe4e8; color: #992b3a; }
        .badge-valid { background: #dff7ec; color: #136c46; }
        .badge-review { background: #fff3d9; color: #9a6100; }
        .badge-invalid { background: #ffe4e8; color: #992b3a; }
    </style>
    """,
    unsafe_allow_html=True,
)


def api_get(endpoint: str) -> dict[str, Any]:
    url = f"{API_BASE_URL}{endpoint}"
    try:
        response = httpx.get(url, timeout=30.0)
        response.raise_for_status()
        return response.json()
    except Exception as exc:  # pragma: no cover - UI error path
        raise RuntimeError(f"Unable to connect to the processing service: {exc}") from exc


def api_post_json(endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{API_BASE_URL}{endpoint}"
    try:
        response = httpx.post(url, json=payload, timeout=30.0)
        response.raise_for_status()
        return response.json()
    except Exception as exc:  # pragma: no cover - UI error path
        raise RuntimeError(f"Document processing failed. Please try again: {exc}") from exc


def api_upload(endpoint: str, uploaded_file) -> dict[str, Any]:
    url = f"{API_BASE_URL}{endpoint}"
    try:
        files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type or "application/octet-stream")}
        response = httpx.post(url, files=files, timeout=120.0)
        if response.status_code >= 400:
            payload = response.json() if response.content else {}
            message = payload.get("detail") if isinstance(payload, dict) else str(payload)
            raise RuntimeError(message or "Unsupported document format.")
        return response.json()
    except Exception as exc:  # pragma: no cover - UI error path
        raise RuntimeError(f"Document processing failed. Please try again: {exc}") from exc


def render_metric(label: str, value: str, hint: str = "") -> None:
    st.markdown('<div class="metric-card">', unsafe_allow_html=True)
    st.markdown(f'<div class="section-label">{label}</div>', unsafe_allow_html=True)
    st.markdown(f'<div style="font-size:2rem;font-weight:700;line-height:1.1;">{value}</div>', unsafe_allow_html=True)
    if hint:
        st.caption(hint)
    st.markdown('</div>', unsafe_allow_html=True)


def confidence_badge(score: Any) -> str:
    if score is None:
        return '<span class="badge badge-medium">Not available</span>'
    score_value = float(score)
    if score_value >= 0.75:
        return '<span class="badge badge-high">High</span>'
    if score_value >= 0.45:
        return '<span class="badge badge-medium">Medium</span>'
    return '<span class="badge badge-low">Low</span>'


def validation_badge(validation: dict[str, Any]) -> str:
    if not validation:
        return '<span class="badge badge-review">Not available</span>'
    is_valid = validation.get("is_valid")
    if is_valid is True:
        return '<span class="badge badge-valid">Valid</span>'
    if is_valid is False:
        return '<span class="badge badge-invalid">Needs review</span>'
    return '<span class="badge badge-review">Unknown</span>'


def normalize_doc_type(value: str) -> str:
    return value.replace("_", " ").title() if value else "Unknown" 


def render_dashboard_page() -> None:
    st.markdown('<div class="docubrix-shell">', unsafe_allow_html=True)
    st.markdown("## DocuBrix")
    st.markdown("### Intelligent Document Lifecycle, Analytics & Workflow Automation")
    st.markdown("A professional document intelligence workspace for financial information extraction, review, and validation.")
    st.markdown('</div>', unsafe_allow_html=True)

    try:
        summary = api_get("/documents/summary")
    except Exception as exc:
        st.warning(str(exc))
        return

    metrics = [
        ("Total documents processed", str(summary.get("total_documents", 0)), "Documents currently stored in the system"),
        ("Documents requiring review", str(summary.get("documents_needing_review", 0)), "Documents with validation issues or manual corrections"),
        ("Average extraction confidence", f"{summary.get('average_confidence', 'Not available')}", "Across all stored documents"),
        ("Successfully processed documents", str(summary.get("successful_documents", 0)), "Documents with successful processing"),
    ]

    cols = st.columns(4)
    for i, (label, value, hint) in enumerate(metrics):
        with cols[i]:
            render_metric(label, value, hint)

    st.subheader("Document type distribution")
    type_distribution = summary.get("document_type_distribution", {})
    if type_distribution:
        chart_data = {key: value for key, value in sorted(type_distribution.items())}
        st.bar_chart(chart_data)
    else:
        st.info("No document type data is available yet.")

    st.subheader("Recent documents")
    recent = summary.get("recent_documents", [])
    if recent:
        recent_rows = []
        for item in recent:
            recent_rows.append(
                {
                    "Filename": item.get("filename", "-"),
                    "Type": normalize_doc_type(item.get("document_type") or "unknown"),
                    "Status": item.get("status", "unknown"),
                    "Confidence": item.get("confidence", {}).get("overall", "Not available"),
                    "Uploaded": item.get("upload_time", "-"),
                }
            )
        st.dataframe(recent_rows, use_container_width=True, hide_index=True)
    else:
        st.info("No recent documents are available yet.")

    st.subheader("Processing status overview")
    status_distribution = summary.get("status_distribution", {})
    if status_distribution:
        st.bar_chart(status_distribution)
    else:
        st.info("No processing status data is available yet.")


def render_processing_page() -> None:
    st.header("Document Processing")
    st.subheader("Upload Financial Document")

    uploaded_file = st.file_uploader(
        "Choose a PDF, PNG, JPG, or JPEG file",
        type=["pdf", "png", "jpg", "jpeg"],
        help="Upload an invoice, receipt, bank statement, or other financial document.",
    )

    if uploaded_file is not None:
        st.markdown(
            f"""
            <div class="docubrix-shell">
                <div class="section-label">Selected file</div>
                <div><strong>{uploaded_file.name}</strong></div>
                <div>{uploaded_file.size} bytes</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        if st.button("Process document"):
            try:
                payload = api_upload("/documents/upload", uploaded_file)
                st.session_state["processed_document"] = payload
                st.success("Document processed successfully.")
            except Exception as exc:  # pragma: no cover - UI error path
                st.error(str(exc))

    if "processed_document" in st.session_state:
        result = st.session_state["processed_document"]
        st.subheader("Processing result")
        cols = st.columns(4)
        with cols[0]:
            st.metric("Filename", result.get("filename", "-"))
        with cols[1]:
            st.metric("Document type", normalize_doc_type(result.get("document_type") or "unknown"))
        with cols[2]:
            st.metric("Status", result.get("status", "processed"))
        with cols[3]:
            score = (result.get("confidence") or {}).get("overall")
            st.metric("Overall confidence", f"{score:.2f}" if isinstance(score, (int, float)) else "Not available")

        extracted_fields = result.get("extracted_fields", {})
        validation = result.get("validation", {})
        confidence = result.get("confidence") or {}

        st.markdown("### Extracted information")
        if extracted_fields:
            row_items = []
            for key, value in extracted_fields.items():
                if key == "document_type":
                    continue
                row_items.append({"Field": key.replace("_", " ").title(), "Value": value or "Not available"})
            st.table(row_items)
        else:
            st.info("No extracted fields were returned by the backend for this document.")

        st.markdown("### Confidence")
        if confidence:
            signals = confidence.get("signals", {})
            for key, value in signals.items():
                label = key.replace("_", " ").title()
                score_value = float(value) if isinstance(value, (int, float)) else 0.0
                st.markdown(f"**{label}**")
                st.progress(min(1.0, max(0.0, score_value)))
                st.caption(f"{score_value:.2f}")
        else:
            st.info("No confidence data is available for this document.")

        st.markdown("### Validation")
        if validation:
            st.markdown(f"Validation status: {validation_badge(validation)}", unsafe_allow_html=True)
            if validation.get("errors"):
                st.warning("\n".join(validation["errors"]))
            if validation.get("warnings"):
                st.info("\n".join(validation["warnings"]))
        else:
            st.info("Validation data was not returned by the backend.")

        with st.expander("View extracted text"):
            st.text_area("OCR / extracted text", result.get("raw_text", ""), height=220)

        st.markdown("### Human review")
        if extracted_fields:
            manual_fields = {}
            for key, value in extracted_fields.items():
                if key == "document_type":
                    continue
                manual_fields[key] = st.text_input(f"Edit {key.replace('_', ' ').title()}", value=str(value) if value not in (None, "") else "")

            if st.button("Save Corrections"):
                payload = {"manual_corrections": {key: value for key, value in manual_fields.items() if value not in (None, "")}}
                try:
                    review_response = api_post_json(f"/documents/{result.get('document_id')}/review", payload)
                    st.success("Review corrections saved successfully.")
                    st.json(review_response)
                except Exception as exc:  # pragma: no cover - UI error path
                    st.error(str(exc))
        else:
            st.info("There are no extracted fields currently available for manual review.")


def render_library_page() -> None:
    st.header("Document Library")
    try:
        payload = api_get("/documents")
        documents = payload.get("documents", [])
    except Exception as exc:
        st.warning(str(exc))
        return

    if not documents:
        st.info("No processed documents are available yet.")
        return

    type_options = ["All"] + sorted({doc.get("document_type") or "unknown" for doc in documents})
    status_options = ["All"] + sorted({doc.get("status") or "unknown" for doc in documents})

    selected_type = st.selectbox("Filter by document type", type_options)
    selected_status = st.selectbox("Filter by status", status_options)

    filtered = documents
    if selected_type != "All":
        filtered = [doc for doc in filtered if (doc.get("document_type") or "unknown") == selected_type]
    if selected_status != "All":
        filtered = [doc for doc in filtered if (doc.get("status") or "unknown") == selected_status]

    if not filtered:
        st.info("No documents match the selected filters.")
        return

    st.dataframe(
        [
            {
                "Filename": doc.get("filename", "-"),
                "Type": normalize_doc_type(doc.get("document_type") or "unknown"),
                "Status": doc.get("status", "unknown"),
                "Confidence": (doc.get("confidence") or {}).get("overall", "Not available"),
                "Date": doc.get("upload_time", "-"),
            }
            for doc in filtered
        ],
        use_container_width=True,
        hide_index=True,
    )

    selected_document = st.selectbox("Select a document to inspect", [doc.get("filename", "-") for doc in filtered])
    selected = next((doc for doc in filtered if doc.get("filename") == selected_document), None)
    if selected:
        doc_id = selected.get("document_id")
        if doc_id:
            detail = api_get(f"/documents/{doc_id}")
            st.subheader("Document details")
            st.json({
                "filename": detail.get("filename"),
                "document_type": detail.get("document_type"),
                "status": detail.get("status"),
                "confidence": detail.get("confidence"),
                "validation": detail.get("validation"),
                "extracted_fields": detail.get("extracted_fields"),
            })


def render_review_queue_page() -> None:
    st.header("Review Queue")
    try:
        payload = api_get("/documents")
        documents = payload.get("documents", [])
    except Exception as exc:
        st.warning(str(exc))
        return

    review_queue = []
    for document in documents:
        validation = (document.get("validation") or {})
        review_json = document.get("review_json") or {}
        if validation.get("is_valid") is False or bool(review_json.get("manual_corrections")):
            review_queue.append(document)

    if not review_queue:
        st.info("No documents currently require manual review.")
        st.caption("The current backend exposes review metadata via document validation and manual corrections; a dedicated review-list endpoint is not yet implemented.")
        return

    st.caption("This queue is built from documents whose validation results or saved manual corrections indicate a review action is needed.")
    st.dataframe(
        [
            {
                "Filename": doc.get("filename", "-"),
                "Reason": "Validation failed" if (doc.get("validation") or {}).get("is_valid") is False else "Manual correction recorded",
                "Confidence": (doc.get("confidence") or {}).get("overall", "Not available"),
                "Status": doc.get("status", "unknown"),
            }
            for doc in review_queue
        ],
        use_container_width=True,
        hide_index=True,
    )


def render_analytics_page() -> None:
    st.header("Analytics")
    try:
        summary = api_get("/documents/summary")
    except Exception as exc:
        st.warning(str(exc))
        return

    if not summary.get("total_documents"):
        st.info("No document analytics are available yet.")
        return

    cols = st.columns(2)
    with cols[0]:
        st.subheader("Document type distribution")
        st.bar_chart(summary.get("document_type_distribution", {}))
    with cols[1]:
        st.subheader("Processing status distribution")
        st.bar_chart(summary.get("status_distribution", {}))

    st.subheader("Confidence distribution")
    docs = api_get("/documents").get("documents", [])
    confidence_values = []
    for doc in docs:
        value = (doc.get("confidence") or {}).get("overall")
        if isinstance(value, (int, float)):
            confidence_values.append(float(value))

    if confidence_values:
        bucket_high = sum(1 for value in confidence_values if value >= 0.75)
        bucket_medium = sum(1 for value in confidence_values if 0.45 <= value < 0.75)
        bucket_low = sum(1 for value in confidence_values if value < 0.45)
        st.bar_chart({"High": bucket_high, "Medium": bucket_medium, "Low": bucket_low})
    else:
        st.info("No confidence values are currently available for analytics.")

    st.subheader("Validation and review statistics")
    valid_docs = sum(1 for doc in docs if (doc.get("validation") or {}).get("is_valid") is True)
    invalid_docs = sum(1 for doc in docs if (doc.get("validation") or {}).get("is_valid") is False)
    reviewed_docs = sum(1 for doc in docs if (doc.get("review_json") or {}).get("manual_corrections"))
    st.write({"Valid": valid_docs, "Needs review": invalid_docs, "Manual corrections": reviewed_docs})


def render_system_status_page() -> None:
    st.header("System Status")
    try:
        health = api_get("/health")
    except Exception as exc:
        st.error(str(exc))
        st.caption("Backend status unavailable. Check the configured DOCUBRIX_API_URL value and backend deployment.")
        return

    database_status = (health.get("database") or {}).get("status", "unknown")
    db_url = (health.get("database") or {}).get("url", "Not available")

    cols = st.columns(3)
    with cols[0]:
        st.metric("Backend status", "Online" if health.get("status") == "ok" else "Offline")
    with cols[1]:
        st.metric("Database status", str(database_status))
    with cols[2]:
        st.metric("Environment", str(health.get("environment", "Not available")))

    st.subheader("Runtime details")
    st.json({
        "backend_url": f"{API_BASE_URL}/health",
        "database_url": db_url,
        "service": health.get("service", "DocuBrix"),
        "version": health.get("version", "Not available"),
        "ocr_available": "Not exposed by current health endpoint",
        "api_endpoint_status": "Healthy" if health.get("status") == "ok" else "Unavailable",
    })


navigation = st.sidebar.radio(
    "Navigation",
    ["Dashboard", "Document Processing", "Document Library", "Review Queue", "Analytics", "System Status"],
)

if navigation == "Dashboard":
    render_dashboard_page()
elif navigation == "Document Processing":
    render_processing_page()
elif navigation == "Document Library":
    render_library_page()
elif navigation == "Review Queue":
    render_review_queue_page()
elif navigation == "Analytics":
    render_analytics_page()
else:
    render_system_status_page()

st.sidebar.markdown("---")
st.sidebar.caption(f"Backend target: {API_BASE_URL}")
