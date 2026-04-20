"""
EnigmAgent Integration for Streamlit
======================================
Provides a Streamlit component and utility functions for vault integration.
Use in AI chat apps to resolve {{PLACEHOLDER}} tokens before LLM calls.

Requirements:
    pip install streamlit httpx
    enigmagent serve --port 39517

Usage:
    # In your Streamlit app:
    from enigmagent_streamlit import vault_sidebar, resolve

    vault_sidebar()  # adds vault config to sidebar
    prompt = resolve(user_input)  # resolve before sending to LLM
"""

import re
import httpx
import os
import streamlit as st
from typing import Optional

_VAULT_URL = os.environ.get("ENIGMAGENT_URL", "http://127.0.0.1:39517")
_VAULT_TOKEN = os.environ.get("ENIGMAGENT_TOKEN", "")


def _get_config():
    return (
        st.session_state.get("enigmagent_url", _VAULT_URL),
        st.session_state.get("enigmagent_token", _VAULT_TOKEN),
    )


@st.cache_data(ttl=300)
def _fetch(name: str, vault_url: str, vault_token: str) -> Optional[str]:
    headers: dict[str, str] = {}
    if vault_token:
        headers["Authorization"] = f"Bearer {vault_token}"
    try:
        with httpx.Client(timeout=3.0) as c:
            r = c.get(f"{vault_url.rstrip('/')}/secret/{name}", headers=headers)
            r.raise_for_status()
            return r.json().get("value")
    except Exception:
        return None


def resolve(text: str) -> str:
    """Resolve {{PLACEHOLDER}} tokens in text using the vault."""
    vault_url, vault_token = _get_config()
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    mapping = {n: v for n in names if (v := _fetch(n, vault_url, vault_token)) is not None}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


def vault_sidebar():
    """
    Add EnigmAgent vault configuration to the Streamlit sidebar.
    Call this in your app's main function.
    """
    with st.sidebar:
        st.subheader("EnigmAgent Vault")
        url = st.text_input(
            "Vault URL",
            value=st.session_state.get("enigmagent_url", _VAULT_URL),
            key="_ea_url_input",
        )
        st.session_state["enigmagent_url"] = url

        token = st.text_input(
            "Token (optional)",
            value=st.session_state.get("enigmagent_token", _VAULT_TOKEN),
            type="password",
            key="_ea_token_input",
        )
        st.session_state["enigmagent_token"] = token

        if st.button("Test Connection"):
            try:
                headers = {}
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                with httpx.Client(timeout=3.0) as c:
                    r = c.get(f"{url.rstrip('/')}/health", headers=headers)
                    data = r.json()
                st.success(f"Connected — {data.get('count', 0)} secrets stored")
            except Exception as e:
                st.error(f"Cannot connect: {e}")


# ── Example app ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    st.title("AI Chat with EnigmAgent")
    vault_sidebar()

    if "messages" not in st.session_state:
        st.session_state.messages = []

    for m in st.session_state.messages:
        with st.chat_message(m["role"]):
            st.write(m["content"])

    if prompt := st.chat_input("Message (use {{SECRET_NAME}} for vault secrets)"):
        resolved = resolve(prompt)
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.write(prompt)
        # Pass `resolved` to your LLM here...
        st.info(f"Resolved prompt: {resolved}")
