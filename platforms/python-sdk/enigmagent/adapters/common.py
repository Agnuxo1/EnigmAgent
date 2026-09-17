"""A stateless, serializable operation function with no captured credentials."""

def execute_operation(operation: str) -> str:
    """Execute one operator-approved authenticated request and return its status.

    Args:
        operation: The exact approved operation name. URLs, headers and secret names
            cannot be selected by a caller. Response bodies are never returned.
    """
    import json
    from dataclasses import asdict
    from enigmagent.client import VaultClient, VaultError
    try:
        result = VaultClient.from_env().execute(operation)
        return json.dumps(asdict(result), separators=(",", ":"))
    except VaultError as error:
        return json.dumps({"error": error.code}, separators=(",", ":"))

async def execute_operation_async(operation: str) -> str:
    """Run the bounded blocking client without blocking a framework's event loop."""
    import asyncio
    return await asyncio.to_thread(execute_operation, operation)
