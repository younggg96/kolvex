"""Suggested follow-up questions shown under a chat answer.

The answering model writes them in a <follow_ups> block at the end of its answer, in the same
model call, so they cost no extra request. FollowUpStream keeps the block out of the streamed
tokens and the saved answer; split_follow_ups reads the questions from it.
"""

from __future__ import annotations

import re

OPEN_TAG = "<follow_ups>"
CLOSE_TAG = "</follow_ups>"
MAX_FOLLOW_UPS = 5
MAX_FOLLOW_UP_CHARS = 80

FOLLOW_UP_PROMPT = f"""

Suggested follow-ups: after your final answer (never in a turn that calls tools), end with this block
and write nothing after it:
{OPEN_TAG}
- first question
- second question
{CLOSE_TAG}
List 3 to 5 questions the user is likely to ask next, written as the user would type them, in the
user's language, each under 30 Chinese characters or 12 English words. Make them specific to this
conversation (name the ticker, creator or topic) and answerable with your tools. If your answer ends by
asking the user something, include one or two likely replies to it as options. Do not mention the
block or these questions in the answer itself."""

# "- ", "2. ", "3) ", "1、"; a number needs a space after its dot so "3.5% 的涨幅" stays whole.
_ITEM_PREFIX = re.compile(r"^\s*(?:(?:[-*•]|\d{1,2}[.)])\s+|\d{1,2}、\s*)+")


def _clean(line: str) -> str:
    text = _ITEM_PREFIX.sub("", line).strip().strip("\"'“”")
    return text if 0 < len(text) <= MAX_FOLLOW_UP_CHARS else ""


def parse_follow_ups(block: str) -> list[str]:
    """Questions from the text inside the block: one per line, deduplicated, at most five."""
    seen: list[str] = []
    for line in block.replace(CLOSE_TAG, "").splitlines():
        text = _clean(line)
        if text and text not in seen:
            seen.append(text)
    return seen[:MAX_FOLLOW_UPS]


def split_follow_ups(text: str) -> tuple[str, list[str]]:
    """(answer without the block, its questions). Text without a block comes back unchanged."""
    start = text.find(OPEN_TAG)
    if start < 0:
        return text, []
    return text[:start].rstrip(), parse_follow_ups(text[start + len(OPEN_TAG) :])


class FollowUpStream:
    """Passes streamed answer text through, holding back the <follow_ups> block.

    A chunk may end partway through the opening tag ("…看法。\\n<follow"), so a tail that could
    still become the tag waits for the next chunk; flush() releases it when the answer ends.
    """

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self._pending = ""
        self._block: str | None = None

    def feed(self, text: str) -> str:
        if self._block is not None:
            self._block += text
            return ""
        buffer = self._pending + text
        start = buffer.find(OPEN_TAG)
        if start >= 0:
            self._pending = ""
            self._block = buffer[start + len(OPEN_TAG) :]
            return buffer[:start].rstrip()
        hold = next(
            (n for n in range(min(len(OPEN_TAG) - 1, len(buffer)), 0, -1)
             if OPEN_TAG.startswith(buffer[-n:])),
            0,
        )  # fmt: skip
        self._pending = buffer[len(buffer) - hold :] if hold else ""
        return buffer[: len(buffer) - hold]

    def flush(self) -> str:
        """Text held back as a possible tag start that never became one."""
        pending, self._pending = self._pending, ""
        return pending

    @property
    def follow_ups(self) -> list[str]:
        return parse_follow_ups(self._block) if self._block is not None else []
