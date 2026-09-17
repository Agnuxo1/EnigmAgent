"""Native framework integrations for fixed-operation execution, never raw secrets."""
from importlib import import_module

SUPPORTED_FRAMEWORKS = (
    "langchain", "langgraph", "llamaindex", "crewai", "haystack",
    "agent_framework", "smolagents", "agno", "pydantic_ai", "autogen",
)

def make_tool(framework: str):
    """Build a native tool or pipeline; credentials are read only at invocation time.

    Connection settings: ENIGMAGENT_API_TOKEN, ENIGMAGENT_PORT and optional
    ENIGMAGENT_TIMEOUT. Do not give the agent the broker process's vault password.
    LangGraph returns a compiled graph; Haystack returns a pipeline component.
    """
    if framework not in SUPPORTED_FRAMEWORKS:
        raise ValueError("Unsupported framework")
    return import_module(f"{__name__}.{framework}").build()
