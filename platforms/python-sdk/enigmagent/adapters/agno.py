"""Agno Function integration using a stateless operation-only callable."""
from agno.tools import tool
from .common import execute_operation

def build():
    """Construct a native function without credential-bearing model parameters."""
    return tool(name="enigmagent_execute", description=execute_operation.__doc__)(execute_operation)
