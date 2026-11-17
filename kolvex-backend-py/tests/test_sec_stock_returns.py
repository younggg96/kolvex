from datetime import date
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import free_research
from app.services.sec import stock_returns


@pytest.fixture(autouse=True)
def empty_history_cache():
    stock_returns.adjusted_history.cache_clear()
    yield
    stock_returns.adjusted_history.cache_clear()


def test_adjusted_history_uses_only_positive_finite_closes(monkeypatch):
    downloader = Mock(
        return_value={
            "AAPL": [
                ("2026-11-11", float("nan")),
                ("2026-11-12", 100.5),
                ("2026-11-13", 102.5),
            ]
        }
    )
    monkeypatch.setattr(stock_returns, "yahoo_closes", downloader)
    end = date(2026, 11, 16)
    first = stock_returns.adjusted_history("AAPL", end)
    assert first["prices"] == [
        {"date": "2026-11-12", "adjusted_close": 100.5},
        {"date": "2026-11-13", "adjusted_close": 102.5},
    ]
    assert stock_returns.adjusted_history("AAPL", end) == first
    downloader.assert_called_once_with(["AAPL"], "2025-11-11", "2026-11-16")


def test_stock_returns_route_returns_503_and_retries_without_caching_failure(monkeypatch):
    downloader = Mock(
        side_effect=[{"AAPL": []}, {"AAPL": [("2026-11-12", 80), ("2026-11-13", 90)]}]
    )
    monkeypatch.setattr(stock_returns, "yahoo_closes", downloader)
    app = FastAPI()
    app.include_router(free_research.router)
    client = TestClient(app)
    url = "/market/free-research/aapl/stock-returns"
    assert client.get(url).status_code == 503
    result = client.get(url)
    assert result.status_code == 200
    assert result.json()["symbol"] == "AAPL"
    assert result.json()["prices"][-1]["adjusted_close"] == 90
