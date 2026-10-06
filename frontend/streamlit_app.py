import json
import os
import urllib.request

import streamlit as st

API_BASE_URL = os.getenv("DOCUBRIX_API_URL", "http://localhost:8000")

st.set_page_config(page_title="DocuBrix", page_icon="📄")
st.title("DocuBrix")
st.caption("Financial document processing prototype")

st.write(f"Backend target: {API_BASE_URL}")

if st.button("Check backend health"):
    try:
        with urllib.request.urlopen(f"{API_BASE_URL}/health", timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
        st.success("Backend reachable")
        st.json(payload)
    except Exception as exc:
        st.error(f"Backend is not reachable: {exc}")
