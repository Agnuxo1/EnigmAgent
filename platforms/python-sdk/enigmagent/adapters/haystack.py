"""Serializable Haystack component; no runtime credentials are serialized."""
from haystack import component, default_to_dict, default_from_dict

@component
class EnigmAgentOperation:
    """Execute a named operation using runtime-only broker connection settings."""
    @component.output_types(result=str)
    def run(self, operation: str) -> dict:
        """Emit status-only JSON into pipeline outputs and traces."""
        from .common import execute_operation
        return {"result": execute_operation(operation)}

    def to_dict(self) -> dict:
        """Serialize the component identity, not environment-variable values."""
        return default_to_dict(self)

    @classmethod
    def from_dict(cls, data: dict):
        """Restore an unconfigured component; credentials are supplied at invocation."""
        return default_from_dict(cls, data)

def build() -> EnigmAgentOperation:
    """Return a native Haystack component that can be added to a Pipeline."""
    return EnigmAgentOperation()
