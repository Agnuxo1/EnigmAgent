"""
OpenAI-compatible client wrapper with EnigmAgent vault resolution.
Works with any OpenAI-compatible API (OpenAI, Anthropic, Ollama, LM Studio, vLLM, etc.)
"""

from __future__ import annotations
from ..vault import Vault

_vault = Vault()


def patch_openai_client(client, vault: Vault | None = None):
    """
    Monkey-patch an openai.OpenAI (or AsyncOpenAI) client to resolve
    {{PLACEHOLDER}} tokens before every API call.

    Usage:
        from openai import OpenAI
        from enigmagent.integrations.openai_compat import patch_openai_client
        client = patch_openai_client(OpenAI(api_key=enigmagent.get("OPENAI_KEY")))
    """
    v = vault or _vault
    original = client.chat.completions.create

    def patched_create(*, messages=None, **kwargs):
        if messages:
            messages = [
                {**m, "content": v.resolve(m["content"])} if isinstance(m.get("content"), str) else m
                for m in messages
            ]
        return original(messages=messages, **kwargs)

    client.chat.completions.create = patched_create
    return client


def wrap_openai(api_key_secret: str = "OPENAI_KEY", model: str = "gpt-4o-mini", vault: Vault | None = None, **kwargs):
    """
    Create a pre-configured OpenAI client using a vault secret as the API key.

    Usage:
        from enigmagent.integrations.openai_compat import wrap_openai
        client = wrap_openai()   # uses OPENAI_KEY from vault
    """
    from openai import OpenAI
    v = vault or _vault
    key = v.get(api_key_secret)
    client = OpenAI(api_key=key, **kwargs)
    return patch_openai_client(client, v)


def wrap_anthropic(api_key_secret: str = "ANTHROPIC_KEY", vault: Vault | None = None, **kwargs):
    """
    Create a pre-configured Anthropic client using a vault secret.

    Usage:
        from enigmagent.integrations.openai_compat import wrap_anthropic
        client = wrap_anthropic()  # uses ANTHROPIC_KEY from vault
    """
    import anthropic
    v = vault or _vault
    key = v.get(api_key_secret)
    return anthropic.Anthropic(api_key=key, **kwargs)
