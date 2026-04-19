"""
enigmagent — Python SDK for the EnigmAgent vault.

Quick start::

    from enigmagent import VaultClient, configure, get_client

    # Use the module-level singleton (reads ENIGMAGENT_HOST / ENIGMAGENT_PORT env vars)
    client = get_client()
    status = client.get_status()

    # Or point at a custom host
    configure(host="192.168.1.10", port=3737)

    # Resolve a secret
    token = client.resolve("GITHUB_TOKEN")

Framework tool helpers are in sub-modules:

    from enigmagent.tools.langchain      import get_enigmagent_tools
    from enigmagent.tools.crewai         import get_enigmagent_tools
    from enigmagent.tools.autogen        import get_enigmagent_tools
    from enigmagent.tools.llamaindex     import get_enigmagent_tools
    from enigmagent.tools.haystack       import EnigmAgentVaultStatus, EnigmAgentVaultList
    from enigmagent.tools.semantic_kernel import EnigmAgentPlugin
    from enigmagent.tools.smolagents     import get_enigmagent_tools
    from enigmagent.tools.phidata        import EnigmAgentToolkit
    from enigmagent.tools.mem0           import EnigmAgentMemory
    from enigmagent.tools.langgraph      import get_enigmagent_tools
    from enigmagent.tools.openai_agents  import get_enigmagent_tools
    from enigmagent.tools.anthropic_sdk  import get_enigmagent_tools
"""

from .client import (  # noqa: F401
    VaultClient,
    VaultEntry,
    VaultError,
    VaultStatus,
    configure,
    get_client,
)

__version__ = "1.0.0"
__all__ = [
    "VaultClient",
    "VaultEntry",
    "VaultError",
    "VaultStatus",
    "configure",
    "get_client",
    "__version__",
]
