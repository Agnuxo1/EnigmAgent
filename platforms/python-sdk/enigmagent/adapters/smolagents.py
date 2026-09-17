"""smolagents operation tool. The vault runs in a separately permissioned broker."""
from smolagents import Tool

class EnigmAgentOperation(Tool):
    """Generated code can request an operation but is never given the vault password."""
    name = "enigmagent_execute"
    description = "Execute an operator-approved authenticated request by name. Only HTTP status is returned; no credential or response body is exposed."
    inputs = {"operation": {"type": "string", "description": "Exact operator-approved operation name, not a URL or secret name."}}
    output_type = "string"

    def forward(self, operation: str) -> str:
        """Resolve only broker connection settings, never a raw vault secret."""
        from enigmagent.adapters.common import execute_operation
        return execute_operation(operation)

def build() -> EnigmAgentOperation:
    """Return a native Tool. This does not create an operating-system sandbox."""
    return EnigmAgentOperation()
