import asyncio
import json
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id
from app.api.routes.portfolio import router as portfolio_router
from app.services.portfolio import get_portfolio_service
from app.services.portfolio_ai_analysis import (
    AiKeyRejected,
    NoPositions,
    PortfolioAiResult,
    PortfolioAnalysisInvalid,
    PortfolioAnalysisRuns,
    build_messages,
    get_portfolio_analysis_runs,
    run_portfolio_analysis,
)
from app.services.technical_analysis import AiNotConfigured
from app.services.user_api_keys_service import get_user_api_keys_service

HOLDINGS = {
    "accounts": [
        {
            "account_name": "Schwab",
            "brokerage_name": "Charles Schwab",
            "portfolio_positions": [
                {
                    "symbol": "NVDA",
                    "security_name": "NVIDIA",
                    "price": 150,
                    "units": 10,
                    "open_pnl": 500,
                    "average_purchase_price": 100,
                },
                {
                    "symbol": "AAPL",
                    "security_name": "Apple",
                    "price": 200,
                    "units": 5,
                    "open_pnl": 0,
                    "average_purchase_price": 200,
                },
                {"symbol": "HIDE", "price": 1, "units": 1, "is_hidden": True},
            ],
        }
    ]
}
ANSWER = {
    "overall_analysis": {
        "summary": "集中于半导体。",
        "risk_level": "high",
        "diversification_score": 30,
        "strengths": ["s"],
        "weaknesses": ["w"],
    },
    "stock_analyses": [
        {"symbol": "NVDA", "sentiment": "bullish", "recommendation": "hold", "confidence": 0.7}
    ],
    "portfolio_suggestions": {"rebalancing": ["r"]},
}
KEYS = {"deepseek": "secret-key"}


class FakeLlm:
    def __init__(self, *answers):
        self.answers, self.prompts = list(answers), []

    def with_structured_output(self, schema, method=None):
        return self

    async def ainvoke(self, prompt):
        self.prompts.append(prompt)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


def run(**kwargs):
    args = dict(
        model_id="deepseek-flash",
        user_api_keys=KEYS,
        locale="zh",
        llm=FakeLlm(PortfolioAiResult.model_validate(ANSWER)),
    )
    args.update(kwargs)
    return asyncio.run(run_portfolio_analysis(HOLDINGS, **args))


class RunAnalysisTests(unittest.TestCase):
    def test_result_carries_selected_model_and_visible_position_count(self):
        data = run()
        self.assertEqual(data["model"], "deepseek-flash")
        self.assertEqual(data["positions_analyzed"], 2)
        self.assertEqual(data["overall_analysis"]["risk_level"], "high")
        self.assertEqual(data["stock_analyses"][0]["symbol"], "NVDA")

    def test_requires_model_selection_and_the_users_own_key(self):
        with self.assertRaises(AiNotConfigured):
            run(model_id=None)
        with self.assertRaises(AiNotConfigured):
            run(model_id="not-a-model")
        with self.assertRaises(AiNotConfigured):
            run(user_api_keys={"openai": "k"})

    def test_auth_failure_is_key_rejected(self):
        with self.assertRaises(AiKeyRejected):
            run(llm=FakeLlm(RuntimeError("401 unauthorized")))

    def test_unusable_answer_raises_instead_of_placeholder(self):
        with self.assertRaises(PortfolioAnalysisInvalid):
            run(
                llm=FakeLlm(
                    {
                        "overall_analysis": {
                            "summary": "  ",
                            "risk_level": "low",
                            "diversification_score": 1,
                        }
                    }
                )
            )
        with self.assertRaises(PortfolioAnalysisInvalid):
            run(llm=FakeLlm({"unexpected": True}))

    def test_no_visible_positions(self):
        with self.assertRaises(NoPositions):
            build_messages({"accounts": [{"portfolio_positions": []}]}, "zh")

    def test_language_follows_locale_and_hidden_positions_are_left_out(self):
        zh, _ = build_messages(HOLDINGS, "zh")
        en, _ = build_messages(HOLDINGS, "en")
        self.assertIn("Simplified Chinese", zh[0][1])
        self.assertNotIn("Simplified Chinese", en[0][1])
        self.assertIn("NVDA", zh[1][1])
        self.assertNotIn("HIDE", zh[1][1])


class FakeQuery:
    def __init__(self, db, name):
        self.db, self.name, self.filters, self._limit, self._insert = db, name, [], None, None

    def select(self, fields):
        return self

    def insert(self, row):
        self._insert = row
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def order(self, key, desc=False):
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        rows = self.db.setdefault(self.name, [])
        if self._insert is not None:
            row = {
                "id": f"00000000-0000-0000-0000-00000000000{len(rows) + 1}",
                "created_at": f"2026-11-19T00:00:0{len(rows)}Z",
                **self._insert,
            }
            rows.append(row)
            return type("R", (), {"data": [row]})()
        found = [r for r in rows if all(r.get(k) == v for k, v in self.filters)]
        found = sorted(found, key=lambda r: r["created_at"], reverse=True)[: self._limit]
        return type("R", (), {"data": found})()


class FakeDb:
    def __init__(self):
        self.db = {}

    def table(self, name):
        return FakeQuery(self.db, name)


