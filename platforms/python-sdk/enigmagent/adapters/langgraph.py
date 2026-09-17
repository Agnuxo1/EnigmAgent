"""LangGraph workflow with status-only checkpointed state."""
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver
from .common import execute_operation

class OperationState(TypedDict, total=False):
    """No password, token, credential value or upstream response enters graph state."""
    operation: str
    result: str

def execute_node(state: OperationState) -> OperationState:
    """Return only the broker's status projection to the graph."""
    return {"result": execute_operation(state.get("operation", ""))}

def build():
    """Build an executable checkpointed graph, with secrets outside its state."""
    graph = StateGraph(OperationState)
    graph.add_node("execute_approved_operation", execute_node)
    graph.add_edge(START, "execute_approved_operation")
    graph.add_edge("execute_approved_operation", END)
    return graph.compile(checkpointer=InMemorySaver())
