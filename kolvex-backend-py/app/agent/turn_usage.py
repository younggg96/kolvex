"""Tokens used by one chat turn, across every model call it makes.

A chat route calls start_turn() before running the agent; every model built by
app/agent/llm.py while that turn is current gets a TurnUsageCallback, so the
router, the answering agent and model calls inside its tools are all counted.
The total is saved with the answer (chat_messages.token_usage) and shown under it.
"""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from typing import Optional

from langchain_core.callbacks import AsyncCallbackHandler


@dataclass
class TurnUsage:
    input_tokens: int = 0
    cached_input_tokens: int = 0
    output_tokens: int = 0
    model_calls: int = 0
    # A call reported no usage, so the counts are lower than what was used.
    incomplete: bool = False

    def as_dict(self) -> Optional[dict]:
        if not self.model_calls:
            return None
        return {
            "input_tokens": self.input_tokens,
            "cached_input_tokens": self.cached_input_tokens,
            "output_tokens": self.output_tokens,
            "model_calls": self.model_calls,
            "incomplete": self.incomplete,
        }


_current: ContextVar[Optional[TurnUsage]] = ContextVar("chat_turn_usage", default=None)


def start_turn() -> TurnUsage:
    """Count model calls from here on (and in tasks started from here) into a new total."""
    usage = TurnUsage()
    _current.set(usage)
    return usage


def current_turn() -> Optional[TurnUsage]:
    return _current.get()


class TurnUsageCallback(AsyncCallbackHandler):
    def __init__(self, usage: TurnUsage):
        self.usage = usage

    async def on_llm_end(self, response, **kwargs) -> None:
        from app.services.free_llm_quota import usage_of

        self.usage.model_calls += 1
        counts = usage_of(response)
        if counts is None:
            self.usage.incomplete = True
            return
        hit, miss, output = counts
        self.usage.input_tokens += hit + miss
        self.usage.cached_input_tokens += hit
        self.usage.output_tokens += output
