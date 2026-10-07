import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from app.services.youtube_stock_opinions import YouTubeStockOpinionService


def opinion(index):
    return {"id": str(index), "ticker": f"STK{index % 12}", "channel_id": f"creator{index % 11}",
            "channel_title": f"Creator {index % 11}", "video_id": str(index),
            "video_published_at": "2026-10-05T00:00:00Z", "opinion_date": "2026-10-05",
            "sentiment": "bullish", "direction_score": 60, "created_at": "2026-10-05T00:00:00Z"}


class ExplorerTests(unittest.TestCase):
    def test_directory_is_not_truncated_by_opinion_pagination(self):
        service = YouTubeStockOpinionService(Mock())
        service._fetch_rows = Mock(return_value=[opinion(i) for i in range(85)])
        result = asyncio.run(service.get_dashboard(limit=40, offset=40))
        self.assertEqual(len(result["stocks"]), 12)
        self.assertEqual(len(result["creators"]), 11)
        self.assertEqual(result["latest"][0]["id"], "40")
        self.assertEqual(result["latest"][-1]["id"], "79")
        self.assertTrue(result["pagination"]["has_more"])
        last = asyncio.run(service.get_dashboard(limit=40, offset=80))
        self.assertEqual(len(last["latest"]), 5)
        self.assertFalse(last["pagination"]["has_more"])
        self.assertEqual(last["pagination"]["total"], 85)

    def test_stock_creator_and_date_filters_are_combined(self):
        service = YouTubeStockOpinionService(Mock())
        service._fetch_rows = Mock(return_value=[])
        result = asyncio.run(service.get_dashboard(ticker="NVDA", channel_id="creator1", date_from="2026-10-01", date_to="2026-10-07", sentiment="bearish"))
        service._fetch_rows.assert_called_once_with(ticker="NVDA", channel_id="creator1", date_from="2026-10-01", date_to="2026-10-07", sentiment="bearish")
        self.assertEqual(result["stocks"], [])
        self.assertFalse(result["pagination"]["has_more"])

    def test_fetch_reads_all_pages_even_with_lower_server_row_cap(self):
        query = Mock()
        for method in ("select", "order", "eq", "gte", "lte", "range"):
            getattr(query, method).return_value = query
        query.execute.side_effect = [SimpleNamespace(data=[opinion(0), opinion(1)], count=5),
                                     SimpleNamespace(data=[opinion(2), opinion(3)], count=5),
                                     SimpleNamespace(data=[opinion(4)], count=5)]
        client = Mock()
        client.table.return_value = query
        rows = YouTubeStockOpinionService(client)._fetch_rows(ticker="nvda", channel_id="creator1")
        self.assertEqual(len(rows), 5)
        self.assertEqual(client.table.call_count, 3)
        self.assertEqual([call.args for call in query.range.call_args_list], [(0, 999), (2, 1001), (4, 1003)])
        query.eq.assert_any_call("ticker", "NVDA")
        query.eq.assert_any_call("channel_id", "creator1")
        query.order.assert_any_call("id")

    def test_empty_database_stops_paging(self):
        query = Mock()
        for method in ("select", "order", "range"):
            getattr(query, method).return_value = query
        query.execute.return_value = SimpleNamespace(data=[], count=0)
        client = Mock()
        client.table.return_value = query
        self.assertEqual(YouTubeStockOpinionService(client)._fetch_rows(), [])
        query.execute.assert_called_once()


if __name__ == "__main__":
    unittest.main()
