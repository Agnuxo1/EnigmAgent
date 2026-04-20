"""
enigmagent — Python SDK for the EnigmAgent local secret vault
=============================================================

Quick start:
    from enigmagent import Vault
    vault = Vault()
    key = vault.get("OPENAI_KEY")
    prompt = vault.resolve("The key is {{OPENAI_KEY}}")

Module-level shortcuts:
    import enigmagent
    enigmagent.configure("http://127.0.0.1:39517")
    key = enigmagent.get("OPENAI_KEY")
    prompt = enigmagent.resolve("The key is {{OPENAI_KEY}}")
"""

from .vault import Vault, get, resolve, configure

__all__ = ["Vault", "get", "resolve", "configure"]
__version__ = "0.2.0"