class SavedRunsTests(unittest.TestCase):
    def test_save_list_and_get_are_scoped_to_owner(self):
        runs = PortfolioAnalysisRuns(FakeDb())
        mine = runs.save("u1", run(), "zh")
        runs.save("u2", run(), "en")
        items = runs.list("u1")
        self.assertEqual([i["id"] for i in items], [mine["id"]])
        self.assertEqual(items[0]["model_id"], "deepseek-flash")
        self.assertEqual(items[0]["summary"], "集中于半导体。")
        self.assertNotIn("result", items[0])
        self.assertEqual(runs.get("u1", mine["id"])["overall_analysis"]["risk_level"], "high")
        self.assertIsNone(runs.get("u2", mine["id"]))

    def test_saved_record_holds_no_key_or_prompt(self):
        db = FakeDb()
        PortfolioAnalysisRuns(db).save("u1", run(), "zh")
        text = json.dumps(db.db["portfolio_ai_analyses"][0], ensure_ascii=False)
        self.assertNotIn("secret-key", text)
        self.assertNotIn("expert portfolio analyst", text)

    def test_long_summary_is_shortened_for_the_list(self):
        data = run()
        data["overall_analysis"]["summary"] = "x" * 1000
        row = PortfolioAnalysisRuns(FakeDb()).save("u1", data, "zh")
        self.assertLessEqual(len(row["summary"]), 280)
        self.assertEqual(len(row["result"]["overall_analysis"]["summary"]), 1000)


class FakePortfolioService:
    def __init__(self, holdings):
        self.holdings = holdings

    async def get_user_holdings(self, user_id):
        return self.holdings


class FakeKeys:
    async def get_keys_dict(self, user_id):
        return KEYS


class BrokenRuns(PortfolioAnalysisRuns):
    def save(self, *args):
        raise RuntimeError("database down")


def client(user="u1", holdings=HOLDINGS, runs=None):
    app = FastAPI()
    app.include_router(portfolio_router, prefix="/api/v1")
    store = runs or PortfolioAnalysisRuns(FakeDb())
    app.dependency_overrides[get_current_user_id] = lambda: user
    app.dependency_overrides[get_portfolio_service] = lambda: FakePortfolioService(holdings)
    app.dependency_overrides[get_user_api_keys_service] = lambda: FakeKeys()
    app.dependency_overrides[get_portfolio_analysis_runs] = lambda: store
    return TestClient(app), store


def fake_run(answer=ANSWER):
    async def _run(holdings, **kwargs):
        return await run_portfolio_analysis(holdings, llm=FakeLlm(answer), **kwargs)

    return _run


class RouteTests(unittest.TestCase):
    def post(self, http, body):
        with patch("app.api.routes.portfolio.analysis_routes.run_portfolio_analysis", fake_run()):
            return http.post("/api/v1/portfolio/analysis", json=body)

    def test_run_is_saved_and_shows_in_history(self):
        http, store = client()
        res = self.post(http, {"model": "deepseek-flash", "locale": "en"})
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        self.assertTrue(body["saved"])
        self.assertEqual(body["model"], "deepseek-flash")
        listed = http.get("/api/v1/portfolio/analysis/runs").json()["items"]
        self.assertEqual([i["id"] for i in listed], [body["id"]])
        self.assertEqual(listed[0]["locale"], "en")
        detail = http.get(f"/api/v1/portfolio/analysis/runs/{body['id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["stock_analyses"][0]["symbol"], "NVDA")

    def test_other_users_run_is_not_found(self):
        store = PortfolioAnalysisRuns(FakeDb())
        mine, _ = client("u1", runs=store)
        body = self.post(mine, {"model": "deepseek-flash"}).json()
        theirs, _ = client("u2", runs=store)
        self.assertEqual(
            theirs.get(f"/api/v1/portfolio/analysis/runs/{body['id']}").status_code, 404
        )
        self.assertEqual(theirs.get("/api/v1/portfolio/analysis/runs").json()["items"], [])

    def test_missing_model_is_a_stable_code(self):
        http, store = client()
        res = self.post(http, {})
        self.assertEqual((res.status_code, res.json()["detail"]), (503, "ai_not_configured"))
        self.assertEqual(http.get("/api/v1/portfolio/analysis/runs").json()["items"], [])

    def test_no_holdings(self):
        http, _ = client(holdings={"accounts": []})
        res = self.post(http, {"model": "deepseek-flash"})
        self.assertEqual((res.status_code, res.json()["detail"]), (404, "no_positions"))

    def test_storage_failure_still_returns_result(self):
        http, _ = client(runs=BrokenRuns(FakeDb()))
        res = self.post(http, {"model": "deepseek-flash"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual((res.json()["saved"], res.json()["id"]), (False, None))

    def test_bad_run_id_and_limit_are_rejected(self):
        http, _ = client()
        self.assertEqual(http.get("/api/v1/portfolio/analysis/runs/not-an-id").status_code, 422)
        self.assertEqual(http.get("/api/v1/portfolio/analysis/runs?limit=500").status_code, 422)


if __name__ == "__main__":
    unittest.main()
