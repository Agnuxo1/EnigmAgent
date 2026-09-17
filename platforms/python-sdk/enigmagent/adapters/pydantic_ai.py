"""PydanticAI Tool with typed operation input and status-only output."""
from pydantic_ai import Tool
from .common import execute_operation

def build() -> Tool:
    """Use the native tool schema; no dependency context contains vault credentials."""
    return Tool(execute_operation, takes_ctx=False, name="enigmagent_execute", description=execute_operation.__doc__)
