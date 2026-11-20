"""Shared test setup."""

from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _empty_tool_cache():
    """Each test sees its own stubbed data, never a tool result cached by an earlier test."""
    from app.agent import tool_cache

    tool_cache.clear()
    yield
    tool_cache.clear()


@pytest.fixture(autouse=True)
def _no_real_chat_memory_db():
    """Chat routes load and save chat memory in the background; never reach a real database.

    Tests of app/agent/chat_memory.py patch `_db` with a fake inside this one.
    """

    def unavailable():
        raise RuntimeError("no database in tests")

    with patch("app.agent.chat_memory._db", unavailable):
        yield
