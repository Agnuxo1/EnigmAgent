"""
EnigmAgent Integration for Chainlit
=====================================
Two patterns:
  A. Message pre-processor — resolve {{PLACEHOLDER}} in every user message.
  B. Action button — let users trigger secret resolution manually.

Usage:
  from enigmagent_action import enigmagent_middleware, resolve_placeholders

  Add @cl.on_message with enigmagent_middleware, or use the
  @cl.action_callback("resolve_secrets") decorator.

Requirements:
  - pip install chainlit httpx
  - enigmagent serve --port 39517
"""

import re
import httpx
import chainlit as cl
from functools import wraps

VAULT_URL = "http://127.0.0.1:39517"
VAULT_TOKEN = ""  # set via env var ENIGMAGENT_TOKEN or configure below

_cache: dict[str, str] = {}


# ── Core resolution ────────────────────────────────────────────────────────────

async def _fetch_secret(name: str) -> str | None:
    if name in _cache:
        return _cache[name]
    url = f"{VAULT_URL.rstrip('/')}/secret/{name}"
    headers: dict[str, str] = {}
    if VAULT_TOKEN:
        headers["Authorization"] = f"Bearer {VAULT_TOKEN}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            value = resp.json().get("value")
            if value:
                _cache[name] = value
            return value
    except Exception:
        return None


async def resolve_placeholders(text: str) -> tuple[str, int]:
    """Replace {{NAME}} tokens; returns (resolved_text, count)."""
    names = list(set(re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text)))
    if not names:
        return text, 0

    import asyncio
    values = await asyncio.gather(*[_fetch_secret(n) for n in names])
    mapping = {n: v for n, v in zip(names, values) if v is not None}

    result = re.sub(
        r"\{\{([A-Za-z0-9_]+)\}\}",
        lambda m: mapping.get(m.group(1), m.group(0)),
        text,
    )
    return result, len(mapping)


# ── Middleware decorator ───────────────────────────────────────────────────────

def enigmagent_middleware(fn):
    """
    Decorator for @cl.on_message handlers.
    Resolves {{PLACEHOLDER}} in every incoming message.

    Usage:
        @cl.on_message
        @enigmagent_middleware
        async def on_message(message: cl.Message):
            ...  # message.content is already resolved
    """
    @wraps(fn)
    async def wrapper(message: cl.Message):
        resolved, count = await resolve_placeholders(message.content)
        if count:
            message.content = resolved
            await cl.Message(
                content=f"*EnigmAgent resolved {count} secret(s)*",
                author="EnigmAgent",
                indent=1,
            ).send()
        return await fn(message)
    return wrapper


# ── Action button ─────────────────────────────────────────────────────────────

async def add_resolve_action(step: cl.Step | None = None):
    """
    Add an 'Unlock Secrets' action button to the current message/step.
    Call this inside your on_message handler to give users a manual trigger.
    """
    actions = [
        cl.Action(
            name="resolve_secrets",
            label="Unlock Secrets",
            description="Resolve {{PLACEHOLDER}} tokens using the EnigmAgent vault.",
            payload={},
        )
    ]
    if step:
        step.actions = actions
    else:
        await cl.Message(content="", actions=actions).send()


@cl.action_callback("resolve_secrets")
async def on_resolve_action(action: cl.Action):
    """Triggered when the user clicks 'Unlock Secrets'."""
    # Retrieve the pending text from session state
    text = cl.user_session.get("pending_text", "")
    if not text:
        await cl.Message(content="No pending text to resolve.").send()
        return

    resolved, count = await resolve_placeholders(text)
    cl.user_session.set("resolved_text", resolved)

    await cl.Message(
        content=f"EnigmAgent resolved {count} secret(s). Proceeding...",
        author="EnigmAgent",
    ).send()
    await action.remove()


# ── Example app ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Run with: chainlit run enigmagent_action.py

    @cl.on_chat_start
    async def start():
        await cl.Message(
            content="EnigmAgent is active. Use {{SECRET_NAME}} in your messages.",
            author="EnigmAgent",
        ).send()

    @cl.on_message
    @enigmagent_middleware
    async def main(message: cl.Message):
        await cl.Message(
            content=f"Received (resolved): {message.content}"
        ).send()
