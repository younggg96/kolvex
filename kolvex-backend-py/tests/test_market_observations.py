import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.routes.market_observations import observations, router, _cache
class ObservationsTests(unittest.TestCase):
    def test_missing_finite_zero_and_negative(self):
        self.assertEqual(observations("DATE,DGS2\n2026-01-01,.\n2026-01-02,0\n2026-01-03,-1\n2026-01-04,NaN\n2026-02-30,9\n", "DGS2"), [{"date":"2026-01-02","value":0.0},{"date":"2026-01-03","value":-1.0}])
    def test_dedup_and_sort(self):
        self.assertEqual(observations("observation_date,DGS10\n2026-01-02,3\n2026-01-01,2\n2026-01-02,4\n", "DGS10"),[{"date":"2026-01-01","value":2.0},{"date":"2026-01-02","value":4.0}])
    def test_bad_header_or_empty_rejected(self):
        for text in ("DATE,other\n2026-01-01,2", "DATE,DGS2\n2026-01-01,."):
            with self.assertRaises(ValueError):observations(text,"DGS2")
    def test_fixed_allowlist_before_network(self):
        app=FastAPI();app.include_router(router)
        with patch("app.api.routes.market_observations.httpx.AsyncClient") as client:
            self.assertEqual(TestClient(app).get("/market/observations/UNKNOWN").status_code,422)
            client.assert_not_called()
