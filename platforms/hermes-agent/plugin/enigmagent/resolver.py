"""
EnigmAgent Hermes Plugin — secret resolver (pre_tool_call hook).

┌─────────────────────────────────────────────────────────────────┐
│  SECURITY GUARANTEE                                             │
│                                                                 │
│  This hook fires BEFORE the tool executes.  The LLM writes     │
│  {{PLACEHOLDER}} patterns in tool arguments; the real secret    │
│  values are injected here, inside the gateway process, and     │
│  never travel to or from the LLM.                              │
│                                                                 │
│  What the LLM writes:   curl -H "Authorization: Bearer         │
│                         {{GITHUB_TOKEN}}" https://api.github…  │
│  What the tool runs:    curl -H "Authorization: Bearer          │
│                         ghp_xxxxxxxxxxxxxxxx" https://api.…    │
│  What the LLM sees:     the curl stdout (HTTP response body)   │
└─────────────────────────────────────────────────────────────────┘

Hook signature (matches Hermes pre_tool_call contract):

    def hook(tool_name: str, args: dict, task_id: str = "", **kwargs) -> None
        - args is modified **in-place**
        - raise to block the tool call (used only in strict mode)
"""

from __future__ import annotations

import logging
import re
from typing import Any, Callable

from .vault_client import VaultClient, VaultError

logger = logging.getLogger(__name__)

# ── Pattern matching ──────────────────────────────────────────────────────────

# Same regex used in the browser extension and CLI.
# Matches: {{GITHUB_TOKEN}}, {{LOGIN:github.com}}, {{DOC:report.md}}
PLACEHOLDER_RE = re.compile(r"\{\{([A-Za-z0-9_:\-.@]+)\}\}")


def _collect_placeholders(value: Any, out: set[str]) -> None:
    """Recursively walk a value tree and collect all {{PLACEHOLDER}} names."""
    if isinstance(value, str):
        for match in PLACEHOLDER_RE.finditer(value):
            out.add(match.group(1))
    elif isinstance(value, (list, tuple)):
        for item in value:
            _collect_placeholders(item, out)
    elif isinstance(value, dict):
        for v in value.values():
            _collect_placeholders(v, out)


def _substitute_values(value: Any, resolved: dict[str, str]) -> Any:
    """
    Deep-copy a value tree, replacing every ``{{NAME}}`` that has a resolved
    entry.  Unresolved placeholders are left unchanged (literal ``{{NAME}}``).
    """
    if isinstance(value, str):
        return PLACEHOLDER_RE.sub(
            lambda m: resolved.get(m.group(1), m.group(0)),
            value,
        )
    if isinstance(value, list):
        return [_substitute_values(item, resolved) for item in value]
    if isinstance(value, dict):
        return {k: _substitute_values(v, resolved) for k, v in value.items()}
    # numbers, booleans, None — untouched
    return value


# ── Hook factory ──────────────────────────────────────────────────────────────


def make_pre_tool_call_hook(
    client: VaultClient,
    *,
    strict_mode: bool = False,
    default_origin: str = "http://localhost",
) -> Callable:
    """
    Create and return a ``pre_tool_call`` hook function wired to the
    given *client*.

    Args:
        client:         VaultClient instance to use for resolution.
        strict_mode:    If ``True``, any unresolvable placeholder raises
                        RuntimeError and **blocks** the tool call.
                        If ``False`` (default), unresolvable placeholders
                        are left as-is and a warning is logged.
        default_origin: Origin string passed to the vault for domain-binding
                        checks.  For most Hermes tools this should be
                        ``"http://localhost"``.  Secrets must be added with
                        the matching domain:
                        ``enigmagent add MY_KEY @localhost <value>``

    Returns:
        A callable matching the Hermes ``pre_tool_call`` hook signature.
    """

    def on_pre_tool_call(
        tool_name: str,
        args: dict,
        task_id: str = "",
        **kwargs: Any,
    ) -> None:
        """
        Hermes pre_tool_call hook.  Resolves all {{PLACEHOLDER}} patterns
        in *args* before the tool executes.  Modifies *args* in-place.
        """
        # 1. Walk the args tree and collect unique placeholder names.
        found: set[str] = set()
        _collect_placeholders(args, found)

        if not found:
            return  # Fast path — nothing to resolve.

        # 2. Resolve all placeholders in parallel.
        origin = kwargs.get("origin", default_origin)
        batch_results = client.resolve_batch(
            [(p, origin) for p in found],
        )

        # 3. Separate resolved values from errors.
        resolved: dict[str, str] = {}
        failed: list[tuple[str, VaultError]] = []

        for placeholder, result in batch_results.items():
            if isinstance(result, VaultError):
                failed.append((placeholder, result))
            else:
                resolved[placeholder] = result

        # 4. Log summary (no secret values in logs — only names).
        if resolved:
            logger.debug(
                "[EnigmAgent] resolved %d secret(s) for tool '%s': %s",
                len(resolved),
                tool_name,
                ", ".join(f"{{{{{n}}}}}" for n in resolved),
            )
        if failed:
            logger.warning(
                "[EnigmAgent] unresolved placeholder(s) for tool '%s': %s",
                tool_name,
                ", ".join(f"{{{{{n}}}}} ({e.code})" for n, e in failed),
            )

        # 5. In strict mode, any failure is a hard error that blocks execution.
        if strict_mode and failed:
            names = ", ".join(f"{{{{{n}}}}}" for n, _ in failed)
            reasons = "; ".join(f"{n}: {e.code}" for n, e in failed)
            raise RuntimeError(
                f"[EnigmAgent] Cannot resolve required secret(s): {names}. "
                f"Details — {reasons}. "
                "Check that the vault server is running and the secrets exist:\n"
                "  enigmagent-mcp --mode rest --port 3737 --vault ~/.enigmagent/vault.json"
            )

        if not resolved:
            return  # Nothing was resolved, nothing to substitute.

        # 6. Patch args in-place (Hermes passes args by reference).
        patched = _substitute_values(args, resolved)
        args.clear()
        args.update(patched)

    return on_pre_tool_call
