import asyncio

import pytest

from app.agent.memory import _insert_without_missing_columns


class _Table:
    def __init__(self, columns):
        self.columns = columns
        self.inserted = []

    def insert(self, row):
        self.row = dict(row)
        return self

    def execute(self):
        for name in self.row:
            if name not in self.columns:
                raise Exception(f"Could not find the '{name}' column of 'chat_messages'")
        self.inserted.append(self.row)
        return self.row


class _Client:
    def __init__(self, columns):
        self.t = _Table(columns)

    def table(self, _name):
        return self.t


def test_drops_each_missing_optional_column_in_turn():
    client = _Client({"content"})
    row = {"content": "a", "token_usage": {}, "web_sources": []}
    saved = asyncio.run(_insert_without_missing_columns(client, row))
    assert saved == {"content": "a"}


def test_other_errors_still_raise():
    client = _Client({"token_usage"})
    with pytest.raises(Exception):
        asyncio.run(_insert_without_missing_columns(client, {"content": "a"}))
