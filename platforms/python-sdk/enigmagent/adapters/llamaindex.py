"""LlamaIndex FunctionTool returning a status string, not a credential."""
from llama_index.core.tools import FunctionTool
from .common import execute_operation, execute_operation_async

def build() -> FunctionTool:
    """Use native sync/async function tooling without a raw resolver."""
    return FunctionTool.from_defaults(
        fn=execute_operation, async_fn=execute_operation_async,
        name="enigmagent_execute", description=execute_operation.__doc__,
    )
