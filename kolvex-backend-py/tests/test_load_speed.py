"""Load-speed caches: token verification, shared Yahoo data and gzip responses."""

import asyncio
import base64
import json
import time
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, PropertyMock, patch

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.testclient import TestClient

from app.api.dependencies import auth
from app.services.yfinance import client as yclient


def token(exp, sub="u1"):
    part = (
        base64.urlsafe_b64encode(json.dumps({"exp": exp, "sub": sub}).encode()).decode().rstrip("=")
    )
    return f"h.{part}.s"


class TokenCacheTest(unittest.TestCase):
    def setUp(self):
        auth.clear_token_cache()
        self.supabase = Mock()
        self.supabase.auth.get_user.return_value = SimpleNamespace(
            user=SimpleNamespace(id="u1", email="a@b.c")
        )

    def user_id(self, value):
        return asyncio.run(auth.get_current_user_id(f"Bearer {value}", self.supabase))

    def test_repeat_requests_verify_once(self):
        value = token(time.time() + 3600)
        self.assertEqual(self.user_id(value), "u1")
        self.assertEqual(self.user_id(value), "u1")
        self.assertEqual(
            asyncio.run(auth.get_current_user_email(f"Bearer {value}", self.supabase)), "a@b.c"
        )
        self.supabase.auth.get_user.assert_called_once_with(value)

    def test_cache_never_outlives_the_token_or_the_window(self):
        expired = token(time.time() - 1)
        self.user_id(expired)
        self.user_id(expired)
        self.assertEqual(self.supabase.auth.get_user.call_count, 2)
        value = token(time.time() + 3600)
        self.user_id(value)
        with patch.object(
            auth.time, "monotonic", return_value=time.monotonic() + auth.TOKEN_CACHE_SECONDS + 1
        ):
            self.user_id(value)
        self.assertEqual(self.supabase.auth.get_user.call_count, 4)

    def test_rejected_tokens_are_not_cached(self):
        self.supabase.auth.get_user.return_value = SimpleNamespace(user=None)
        value = token(time.time() + 3600)
        for _ in range(2):
            with self.assertRaises(Exception):
                self.user_id(value)
        self.assertEqual(self.supabase.auth.get_user.call_count, 2)

    def test_verifier_client_is_shared(self):
        with (
            patch.object(auth.SupabaseClient, "get_client", side_effect=[Mock(), Mock()]),
            patch.object(auth, "_verifier", None),
        ):
            self.assertIs(auth.get_supabase(), auth.get_supabase())


class MarketCacheTest(unittest.TestCase):
    def setUp(self):
        yclient.clear_market_cache()
        self.service = yclient.YFinanceService()
        self.ticker = Mock()
        self.info = PropertyMock(
            return_value={
                "regularMarketPrice": 10,
                "regularMarketPreviousClose": 9,
                "trailingPE": 20,
                "shortName": "Acme",
                "recommendationKey": "buy",
            }
        )
        type(self.ticker).info = self.info
        self.service.get_ticker = Mock(return_value=self.ticker)

    def test_info_is_downloaded_once_across_endpoints(self):
        self.service.get_quote("acme")
        self.service.get_financials("ACME")
        self.service.get_company_info("ACME")
        self.assertEqual(self.service.get_info("ACME")["trailingPE"], 20)
        self.assertEqual(self.info.call_count, 1)

    def test_results_expire_and_failures_are_not_cached(self):
        self.service.get_info("ACME")
        with patch.object(
            yclient.time, "monotonic", return_value=time.monotonic() + yclient.INFO_TTL + 1
        ):
            self.service.get_info("ACME")
        self.assertEqual(self.info.call_count, 2)
        self.service.get_ticker.side_effect = RuntimeError("yahoo down")
        for _ in range(2):
            with self.assertRaises(RuntimeError):
                self.service.get_company_info("OTHER")
        self.assertEqual(
            self.service.get_ticker.call_count, 4
        )  # 2 info reads + 2 uncached failures

    def test_callers_cannot_mutate_cached_values(self):
        self.service.get_info("ACME")["trailingPE"] = 0
        self.assertEqual(self.service.get_info("ACME")["trailingPE"], 20)

    def test_statement_variants_are_cached_separately(self):
        with patch.object(yclient, "_statement_rows", side_effect=lambda df: [{"df": id(df)}]):
            annual = self.service.get_balance_sheet("ACME")
            quarterly = self.service.get_balance_sheet("ACME", quarterly=True)
            self.service.get_balance_sheet("ACME", quarterly=True)
        self.assertNotEqual(annual, quarterly)
        self.assertEqual(self.service.get_ticker.call_count, 2)


class CompressionTest(unittest.TestCase):
    def setUp(self):
        from main import CompressResponses

        app = FastAPI()

        @app.get("/big")
        def big():
            return {"rows": ["x" * 50] * 200}

        @app.get("/x/stream")
        def stream():
            return StreamingResponse(
                iter([b"data: " + b"y" * 2000 + b"\n\n"]), media_type="text/event-stream"
            )

        app.add_middleware(CompressResponses)
        self.client = TestClient(app)

    def test_json_is_gzipped(self):
        response = self.client.get("/big", headers={"Accept-Encoding": "gzip"})
        self.assertEqual(response.headers.get("content-encoding"), "gzip")
        self.assertEqual(len(response.json()["rows"]), 200)

    def test_streams_are_never_gzipped(self):
        response = self.client.get("/x/stream", headers={"Accept-Encoding": "gzip"})
        self.assertIsNone(response.headers.get("content-encoding"))


if __name__ == "__main__":
    unittest.main()
