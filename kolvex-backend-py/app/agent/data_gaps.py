"""Tell apart, for the user, why a turn has no figure from a tool.

- "unavailable": the tool or its source failed (SEC down, Yahoo error, search not configured).
  Trying again may help.
- "no_data": the source answered, and it has nothing for this request (no directly reported
  quarter, no options chain). Trying again will not help.
A skill the user switched off never runs a tool at all; the client knows which skills are off,
so that case needs no record here.
"""

import json
import re
from typing import Any, Optional

from langchain_core.messages import ToolMessage

_NO_DATA = re.compile(r"^\s*(no |not found|none available)", re.IGNORECASE)


def data_gap(output: object) -> Optional[dict[str, Any]]:
    """{"tool", "kind"} for a tool result that carried no data, else None."""
    if not isinstance(output, ToolMessage):
        return None
    tool = output.name or ""
    if output.status == "error":
        return {"tool": tool, "kind": "unavailable"}
    try:
        data = json.loads(output.content) if isinstance(output.content, str) else None
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    if data.get("gap") in ("unavailable", "no_data"):
        return {"tool": tool, "kind": data["gap"]}
    message = data.get("error") or (data.get("message") if data.get("status") == "error" else None)
    if not isinstance(message, str):
        return None
    return {"tool": tool, "kind": "no_data" if _NO_DATA.match(message) else "unavailable"}


def merge_gaps(gaps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One entry per tool; a later success is not known here, so the worst kind wins."""
    merged: dict[str, dict[str, Any]] = {}
    for gap in gaps:
        if gap["tool"] not in merged or gap["kind"] == "unavailable":
            merged[gap["tool"]] = gap
    return list(merged.values())
