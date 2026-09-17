"""Microsoft Agent Framework native fixed-operation function tool."""
from agent_framework import tool
from .common import execute_operation

def build():
    """Keep credentials out of function arguments, results and tool configuration."""
    return tool(execute_operation, name="enigmagent_execute", description=execute_operation.__doc__)
