"""EnigmAgent authenticated broker client and optional native integrations."""
from .client import VaultClient, VaultError, VaultStatus, VaultEntry, OperationResult, configure, get_client
__version__ = "3.0.0"
__author__ = "Francisco Angulo de Lafuente"
__license__ = "MIT"
__all__ = ["VaultClient", "VaultError", "VaultStatus", "VaultEntry", "OperationResult", "configure", "get_client"]
