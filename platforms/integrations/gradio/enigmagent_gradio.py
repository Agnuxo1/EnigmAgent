"""
EnigmAgent Integration for Gradio
====================================
Provides a Gradio component and utilities for vault secret resolution
in AI chat interfaces.

Requirements:
    pip install gradio httpx
    enigmagent serve --port 39517

Usage:
    from enigmagent_gradio import enigmagent_chat_wrapper, create_vault_settings

    with gr.Blocks() as demo:
        create_vault_settings()
        chatbot = gr.Chatbot()
        msg = gr.Textbox(placeholder="Use {{SECRET_NAME}} for vault secrets")
        msg.submit(enigmagent_chat_wrapper(your_chat_fn), [msg, chatbot], [msg, chatbot])
"""

import re
import httpx
import os
import gradio as gr
from functools import wraps

_VAULT_URL = os.environ.get("ENIGMAGENT_URL", "http://127.0.0.1:39517")
_VAULT_TOKEN = os.environ.get("ENIGMAGENT_TOKEN", "")
_cache: dict[str, str] = {}
_current_url = _VAULT_URL
_current_token = _VAULT_TOKEN


def configure(vault_url: str, vault_token: str = "") -> None:
    global _current_url, _current_token
    _current_url = vault_url.rstrip("/")
    _current_token = vault_token
    _cache.clear()


def _fetch(name: str) -> str | None:
    if name in _cache:
        return _cache[name]
    headers: dict[str, str] = {}
    if _current_token:
        headers["Authorization"] = f"Bearer {_current_token}"
    try:
        with httpx.Client(timeout=3.0) as c:
            r = c.get(f"{_current_url}/secret/{name}", headers=headers)
            r.raise_for_status()
            value = r.json().get("value")
            if value:
                _cache[name] = value
            return value
    except Exception:
        return None


def resolve(text: str) -> str:
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text
    mapping = {n: v for n in names if (v := _fetch(n)) is not None}
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", lambda m: mapping.get(m.group(1), m.group(0)), text)


def enigmagent_chat_wrapper(chat_fn):
    """
    Decorator for Gradio chat functions.
    Resolves {{PLACEHOLDER}} tokens before calling the underlying function.

    Usage:
        @enigmagent_chat_wrapper
        def respond(message, history):
            # message is already resolved
            return your_llm_call(message)
    """
    @wraps(chat_fn)
    def wrapper(message, history=None, *args, **kwargs):
        resolved = resolve(message)
        if history is None:
            return chat_fn(resolved, *args, **kwargs)
        return chat_fn(resolved, history, *args, **kwargs)
    return wrapper


def create_vault_settings() -> gr.Accordion:
    """Create a collapsible Gradio accordion with vault settings."""
    with gr.Accordion("EnigmAgent Vault Settings", open=False) as acc:
        with gr.Row():
            url_input = gr.Textbox(
                value=_current_url,
                label="Vault URL",
                placeholder="http://127.0.0.1:39517",
                scale=3,
            )
            token_input = gr.Textbox(
                value="",
                label="Token (optional)",
                type="password",
                scale=2,
            )
        with gr.Row():
            test_btn = gr.Button("Test Connection", scale=1)
            status_out = gr.Textbox(label="Status", interactive=False, scale=3)

        def _update(url, token):
            configure(url, token)
            return f"Configured: {url}"

        def _test(url, token):
            configure(url, token)
            try:
                headers = {}
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                with httpx.Client(timeout=3.0) as c:
                    r = c.get(f"{url.rstrip('/')}/health", headers=headers)
                    data = r.json()
                return f"Connected — {data.get('count', 0)} secrets, status: {data.get('status', 'ok')}"
            except Exception as e:
                return f"Connection failed: {e}"

        url_input.change(_update, [url_input, token_input], status_out)
        test_btn.click(_test, [url_input, token_input], status_out)

    return acc


# ── Example app ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    def echo_resolved(message, history):
        resolved = resolve(message)
        return resolved

    with gr.Blocks(title="EnigmAgent × Gradio Demo") as demo:
        gr.Markdown("# EnigmAgent Gradio Demo\nUse `{{SECRET_NAME}}` in your messages.")
        create_vault_settings()
        gr.ChatInterface(
            fn=enigmagent_chat_wrapper(echo_resolved),
            chatbot=gr.Chatbot(height=400),
            textbox=gr.Textbox(placeholder="Try: My API key is {{OPENAI_KEY}}"),
        )

    demo.launch()
