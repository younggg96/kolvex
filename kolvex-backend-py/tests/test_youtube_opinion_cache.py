"""The opinion read cache keeps Supabase egress down without serving stale data."""

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.services import youtube_stock_opinions as module
from app.services.youtube_stock_opinions import YouTubeStockOpinionService


def opinion(index, updated="2026-11-01T00:00:00+00:00"):
    return {
        "id": str(index),
        "video_id": f"v{index}",
        "ticker": "NVDA",
        "channel_id": "c1",
        "video_published_at": "2026-11-01T00:00:00Z",
        "created_at": "2026-11-01T00:00:00Z",
        "updated_at": updated,
    }


class OpinionCacheTest(unittest.TestCase):
    def setUp(self):
        module._row_cache.reset()
        self.client = Mock()
        self.service = YouTubeStockOpinionService(self.client)
        self.service._query_rows = Mock(return_value=[opinion(0), opinion(1)])
        self.service._table_version = Mock(return_value=(2, "2026-11-01T00:00:00+00:00"))
        self.clock = patch.object(module.time, "monotonic", return_value=1000.0)
        self.now = self.clock.start()
        self.addCleanup(self.clock.stop)

    def test_repeat_reads_within_window_hit_the_cache(self):
        self.service._fetch_rows()
        self.service._fetch_rows()
        self.service._tracked_video_index()
        self.service._query_rows.assert_called_once()
        self.service._table_version.assert_not_called()

    def test_unchanged_table_only_costs_a_version_probe(self):
        self.service._fetch_rows()
        self.now.return_value += module.REVALIDATE_SECONDS + 1
        rows = self.service._fetch_rows()
        self.assertEqual(len(rows), 2)
        self.service._query_rows.assert_called_once()
        self.service._table_version.assert_called_once()

    def test_changed_table_is_read_again(self):
        self.service._fetch_rows(ticker="nvda")
        self.service._fetch_rows()
        self.now.return_value += module.REVALIDATE_SECONDS + 1
        self.service._table_version.return_value = (3, "2026-11-02T00:00:00+00:00")
        self.service._fetch_rows()
        self.service._fetch_rows(ticker="NVDA")
        self.assertEqual(self.service._query_rows.call_count, 4)

    def test_failed_probe_does_not_serve_cached_rows(self):
        self.service._fetch_rows()
        self.now.return_value += module.REVALIDATE_SECONDS + 1
        self.service._table_version.return_value = None
        self.service._fetch_rows()
        self.assertEqual(self.service._query_rows.call_count, 2)

    def test_writes_invalidate_and_callers_cannot_mutate_the_cache(self):
        rows = self.service._fetch_rows()
        rows[0]["channel_avatar_url"] = "https://example.com/a.png"
        self.assertNotIn("channel_avatar_url", self.service._fetch_rows()[0])
        self.client.table.return_value.delete.return_value.eq.return_value.execute.return_value = (
            SimpleNamespace(data=[{"id": "0"}])
        )
        self.service._opinion_by_id = Mock(return_value=opinion(0))
        self.service.delete_opinion("0")
        self.service._fetch_rows()
        self.assertEqual(self.service._query_rows.call_count, 2)

    def test_filters_are_cached_separately(self):
        self.service._fetch_rows(ticker="nvda")
        self.service._fetch_rows(ticker="NVDA")
        self.service._fetch_rows(channel_id="c1")
        self.assertEqual(self.service._query_rows.call_count, 2)

    def test_version_probe_reads_one_row_with_exact_count(self):
        module._row_cache.reset()
        query = Mock()
        for method in ("select", "order", "limit"):
            getattr(query, method).return_value = query
        query.execute.return_value = SimpleNamespace(
            data=[{"updated_at": "2026-11-01T00:00:00+00:00"}], count=7
        )
        client = Mock()
        client.table.return_value = query
        version = YouTubeStockOpinionService(client)._table_version()
        self.assertEqual(version, (7, "2026-11-01T00:00:00+00:00"))
        query.select.assert_called_once_with("updated_at", count="exact")
        query.limit.assert_called_once_with(1)

    def test_full_read_version_matches_probe_format(self):
        self.assertEqual(
            module._version_of([opinion(0), opinion(1, "2026-11-03T00:00:00+00:00")]),
            (2, "2026-11-03T00:00:00+00:00"),
        )


if __name__ == "__main__":
    unittest.main()
