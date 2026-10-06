import os
from typing import Any

import httpx
import streamlit as st

API_BASE_URL = os.getenv("DOCUBRIX_API_URL", "http://127.0.0.1:8000").rstrip("/")
NAV_ITEMS = [
    "Dashboard",
    "Document Processing",
    "Document Library",
    "Review Queue",
    "Analytics",
    "System Status",
    "Profile",
    "Settings",
]

st.set_page_config(page_title="DocuBrix", page_icon="📄", layout="wide")

if "authenticated" not in st.session_state:
    st.session_state.authenticated = True
if "current_page" not in st.session_state:
    st.session_state.current_page = "Dashboard"
if "profile" not in st.session_state:
    st.session_state.profile = {
        "name": "Alex Morgan",
        "email": "alex@docubrix.ai",
        "phone": "+1 (415) 555-0127",
        "company": "Northstar Finance",
        "title": "Operations Analyst",
        "location": "San Francisco, CA",
        "bio": "Focused on financial workflow automation, document intelligence, and review optimization.",
    }
if "settings" not in st.session_state:
    st.session_state.settings = {
        "notifications": True,
        "dark_mode": False,
        "auto_review": True,
        "save_history": True,
    }

st.markdown(
    """
    <style>
        :root {
            --bg: #f4f7fb;
            --panel: #ffffff;
            --panel-soft: #f8fafc;
            --surface: #eef4ff;
            --border: #dfe7f1;
            --primary: #1d4ed8;
            --primary-deep: #153a9a;
            --primary-soft: #e8eeff;
            --text: #0f172a;
            --text-soft: #475569;
            --success: #0f9f6e;
            --warning: #d97706;
            --danger: #dc2626;
            --shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }
        .stApp {
            background: var(--bg);
            color: var(--text);
        }
        .block-container {
            padding-top: 1.5rem;
            padding-bottom: 2rem;
        }
        .brand-shell {
            background: linear-gradient(180deg, #ffffff, #f7f9ff);
            border-radius: 18px;
            border: 1px solid var(--border);
            padding: 1.1rem 1rem;
            box-shadow: var(--shadow);
            margin-bottom: 1rem;
        }
        .brand-name {
            font-size: 1.1rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: var(--text);
            margin: 0;
        }
        .brand-tag {
            color: var(--text-soft);
            font-size: 0.72rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            margin-top: 0.2rem;
        }
        .shell-card {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 1.25rem 1.35rem;
            box-shadow: var(--shadow);
            margin-bottom: 1rem;
        }
        .metric-card {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 1rem 1rem 0.9rem;
            height: 100%;
            box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
        }
        .section-label {
            font-size: 0.72rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--text-soft);
            font-weight: 700;
            margin-bottom: 0.4rem;
        }
        .display-number {
            font-size: 2.1rem;
            font-weight: 800;
            letter-spacing: -0.05em;
            line-height: 1.1;
            margin: 0.4rem 0;
        }
        .muted {
            color: var(--text-soft);
            font-size: 0.82rem;
        }
        .status-pill {
            display: inline-block;
            padding: 0.33rem 0.7rem;
            border-radius: 999px;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }
        .pill-valid { background: rgba(15, 159, 110, 0.12); color: var(--success); }
        .pill-review { background: rgba(217, 119, 6, 0.12); color: var(--warning); }
        .pill-invalid { background: rgba(220, 38, 38, 0.12); color: var(--danger); }
        .pill-info { background: rgba(29, 78, 216, 0.12); color: var(--primary); }
        .data-card {
            background: var(--panel-soft);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 0.9rem 1rem;
            min-height: 70px;
        }
        .nav-item {
            border-radius: 12px;
            padding: 0.7rem 0.8rem;
            margin: 0.15rem 0;
        }
        .nav-item:hover {
            background: rgba(29, 78, 216, 0.05);
        }
        .nav-item[data-selected="true"] {
            background: rgba(29, 78, 216, 0.08);
            color: var(--primary-deep);
            font-weight: 700;
        }
        .sidebar .sidebar-content {
            background: #f8fafc;
            border-right: 1px solid var(--border);
        }
        .topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 0.6rem;
            margin-bottom: 1.1rem;
            border-bottom: 1px solid var(--border);
        }
        .topbar-actions {
            display: flex;
            gap: 0.75rem;
            align-items: center;
        }
        .avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1d4ed8, #6d8cff);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 0.8rem;
        }
        .mini-button {
            border-radius: 10px;
            border: 1px solid var(--border);
            background: white;
            padding: 0.5rem 0.8rem;
            font-weight: 600;
        }
        .primary-button {
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 0.65rem 1rem;
            font-weight: 700;
        }
        .ghost-button {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text);
            border-radius: 10px;
            padding: 0.65rem 1rem;
            font-weight: 600;
        }
        .empty-panel {
            background: #edf4ff;
            border: 1px solid #d7e8ff;
            border-radius: 14px;
            padding: 1rem;
            color: var(--text-soft);
        }
        .pill-danger { background: rgba(220, 38, 38, 0.12); color: var(--danger); }
        .pill-warning { background: rgba(217, 119, 6, 0.12); color: var(--warning); }
        .pill-success { background: rgba(15, 159, 110, 0.12); color: var(--success); }
        .progress-wrap { margin: 0.4rem 0 0.8rem; }
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
    except Exception as exc:
        raise RuntimeError(f"Unable to connect to the processing service. Please verify the backend is running.") from exc


def api_post_json(endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{API_BASE_URL}{endpoint}"
    try:
        response = httpx.post(url, json=payload, timeout=30.0)
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        raise RuntimeError("Document processing failed. Please try again.") from exc


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
    except Exception as exc:
        raise RuntimeError("Document processing failed. Please try again.") from exc


def format_doc_type(value: str) -> str:
    return value.replace("_", " ").title() if value else "Unknown"


def metric_card(label: str, value: str, hint: str) -> None:
    st.markdown('<div class="metric-card">', unsafe_allow_html=True)
    st.markdown(f'<div class="section-label">{label}</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="display-number">{value}</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="muted">{hint}</div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)


def status_badge(status: str) -> str:
    status_key = (status or "").lower()
    if status_key in {"valid", "processed", "reviewed", "success", "ok"}:
        return '<span class="status-pill pill-valid">Valid</span>'
    if status_key in {"warning", "needs review", "review", "manual correction"}:
        return '<span class="status-pill pill-review">Review</span>'
    return '<span class="status-pill pill-info">Info</span>'


def render_auth_screen() -> None:
    st.markdown(
        """
        <div class="shell-card">
            <div style="font-size: 2.3rem; font-weight: 800; letter-spacing: -0.06em; margin-bottom: 0.25rem;">DocuBrix</div>
            <div style="font-size: 1.2rem; color: #475569; font-weight: 600;">Intelligent Document Lifecycle, Analytics & Workflow Automation</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    tab = st.tabs(["Login", "Register", "Reset password"])
    with tab[0]:
        with st.form("login_form"):
            st.subheader("Welcome back")
            email = st.text_input("Email address")
            password = st.text_input("Password", type="password")
            submitted = st.form_submit_button("Sign in")
            if submitted:
                if email and password:
                    st.session_state.authenticated = True
                    st.session_state.current_page = "Dashboard"
                    st.success("Demo session activated. This interface is ready for real backend authentication in a future phase.")
                else:
                    st.warning("Please enter your email and password.")
    with tab[1]:
        with st.form("register_form"):
            st.subheader("Create account")
            name = st.text_input("Full name")
            email = st.text_input("Work email")
            company = st.text_input("Organization")
            submitted = st.form_submit_button("Create account")
            if submitted:
                if name and email:
                    st.session_state.authenticated = True
                    st.session_state.current_page = "Dashboard"
                    st.success("Account created in demo mode. Backend authentication can be connected later.")
                else:
                    st.warning("Please complete the required registration fields.")
    with tab[2]:
        with st.form("reset_form"):
            st.subheader("Reset password")
            email = st.text_input("Email address to reset")
            submitted = st.form_submit_button("Send reset link")
            if submitted:
                if email:
                    st.success("Password reset instructions would be sent to the provided email in a live system.")
                else:
                    st.warning("Please enter an email address.")


def render_sidebar() -> str:
    with st.sidebar:
        st.markdown(
            """
            <div class="brand-shell">
                <div class="brand-name">DocuBrix</div>
                <div class="brand-tag">Document intelligence</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        if st.session_state.authenticated:
            st.markdown(
                """
                <div class="shell-card" style="padding: 0.8rem 0.9rem; margin-bottom: 0.8rem;">
                    <div style="display:flex; align-items:center; gap: 0.7rem;">
                        <div class="avatar">AM</div>
                        <div>
                            <div style="font-weight: 700;">Alex Morgan</div>
                            <div class="muted">Northstar Finance</div>
                        </div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        selected = st.radio("Navigation", NAV_ITEMS, index=NAV_ITEMS.index(st.session_state.current_page), label_visibility="collapsed")
        st.session_state.current_page = selected
        st.markdown("---")
        if st.session_state.authenticated:
            if st.button("Log out", use_container_width=True):
                st.session_state.authenticated = False
                st.session_state.current_page = "Dashboard"
                st.rerun()
        st.caption(f"Backend target: {API_BASE_URL}")
    return selected


def render_dashboard_page() -> None:
    st.markdown(
        """
        <div class="shell-card">
            <div style="font-size: 2.3rem; font-weight: 800; letter-spacing: -0.06em; margin: 0 0 0.4rem 0;">DocuBrix</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: #0f172a;">Document Intelligence Dashboard</div>
            <div class="muted" style="margin-top: 0.5rem;">Operational overview for financial document processing, extraction quality, and review workflows.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    try:
        summary = api_get("/documents/summary")
    except Exception as exc:
        st.warning(str(exc))
        return

    cols = st.columns(4)
    with cols[0]:
        metric_card("Total documents processed", str(summary.get("total_documents", 0)), "Documents currently stored in the system")
    with cols[1]:
        metric_card("Documents requiring review", str(summary.get("documents_needing_review", 0)), "Items flagged by validation or manual corrections")
    with cols[2]:
        average = summary.get("average_confidence")
        value = "Not available" if average is None else f"{average:.2f}"
        metric_card("Average extraction confidence", value, "Across all stored documents")
    with cols[3]:
        metric_card("Successfully processed documents", str(summary.get("successful_documents", 0)), "Documents completed without blocking issues")

    st.subheader("Overview")
    type_distribution = summary.get("document_type_distribution", {})
    recent = summary.get("recent_documents", [])
    status_distribution = summary.get("status_distribution", {})

    cols = st.columns(2)
    with cols[0]:
        st.markdown('<div class="shell-card"><div class="section-label">Document type distribution</div>', unsafe_allow_html=True)
        if type_distribution:
            st.bar_chart(type_distribution)
        else:
            st.markdown('<div class="empty-panel">No document type data is available yet.</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
    with cols[1]:
        st.markdown('<div class="shell-card"><div class="section-label">Processing status</div>', unsafe_allow_html=True)
        if status_distribution:
            st.bar_chart(status_distribution)
        else:
            st.markdown('<div class="empty-panel">No processing status data is available yet.</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    st.subheader("Recent documents")
    if recent:
        rows = [{
            "Filename": item.get("filename", "-"),
            "Type": format_doc_type(item.get("document_type") or "unknown"),
            "Status": item.get("status", "unknown"),
            "Confidence": item.get("confidence", {}).get("overall", "Not available"),
            "Uploaded": item.get("upload_time", "-"),
        } for item in recent]
        st.dataframe(rows, use_container_width=True, hide_index=True)
    else:
        st.markdown('<div class="empty-panel">No recent documents are available yet.</div>', unsafe_allow_html=True)


def render_processing_page() -> None:
    st.header("Document Processing")
    st.caption("Upload a PDF or image and review the classified, extracted, validated output.")

    uploaded_file = st.file_uploader(
        "Upload financial document",
        type=["pdf", "png", "jpg", "jpeg"],
        help="Supported formats: PDF, PNG, JPG, JPEG",
    )

    if uploaded_file is not None:
        st.markdown(
            """
            <div class="shell-card">
                <div class="section-label">Selected file</div>
                <div style="font-size:1.1rem; font-weight:700;">{name}</div>
                <div class="muted" style="margin-top:0.2rem;">{size} bytes</div>
            </div>
            """.format(name=uploaded_file.name, size=uploaded_file.size),
            unsafe_allow_html=True,
        )

        if st.button("Process document", type="primary"):
            try:
                result = api_upload("/documents/upload", uploaded_file)
                st.session_state["processed_document"] = result
                st.success("Document processed successfully.")
            except Exception as exc:
                st.error(str(exc))

    if "processed_document" in st.session_state and st.session_state["processed_document"]:
        result = st.session_state["processed_document"]
        st.subheader("Processing result")
        overview_cols = st.columns(4)
        with overview_cols[0]:
            st.metric("Filename", result.get("filename", "-"))
        with overview_cols[1]:
            st.metric("Document type", format_doc_type(result.get("document_type") or "unknown"))
        with overview_cols[2]:
            st.metric("Status", result.get("status", "processed"))
        with overview_cols[3]:
            confidence_value = (result.get("confidence") or {}).get("overall")
            st.metric("Overall confidence", f"{confidence_value:.2f}" if isinstance(confidence_value, (int, float)) else "Not available")

        extracted_fields = result.get("extracted_fields", {})
        validation = result.get("validation", {})
        confidence = result.get("confidence") or {}

        st.subheader("Extracted information")
        if extracted_fields:
            field_rows = []
            for key, value in extracted_fields.items():
                if key != "document_type":
                    field_rows.append({"Field": key.replace("_", " ").title(), "Value": value or "Not available"})
            st.dataframe(field_rows, use_container_width=True, hide_index=True)
        else:
            st.info("No extracted fields were returned for this document.")

        st.subheader("Confidence")
        if confidence:
            signal_block = confidence.get("signals", {})
            if signal_block:
                for key, value in signal_block.items():
                    score = float(value) if isinstance(value, (int, float)) else 0.0
                    st.markdown(f"**{key.replace('_', ' ').title()}**")
                    st.progress(min(1.0, max(0.0, score)))
                    st.caption(f"{score:.2f}")
            else:
                st.info("No confidence signal data is available.")
        else:
            st.info("No confidence data is available for this document.")

        st.subheader("Validation")
        if validation:
            st.markdown(f"Validation status: {status_badge('valid' if validation.get('is_valid') else 'review')}", unsafe_allow_html=True)
            if validation.get("errors"):
                for item in validation["errors"]:
                    st.warning(item)
            if validation.get("warnings"):
                for item in validation["warnings"]:
                    st.info(item)
        else:
            st.info("No validation data was returned by the backend.")

        with st.expander("View extracted text"):
            st.text_area("OCR / extracted text", result.get("raw_text", ""), height=220)

        st.subheader("Human review")
        if extracted_fields:
            manual_values = {}
            for key, value in extracted_fields.items():
                if key == "document_type":
                    continue
                manual_values[key] = st.text_input(f"Edit {key.replace('_', ' ').title()}", value=str(value) if value not in (None, "") else "")
            if st.button("Save corrections"):
                payload = {"manual_corrections": {key: value for key, value in manual_values.items() if value not in (None, "")}}
                try:
                    response = api_post_json(f"/documents/{result.get('document_id')}/review", payload)
                    st.success("Review corrections saved successfully.")
                    st.json(response)
                except Exception as exc:
                    st.error(str(exc))
        else:
            st.info("There are no extracted fields available for review.")


def render_library_page() -> None:
    st.header("Document Library")
    try:
        payload = api_get("/documents")
        documents = payload.get("documents", [])
    except Exception as exc:
        st.warning(str(exc))
        return

    if not documents:
        st.markdown('<div class="empty-panel">No processed documents are available yet.</div>', unsafe_allow_html=True)
        return

    type_options = ["All"] + sorted({doc.get("document_type") or "unknown" for doc in documents})
    status_options = ["All"] + sorted({doc.get("status") or "unknown" for doc in documents})
    col1, col2 = st.columns(2)
    with col1:
        selected_type = st.selectbox("Document type", type_options)
    with col2:
        selected_status = st.selectbox("Status", status_options)

    filtered = documents
    if selected_type != "All":
        filtered = [doc for doc in filtered if (doc.get("document_type") or "unknown") == selected_type]
    if selected_status != "All":
        filtered = [doc for doc in filtered if (doc.get("status") or "unknown") == selected_status]

    rows = [{
        "Filename": doc.get("filename", "-"),
        "Type": format_doc_type(doc.get("document_type") or "unknown"),
        "Status": doc.get("status", "unknown"),
        "Confidence": (doc.get("confidence") or {}).get("overall", "Not available"),
        "Uploaded": doc.get("upload_time", "-"),
    } for doc in filtered]
    st.dataframe(rows, use_container_width=True, hide_index=True)

    if rows:
        selected_name = st.selectbox("Inspect a document", [row["Filename"] for row in rows])
        selected_doc = next((doc for doc in filtered if doc.get("filename") == selected_name), None)
        if selected_doc:
            detail = api_get(f"/documents/{selected_doc.get('document_id')}")
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
        documents = api_get("/documents").get("documents", [])
    except Exception as exc:
        st.warning(str(exc))
        return

    queue = []
    for doc in documents:
        validation = doc.get("validation") or {}
        review_json = doc.get("review_json") or {}
        if validation.get("is_valid") is False or bool(review_json.get("manual_corrections")):
            queue.append(doc)

    if not queue:
        st.markdown('<div class="empty-panel">No documents currently require manual review. The queue is empty.</div>', unsafe_allow_html=True)
        st.caption("The current backend exposes review metadata through validation outcomes and saved manual corrections; a dedicated review-endpoint is not yet implemented.")
        return

    st.dataframe([
        {
            "Filename": item.get("filename", "-"),
            "Reason": "Validation failed" if (item.get("validation") or {}).get("is_valid") is False else "Manual corrections recorded",
            "Confidence": (item.get("confidence") or {}).get("overall", "Not available"),
            "Status": item.get("status", "unknown"),
        }
        for item in queue
    ], use_container_width=True, hide_index=True)


def render_analytics_page() -> None:
    st.header("Analytics")
    try:
        summary = api_get("/documents/summary")
        documents = api_get("/documents").get("documents", [])
    except Exception as exc:
        st.warning(str(exc))
        return

    if not summary.get("total_documents"):
        st.markdown('<div class="empty-panel">No analytics are available yet. Upload a document to populate the metrics.</div>', unsafe_allow_html=True)
        return

    cols = st.columns(3)
    with cols[0]:
        metric_card("Total docs", str(summary.get("total_documents", 0)), "All stored documents")
    with cols[1]:
        metric_card("Valid", str(sum(1 for doc in documents if (doc.get("validation") or {}).get("is_valid") is True)), "Documents passing validation")
    with cols[2]:
        metric_card("Needs review", str(sum(1 for doc in documents if (doc.get("validation") or {}).get("is_valid") is False)), "Documents with issues")

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Document type distribution")
        st.bar_chart(summary.get("document_type_distribution", {}))
    with col2:
        st.subheader("Processing status")
        st.bar_chart(summary.get("status_distribution", {}))

    st.subheader("Confidence distribution")
    confidence_values = [float(doc.get("confidence", {}).get("overall")) for doc in documents if isinstance(doc.get("confidence", {}).get("overall"), (int, float))]
    if confidence_values:
        high = sum(1 for value in confidence_values if value >= 0.75)
        medium = sum(1 for value in confidence_values if 0.45 <= value < 0.75)
        low = sum(1 for value in confidence_values if value < 0.45)
        st.bar_chart({"High": high, "Medium": medium, "Low": low})
    else:
        st.markdown('<div class="empty-panel">No confidence values are available yet.</div>', unsafe_allow_html=True)


def render_system_status_page() -> None:
    st.header("System Status")
    try:
        health = api_get("/health")
    except Exception as exc:
        st.error(str(exc))
        return

    cols = st.columns(4)
    with cols[0]:
        st.metric("Backend", "Online" if health.get("status") == "ok" else "Offline")
    with cols[1]:
        st.metric("Database", str((health.get("database") or {}).get("status", "unknown")))
    with cols[2]:
        st.metric("Environment", str(health.get("environment", "unknown")))
    with cols[3]:
        st.metric("Service", health.get("service", "DocuBrix"))

    st.subheader("Runtime details")
    st.json({
        "backend_url": f"{API_BASE_URL}/health",
        "database_url": (health.get("database") or {}).get("url", "Not available"),
        "service": health.get("service", "DocuBrix"),
        "version": health.get("version", "Not available"),
        "ocr_status": "Available when Tesseract is installed in the runtime environment",
        "api_status": "Healthy" if health.get("status") == "ok" else "Unavailable",
    })


def render_profile_page() -> None:
    st.header("Profile")
    profile = st.session_state.profile
    col1, col2 = st.columns([1, 2])
    with col1:
        st.markdown(
            """
            <div class="shell-card" style="text-align:center;">
                <div class="avatar" style="width: 80px; height: 80px; font-size: 1.4rem; margin: 0 auto 1rem auto;">AM</div>
                <div style="font-size: 1.4rem; font-weight: 800;">Alex Morgan</div>
                <div class="muted">Operations Analyst</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col2:
        with st.form("profile_form"):
            st.text_input("Name", value=profile["name"])
            st.text_input("Email", value=profile["email"])
            st.text_input("Phone", value=profile["phone"])
            st.text_input("Company", value=profile["company"])
            st.text_input("Job title", value=profile["title"])
            st.text_input("Location", value=profile["location"])
            st.text_area("Bio", value=profile["bio"], height=140)
            if st.form_submit_button("Save profile"):
                st.success("Profile saved locally in the current demo session.")


def render_settings_page() -> None:
    st.header("Settings")
    settings = st.session_state.settings
    tabs = st.tabs(["Account", "Preferences", "Notifications", "Security"])
    with tabs[0]:
        st.checkbox("Enable workspace collaboration", value=True)
        st.checkbox("Allow document sharing", value=True)
    with tabs[1]:
        st.checkbox("Enable dark mode", value=settings["dark_mode"])
        st.checkbox("Auto-approve low-risk documents", value=settings["auto_review"])
        st.checkbox("Store processing history", value=settings["save_history"])
    with tabs[2]:
        st.checkbox("Email notifications", value=settings["notifications"])
        st.checkbox("Slack updates", value=False)
        st.checkbox("Weekly summary digest", value=True)
    with tabs[3]:
        st.info("Security controls are designed to be extended when backend authentication and RBAC are added in a future phase.")
        st.button("Enable two-factor authentication", type="secondary")
        st.button("Review API access", type="secondary")


def main() -> None:
    if not st.session_state.authenticated:
        render_auth_screen()
        return

    current_page = render_sidebar()

    if current_page == "Dashboard":
        render_dashboard_page()
    elif current_page == "Document Processing":
        render_processing_page()
    elif current_page == "Document Library":
        render_library_page()
    elif current_page == "Review Queue":
        render_review_queue_page()
    elif current_page == "Analytics":
        render_analytics_page()
    elif current_page == "System Status":
        render_system_status_page()
    elif current_page == "Profile":
        render_profile_page()
    else:
        render_settings_page()


main()

