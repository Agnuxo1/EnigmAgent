"""
enigmagent.tools.mem0 — Mem0 (memory agent) integration.

Provides vault-aware memory storage: when storing or retrieving facts,
{{PLACEHOLDER}} references are resolved before being written to Mem0.

Compatible with mem0ai >= 0.1.0.

Install:
    pip install enigmagent[mem0]

Usage:
    from enigmagent.tools.mem0 import EnigmAgentMemory

    mem = EnigmAgentMemory(user_id="alice")
    # Store a fact that references a credential placeholder
    mem.add("My GitHub token placeholder is {{GITHUB_TOKEN}}", user_id="alice")
"""

from __future__ import annotations

import re
from typing import Optional

from ..client import VaultClient, VaultError, get_client

try:
    from mem0 import Memory
except ImportError as exc:
    raise ImportError(
        "mem0ai is required for enigmagent.tools.mem0.\n"
        "Install with: pip install enigmagent[mem0]"
    ) from exc

PLACEHOLDER_RE = re.compile(r"\{\{([A-Za-z0-9_:\-.@]+)\}\}")


class EnigmAgentMemory(Memory):
    """
    Mem0 Memory subclass that resolves {{PLACEHOLDER}} references
    before writing facts to the memory store.

    This ensures that credential references in agent memories never
    expose real values — they remain as symbolic placeholders.
    """

    def __init__(
        self,
        client: Optional[VaultClient] = None,
        resolve_on_read: bool = False,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._vault = client or get_client()
        self._resolve_on_read = resolve_on_read

    def _redact_secrets(self, text: str) -> str:
        """Replace any accidentally-resolved secret with its placeholder back."""
        # This is a safety net — by design, placeholders should never be resolved
        # before being stored in Mem0. Return text unchanged; subclasses can override.
        return text

    def add(self, data: str, **kwargs) -> dict:
        """
        Store data in memory.

        Placeholders like {{GITHUB_TOKEN}} are kept as-is — they should
        NOT be resolved before memory storage. The actual resolution
        happens only at tool-execution time.
        """
        return super().add(data, **kwargs)

    def search(self, query: str, **kwargs) -> list:
        """Search memory. If resolve_on_read=True, resolve placeholders in results."""
        results = super().search(query, **kwargs)
        if self._resolve_on_read:
            results = self._resolve_results(results)
        return results

    def _resolve_results(self, results: list) -> list:
        """Resolve {{PLACEHOLDER}} in memory results (only if resolve_on_read=True)."""
        resolved = []
        for item in results:
            memory_text = item.get("memory", "")
            placeholders = set(PLACEHOLDER_RE.findall(memory_text))
            if placeholders:
                batch = self._vault.resolve_batch(list(placeholders))
                for p, val in batch.items():
                    if isinstance(val, str):
                        memory_text = memory_text.replace(f"{{{{{p}}}}}", val)
            resolved.append({**item, "memory": memory_text})
        return resolved


def get_enigmagent_mem0_config() -> dict:
    """
    Return a Mem0 config dict that can be passed to Memory(config=...).
    Provides sensible defaults for use with EnigmAgent.

    Example::

        from mem0 import Memory
        from enigmagent.tools.mem0 import get_enigmagent_mem0_config

        mem = Memory(config=get_enigmagent_mem0_config())
    """
    return {
        "version": "v1.1",
        "embedder": {
            "provider": "openai",
            "config": {"model": "text-embedding-3-small"},
        },
        "vector_store": {
            "provider": "qdrant",
            "config": {"collection_name": "enigmagent_memories", "host": "localhost", "port": 6333},
        },
    }
