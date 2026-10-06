import json
import urllib.request

import streamlit as st

st.set_page_config(page_title="DocuBrix", page_icon="📄")
st.title("DocuBrix")
st.caption("Phase 0 foundation check")

st.write("This prototype is in the project foundation phase. The backend health endpoint is the core working checkpoint.")

if st.button("Check backend health"):
    try:
        with urllib.request.urlopen("http://localhost:8000/health", timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
        st.success("Backend reachable")
        st.json(payload)
    except Exception as exc:
        st.error(f"Backend is not reachable: {exc}")
