"""LangChain StructuredTool with synchronous and asynchronous execution."""
from langchain_core.tools import StructuredTool
from .common import execute_operation, execute_operation_async

def build() -> StructuredTool:
    """Expose only a fixed operation identifier as model-selected input."""
    return StructuredTool.from_function(
        func=execute_operation, coroutine=execute_operation_async,
        name="enigmagent_execute", description=execute_operation.__doc__,
    )
