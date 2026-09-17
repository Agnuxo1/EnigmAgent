"""AutoGen Core FunctionTool with portable, credential-free function source."""
from autogen_core.tools import FunctionTool
from .common import execute_operation

def build() -> FunctionTool:
    """Create a native validated tool. Connection settings are read at runtime."""
    return FunctionTool(execute_operation, description=execute_operation.__doc__, name="enigmagent_execute", strict=True)
