"""web_search: recency and news mode reach Tavily, and results carry their dates (no network)."""

import json
import unittest
from unittest.mock import MagicMock, patch

from app.agent.tools import web_tools


def search(**args):
    client = MagicMock()
    client.search.return_value = {
        "answer": "",
        "results": [
            {
                "title": "New",
                "url": "https://a",
                "content": "x",
                "score": 0.9,
                "published_date": "2026-11-19",
            },
            {"title": "Page", "url": "https://b", "content": "y", "score": 0.5},
        ],
    }
    with (
        patch.object(web_tools, "TAVILY_API_KEY", "test-key"),
        patch("tavily.TavilyClient", return_value=client),
    ):
        out = json.loads(web_tools.web_search.invoke(args))
    return out, client.search.call_args.kwargs


class WebSearchTests(unittest.TestCase):
    def test_news_and_recent_reach_tavily_and_dates_come_back(self):
        out, sent = search(query="Zscaler acquisition", news=True, recent="day")
        self.assertEqual((sent["topic"], sent["time_range"]), ("news", "day"))
        self.assertEqual(out["results"][0]["published_date"], "2026-11-19")
        self.assertNotIn("published_date", out["results"][1])
        self.assertEqual((out["news"], out["recent"]), (True, "day"))

    def test_default_is_a_general_search_without_a_time_range(self):
        out, sent = search(query="CrowdStrike business model")
        self.assertEqual(sent["topic"], "general")
        self.assertNotIn("time_range", sent)
        self.assertIsNone(out["recent"])

    def test_tool_description_points_the_model_at_recency_and_peers(self):
        description = web_tools.web_search.description
        self.assertIn('recent="day"', description)
        self.assertIn("peers", description)


class MoveReasonPromptTests(unittest.TestCase):
    def test_every_chat_agent_and_team_researcher_gets_the_rules(self):
        from app.agent.graphs.supervisor import AGENT_PROMPTS
        from app.services import research_workspace as ws

        prompts = list(AGENT_PROMPTS.values()) + [ws.agent_prompt(a) for a in ws.AGENT_KEYS]
        for prompt in prompts:
            self.assertIn(
                "is a lead to\n   investigate, not evidence that the quote is wrong", prompt
            )
            self.assertIn("Do not fill the gap with a guess", prompt)


if __name__ == "__main__":
    unittest.main()
