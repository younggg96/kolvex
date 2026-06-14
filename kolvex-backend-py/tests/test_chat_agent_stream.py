import unittest
from unittest.mock import AsyncMock, patch

from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage

from app.agent.graphs.supervisor import stream_agent


class _FakeAgent:
    async def astream_events(self, *_args, **_kwargs):
        yield {
            "event": "on_chat_model_stream",
            "run_id": "planning-run",
            "data": {"chunk": AIMessageChunk(content="Let me inspect the portfolio.")},
        }
        yield {
            "event": "on_chat_model_end",
            "run_id": "planning-run",
            "data": {
                "output": AIMessage(
                    content="Let me inspect the portfolio.",
                    tool_calls=[
                        {
                            "name": "get_user_portfolio",
                            "args": {},
                            "id": "tool-1",
                            "type": "tool_call",
                        }
                    ],
                )
            },
        }
        yield {
            "event": "on_tool_start",
            "name": "get_user_portfolio",
            "data": {"input": {}},
        }
        yield {
            "event": "on_tool_end",
            "name": "get_user_portfolio",
            "data": {"output": {"positions": []}},
        }
        yield {
            "event": "on_chat_model_stream",
            "run_id": "final-run",
            "data": {"chunk": AIMessageChunk(content="# Portfolio review\n")},
        }
        yield {
            "event": "on_chat_model_stream",
            "run_id": "final-run",
            "data": {"chunk": AIMessageChunk(content="Your portfolio is diversified.")},
        }
        yield {
            "event": "on_chat_model_end",
            "run_id": "final-run",
            "data": {
                "output": AIMessage(
                    content="# Portfolio review\nYour portfolio is diversified."
                )
            },
        }


class ChatAgentStreamTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_final_model_turn_is_emitted_as_answer(self):
        with (
            patch(
                "app.agent.graphs.supervisor._classify_intent",
                new=AsyncMock(return_value="financial"),
            ),
            patch(
                "app.agent.graphs.supervisor._create_agent_for_request",
                return_value=_FakeAgent(),
            ),
        ):
            events = [
                event
                async for event in stream_agent(
                    messages=[HumanMessage(content="Review my portfolio")],
                    user_id="user-1",
                    conversation_id="conversation-1",
                    model_id="deepseek-chat",
                    sources=["portfolio"],
                )
            ]

        answer = "".join(
            event.get("content", "")
            for event in events
            if event.get("type") == "token"
        )

        self.assertEqual(
            answer,
            "# Portfolio review\nYour portfolio is diversified.",
        )
        self.assertNotIn("Let me inspect", answer)
        self.assertEqual(events[-1]["type"], "done")
        self.assertIn(
            {"type": "tool_start", "tool": "get_user_portfolio", "input": {}},
            events,
        )
        self.assertIn(
            {"type": "tool_end", "tool": "get_user_portfolio"},
            events,
        )


if __name__ == "__main__":
    unittest.main()
