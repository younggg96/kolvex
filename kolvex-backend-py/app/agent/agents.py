"""Names of the chat sub-agents, importable without loading LangGraph.

The supervisor's AGENT_PROMPTS uses exactly these keys (tests/test_chat_agent_workspace.py checks).
A chat request may pin one of them; a workspace chat may be bound to one.
"""

from typing import Literal

CHAT_AGENTS = (
    "financial",
    "research",
    "portfolio",
    "creators",
    "earnings",
    "macro",
    "smart_money",
    "valuation",
    "buzz",
    "paper_review",
)

ChatAgent = Literal[
    "financial",
    "research",
    "portfolio",
    "creators",
    "earnings",
    "macro",
    "smart_money",
    "valuation",
    "buzz",
    "paper_review",
]
