"""
EnigmAgent Extension for text-generation-webui
===============================================
Resolves {{PLACEHOLDER}} tokens in prompts using the local EnigmAgent vault
before they are sent to the model.

Installation:
  1. Copy this file to text-generation-webui/extensions/enigmagent/script.py
  2. Start the webui with --extensions enigmagent
     or enable it from the Extensions tab in the UI.
  3. Make sure EnigmAgent vault server is running:
       enigmagent serve --port 39517

The extension intercepts the input string, replaces all {{NAME}} tokens with
vault values, and forwards the resolved text to the model. The model never
receives or generates the original secret value.
"""

import re
import json
import urllib.request
import urllib.error
import gradio as gr

# ── Default settings (overridable via the Gradio UI) ──────────────────────────
params = {
    "display_name": "EnigmAgent Secret Resolver",
    "is_tab": False,
    "vault_url": "http://127.0.0.1:39517",
    "vault_token": "",
    "enabled": True,
    "show_resolved_count": True,
}

_secret_cache: dict[str, str] = {}


# ── Lifecycle hooks ────────────────────────────────────────────────────────────

def setup():
    """Called once when the extension loads."""
    _secret_cache.clear()
    print(f"[EnigmAgent] Extension loaded. Vault: {params['vault_url']}")


# ── Core resolution logic ──────────────────────────────────────────────────────

def _fetch_secret(name: str) -> str | None:
    """Retrieve a single secret from the vault REST API."""
    if name in _secret_cache:
        return _secret_cache[name]

    url = f"{params['vault_url'].rstrip('/')}/secret/{name}"
    headers: dict[str, str] = {"Accept": "application/json"}
    if params.get("vault_token"):
        headers["Authorization"] = f"Bearer {params['vault_token']}"

    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            value = json.loads(resp.read().decode()).get("value")
            if value:
                _secret_cache[name] = value
            return value
    except (urllib.error.URLError, json.JSONDecodeError, KeyError):
        return None


def _resolve(text: str) -> tuple[str, int]:
    """Replace {{NAME}} tokens; return (resolved_text, count_replaced)."""
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text, 0

    mapping = {n: v for n in names if (v := _fetch_secret(n)) is not None}

    def replacer(m: re.Match) -> str:
        return mapping.get(m.group(1), m.group(0))

    result = re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", replacer, text)
    return result, len(mapping)


# ── text-generation-webui hooks ────────────────────────────────────────────────

def input_modifier(string: str, state: dict, is_chat: bool = False) -> str:
    """Called on every user message before it reaches the model."""
    if not params.get("enabled"):
        return string

    resolved, count = _resolve(string)
    if count > 0 and params.get("show_resolved_count"):
        print(f"[EnigmAgent] Resolved {count} secret(s) in prompt.")
    return resolved


def output_modifier(string: str, state: dict, is_chat: bool = False) -> str:
    """Called on model output — no-op, secrets should not appear in output."""
    return string


def custom_generate_chat_prompt(user_input: str, state: dict, **kwargs):
    """Optional: resolve placeholders in the full chat context."""
    # Let the default handler proceed; input_modifier already resolved user_input.
    raise NotImplementedError


# ── Gradio UI (settings tab) ───────────────────────────────────────────────────

def ui():
    """Render the extension settings panel inside text-generation-webui."""
    with gr.Accordion("EnigmAgent Settings", open=False):
        with gr.Row():
            enabled_cb = gr.Checkbox(
                value=params["enabled"],
                label="Enable placeholder resolution",
            )
            show_count_cb = gr.Checkbox(
                value=params["show_resolved_count"],
                label="Log resolved secret count",
            )
        vault_url_box = gr.Textbox(
            value=params["vault_url"],
            label="Vault URL",
            placeholder="http://127.0.0.1:39517",
        )
        vault_token_box = gr.Textbox(
            value=params["vault_token"],
            label="Vault Token (optional)",
            placeholder="leave empty if vault is on localhost",
            type="password",
        )
        status_btn = gr.Button("Test connection")
        status_out = gr.Textbox(label="Status", interactive=False)

        # Wire up live updates
        enabled_cb.change(lambda v: params.update({"enabled": v}), enabled_cb, None)
        show_count_cb.change(lambda v: params.update({"show_resolved_count": v}), show_count_cb, None)
        vault_url_box.change(lambda v: params.update({"vault_url": v}) or _secret_cache.clear(), vault_url_box, None)
        vault_token_box.change(lambda v: params.update({"vault_token": v}) or _secret_cache.clear(), vault_token_box, None)

        def test_connection():
            url = f"{params['vault_url'].rstrip('/')}/health"
            headers: dict = {}
            if params.get("vault_token"):
                headers["Authorization"] = f"Bearer {params['vault_token']}"
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=3) as r:
                    data = json.loads(r.read().decode())
                    return f"Connected — vault status: {data.get('status', 'ok')}"
            except Exception as e:
                return f"Connection failed: {e}"

        status_btn.click(test_connection, outputs=status_out)
