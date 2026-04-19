"""
enigmagent.tools — AI framework tool integrations.

Each sub-module requires the corresponding framework to be installed.
All tools expose the same two capabilities:

* ``vault_status`` — check that the vault is running and unlocked
* ``vault_list``   — list secret names/domains (never values)

Available integrations
----------------------
- ``enigmagent.tools.langchain``        — LangChain BaseTool wrappers
- ``enigmagent.tools.crewai``           — CrewAI BaseTool wrappers
- ``enigmagent.tools.autogen``          — AutoGen FunctionTool / plain callables
- ``enigmagent.tools.llamaindex``       — LlamaIndex FunctionTool wrappers
- ``enigmagent.tools.haystack``         — Haystack @component classes
- ``enigmagent.tools.semantic_kernel``  — Semantic Kernel plugin class
- ``enigmagent.tools.smolagents``       — SmolAgents Tool subclasses
- ``enigmagent.tools.phidata``          — Phidata / Agno Toolkit subclass
- ``enigmagent.tools.mem0``             — Mem0 Memory subclass
- ``enigmagent.tools.langgraph``        — LangGraph tool node helpers
- ``enigmagent.tools.openai_agents``    — OpenAI Agents SDK tool helpers
- ``enigmagent.tools.anthropic_sdk``    — Anthropic SDK tool helpers

Import the sub-module you need; unused integrations are never imported
and their framework dependencies are never required.
"""
