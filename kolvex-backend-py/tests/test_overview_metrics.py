"""Period alignment, missing data, currency and benchmark guards for overview facts."""
import importlib.util
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("overview_metrics", Path(__file__).resolve().parents[1] / "app/services/yfinance/overview_metrics.py")
metrics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metrics)
NOW = datetime(2026, 10, 31, tzinfo=timezone.utc)


class OverviewMetricsTests(unittest.TestCase):
    def test_cagr_needs_three_years_and_positive_endpoints(self):
        rows = [{"period": "2025-12-31", "Revenue": 133.1}, {"period": "2022-12-31", "Revenue": 100}]
        self.assertAlmostEqual(metrics.cagr(rows, "Revenue"), .1, places=3)
        self.assertIsNone(metrics.cagr(rows[:1], "Revenue"))
        rows[1]["Revenue"] = -100
        self.assertIsNone(metrics.cagr(rows, "Revenue"))
        rows[1]["Revenue"] = 0
        self.assertIsNone(metrics.cagr(rows, "Revenue"))

    def test_periods_currency_and_ratios_are_not_mixed(self):
        income = {"period": "2025-12-31", "Total Revenue": 200, "Net Income": 40, "EBIT": 60, "Tax Provision": 10, "Pretax Income": 50}
        balance = {"period": "2025-12-31", "Total Assets": 300, "Current Liabilities": 100, "Total Debt": 80, "Stockholders Equity": 100, "Cash And Cash Equivalents": 20}
        previous = {**balance, "period": "2024-12-31", "Total Debt": 40}
        cash = {"period": "2025-12-31", "Operating Cash Flow": 60, "Free Cash Flow": 20, "Capital Expenditure": -40, "Repurchase Of Capital Stock": -12, "Issuance Of Capital Stock": 2}
        sources = {"info": {"currency": "USD", "financialCurrency": "USD", "marketCap": 1000, "freeCashflow": 20, "currentPrice": 100, "dividendRate": 0}, "income": [income], "annual_balance": [balance, previous], "balance": [balance], "cash": [cash]}
        data = metrics.build_metrics("TEST", sources, NOW)
        self.assertEqual(data["price_to_fcf"], 50)
        self.assertAlmostEqual(data["roce_annual"], .3)
        self.assertAlmostEqual(data["roic_annual"], 48/140)
        self.assertEqual(data["fcf_margin_annual"], .1)
        self.assertEqual(data["cash_conversion_annual"], 1.5)
        self.assertEqual(data["capital_expenditure"], 40)
        self.assertEqual(data["buyback_yield_annual"], .01)
        self.assertEqual(data["dividend_yield"], 0)
        sources["cash"][0]["Net Common Stock Issuance"] = 5
        self.assertEqual(metrics.build_metrics("TEST", sources, NOW)["buyback_yield_annual"], -.005)
        sources["info"]["financialCurrency"] = "JPY"
        sources["cash"][0]["period"] = "2024-12-31"
        sources["annual_balance"] = [previous]
        data = metrics.build_metrics("TEST", sources, NOW)
        for key in ("price_to_fcf", "buyback_yield_annual", "cash_conversion_annual", "fcf_margin_annual", "roce_annual", "roic_annual"):
            self.assertIsNone(data[key], key)

    def test_price_comparison_aligns_dates_and_drawdown_adjusts_dividends(self):
        stock = [{"date": "2025-12-31", "close": 100, "adjusted_close": 90}, {"date": "2026-01-02", "close": 80, "adjusted_close": 81}, {"date": "2026-01-05", "close": 120, "adjusted_close": 120}]
        benchmark = [{"date": "2025-12-31", "close": 100}, {"date": "2026-01-02", "close": 110}]
        data = metrics.price_metrics(stock, benchmark, 2026)
        self.assertAlmostEqual(data["max_drawdown_5y"], .1)
        self.assertAlmostEqual(data["ytd_return"], -.2)
        self.assertAlmostEqual(data["ytd_vs_sp500"], -.3)
        self.assertEqual(data["ytd_end"], "2026-01-02")
        self.assertIsNone(metrics.price_metrics(stock[1:], benchmark, 2026)["ytd_return"])
        stale = [{"date": "2025-01-01", "close": 100}, *stock[1:]]
        self.assertIsNone(metrics.price_metrics(stale, stale, 2026)["ytd_return"])

    def test_gaps_zero_and_nonfinite_values_are_strict_json(self):
        data = metrics.build_metrics("TEST", {"info": {"beta": float("inf"), "shortPercentOfFloat": 0}}, NOW)
        json.dumps(data, allow_nan=False)
        self.assertIsNone(data["beta_5y"])
        self.assertEqual(data["short_float"], 0)
        self.assertIsNone(data["price_to_fcf"])
        self.assertIsNone(metrics.ratio(20, -5))
        self.assertIsNone(metrics.ratio(20, 0))
        self.assertEqual(metrics.ratio(0, 5), 0)

    def test_partial_source_failure_survives_and_is_retryable(self):
        class EmptyFrame:
            index = []
            def iterrows(self):
                return iter([])
        class Service:
            def get_ticker(self, symbol):
                return type("Ticker", (), {"info": {"beta": 1.2}, "earnings_estimate": EmptyFrame(), "history": lambda *a, **k: EmptyFrame()})()
            def get_income_statement(self, symbol):
                raise RuntimeError("unavailable")
            def get_balance_sheet(self, *args, **kwargs):
                return []
            def get_cash_flow(self, symbol):
                return []
        metrics._CACHE.clear()
        data = metrics.get_overview_metrics(Service(), "test")
        self.assertEqual(data["beta_5y"], 1.2)
        self.assertIn("income", data["unavailable_sources"])
        self.assertNotIn("TEST", metrics._CACHE)


class OverviewRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_route_validates_symbol_and_returns_partial_facts(self):
        try:
            import httpx
            from fastapi import FastAPI, APIRouter, HTTPException, Path as ApiPath
        except ImportError:
            self.skipTest("FastAPI/httpx not installed in this Python environment")
        import ast
        import logging
        source = Path(__file__).resolve().parents[1] / 'app/api/routes/market_data.py'
        route = next(node for node in ast.parse(source.read_text()).body if isinstance(node, ast.FunctionDef) and node.name == 'get_stock_overview_metrics')
        requested = []
        def load(service, symbol):
            requested.append(symbol)
            return {'symbol': symbol.upper(), 'analyzed_at': NOW.isoformat(), 'unavailable_sources': ['income'], 'beta_5y': 0}
        scope = {'router': APIRouter(), 'Path': ApiPath, 'HTTPException': HTTPException, 'get_yfinance_service': lambda: object(), 'get_overview_metrics': load, 'logger': logging.getLogger(__name__)}
        exec(compile(ast.Module(body=[route], type_ignores=[]), str(source), 'exec'), scope)
        app = FastAPI()
        app.include_router(scope['router'])
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            response = await client.get('/overview-metrics/googl')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['symbol'], 'GOOGL')
            self.assertEqual(response.json()['beta_5y'], 0)
            self.assertEqual(response.json()['unavailable_sources'], ['income'])
            self.assertEqual((await client.get('/overview-metrics/INVALID!')).status_code, 422)
            self.assertEqual(requested, ['googl'])
            def fail(*args):
                raise RuntimeError('source failed')
            scope['get_overview_metrics'] = fail
            self.assertEqual((await client.get('/overview-metrics/GOOGL')).status_code, 503)
