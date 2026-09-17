"""CrewAI native tool for a pre-approved credentialed operation."""
from crewai.tools import tool
from .common import execute_operation

def build():
    """Tool results contain only operation, HTTP status and success, or a fixed error."""
    return tool("enigmagent_execute")(execute_operation)
