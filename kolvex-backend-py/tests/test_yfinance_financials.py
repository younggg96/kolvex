"""Financial source gaps must not make entire API responses unserializable."""
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd
from starlette.responses import JSONResponse

from app.services.yfinance.client import YFinanceService


class FinancialSerializationTests(unittest.TestCase):
    def setUp(self):
        self.service = YFinanceService()
        self.frame = pd.DataFrame(
            {pd.Timestamp('2025-09-30'): [123456789.125, 0, float('nan'), float('inf'), -float('inf')]},
            index=['Total Revenue', 'Net Income', 'Missing', 'Positive Infinity', 'Negative Infinity'],
        )

    def test_all_statements_and_frequencies_are_strict_json_and_keep_valid_values(self):
        ticker = SimpleNamespace(**{name: self.frame for name in (
            'income_stmt', 'quarterly_income_stmt', 'balance_sheet',
            'quarterly_balance_sheet', 'cashflow', 'quarterly_cashflow',
        )})
        with patch.object(self.service, 'get_ticker', return_value=ticker):
            for method in ('get_income_statement', 'get_balance_sheet', 'get_cash_flow'):
                for quarterly in (False, True):
                    with self.subTest(method=method, quarterly=quarterly):
                        rows = getattr(self.service, method)('AAPL', quarterly)
                        JSONResponse({'symbol': 'AAPL', 'data': rows, 'count': len(rows)})
                        self.assertEqual(rows[0]['period'], '2025-09-30T00:00:00')
                        self.assertEqual(rows[0]['Total Revenue'], 123456789.125)
                        self.assertEqual(rows[0]['Net Income'], 0)
                        for key in ('Missing', 'Positive Infinity', 'Negative Infinity'):
                            self.assertIsNone(rows[0][key])

    def test_earnings_preserves_zero_eps_and_uses_quarter_index(self):
        ticker = SimpleNamespace(
            info={'earningsQuarterlyGrowth': float('nan'), 'revenueQuarterlyGrowth': 0},
            earnings_history=pd.DataFrame(
                {'epsActual': [0.0], 'epsEstimate': [float('nan')], 'surprisePercent': [float('inf')]},
                index=[pd.Timestamp('2025-09-30')],
            ),
            earnings_dates=pd.DataFrame(
                {'EPS Estimate': [1.25], 'Reported EPS': [float('nan')], 'Surprise(%)': [float('nan')]},
                index=[pd.Timestamp('2026-01-29', tz='America/New_York')],
            ),
        )
        with patch.object(self.service, 'get_ticker', return_value=ticker):
            data = self.service.get_earnings('AAPL')
        json.dumps(data, allow_nan=False)
        row = data['earnings_history'][0]
        self.assertEqual(row['quarter'], '2025-09-30T00:00:00')
        self.assertEqual(row['eps_actual'], 0)
        self.assertIsNone(row['eps_estimate'])
        self.assertIsNone(row['surprise_percent'])
        self.assertIsNone(data['earnings_dates'][0]['reported_eps'])
        self.assertIsNone(data['earnings_quarterly_growth'])
        self.assertEqual(data['revenue_quarterly_growth'], 0)

    def test_empty_statement_stays_empty(self):
        with patch.object(self.service, 'get_ticker', return_value=SimpleNamespace(income_stmt=pd.DataFrame())):
            self.assertEqual(self.service.get_income_statement('AAPL'), [])


class FinancialRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_route_handlers_serialize_source_gaps_without_500(self):
        import ast
        from pathlib import Path
        from typing import Any, List, Optional

        import httpx
        from fastapi import APIRouter, FastAPI, HTTPException, Path as ApiPath, Query
        from pydantic import BaseModel

        # Load the real routes and response models without unrelated auth/database startup.
        route_file = Path(__file__).resolve().parents[1] / 'app/api/routes/market_data.py'
        wanted = {
            'get_income_statement', 'get_balance_sheet', 'get_cash_flow', 'get_earnings',
            'EarningsHistory', 'EarningsDate', 'EarningsResponse',
        }
        nodes = [node for node in ast.parse(route_file.read_text()).body
                 if isinstance(node, (ast.ClassDef, ast.AsyncFunctionDef)) and node.name in wanted]
        frame = pd.DataFrame(
            {pd.Timestamp('2025-09-30'): [123.5, float('nan')]},
            index=['Total Revenue', 'Missing'],
        )
        ticker = SimpleNamespace(
            **{name: frame for name in ('income_stmt', 'quarterly_income_stmt', 'balance_sheet',
                                       'quarterly_balance_sheet', 'cashflow', 'quarterly_cashflow')},
            info={},
            earnings_history=pd.DataFrame({'epsActual': [0.0], 'epsEstimate': [float('nan')]},
                                          index=[pd.Timestamp('2025-09-30')]),
            earnings_dates=pd.DataFrame({'EPS Estimate': [1.25], 'Reported EPS': [float('nan')]},
                                        index=[pd.Timestamp('2026-01-29')]),
        )
        service = YFinanceService()
        router = APIRouter()
        scope = dict(router=router, Query=Query, Path=ApiPath, HTTPException=HTTPException,
                     Optional=Optional, List=List, Any=Any, BaseModel=BaseModel,
                     get_yfinance_service=lambda: service)
        exec(compile(ast.Module(body=nodes, type_ignores=[]), str(route_file), 'exec'), scope)
        app = FastAPI()
        app.include_router(router)
        with patch.object(service, 'get_ticker', return_value=ticker):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                for kind in ('income-statement', 'balance-sheet', 'cash-flow'):
                    for quarterly in ('false', 'true'):
                        with self.subTest(kind=kind, quarterly=quarterly):
                            response = await client.get(f'/{kind}/AAPL?quarterly={quarterly}')
                            self.assertEqual(response.status_code, 200)
                            body = response.json()
                            self.assertEqual(body['count'], 1)
                            self.assertEqual(body['data'][0]['Total Revenue'], 123.5)
                            self.assertIsNone(body['data'][0]['Missing'])
                response = await client.get('/earnings/AAPL')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['earnings_history'][0]['eps_actual'], 0)
                self.assertIsNone(response.json()['earnings_dates'][0]['reported_eps'])
