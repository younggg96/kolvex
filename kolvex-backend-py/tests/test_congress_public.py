from unittest.mock import MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import congress_trades as routes
from app.core.supabase import get_supabase_service

ROW = {
    "id": 1,
    "member_name": "Nancy Pelosi",
    "chamber": "house",
    "ticker": "NVDA",
    "asset_name": "NVIDIA",
    "trade_date": "2026-11-01",
    "filed_date": "2026-11-10",
    "direction": "buy",
    "transaction_type": "Purchase",
    "amount_range": "$1,001 - $15,000",
    "source_url": "https://example.com/filing.pdf",
}


def client(rows):
    db = MagicMock()
    query = db.table.return_value.select.return_value
    query.eq.return_value = query
    query.order.return_value.order.return_value.range.return_value.execute.return_value.data = rows
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[get_supabase_service] = lambda: db
    return TestClient(app), query


def test_public_trades_need_no_sign_in_and_are_cacheable():
    http, _ = client([ROW])
    response = http.get("/congress/public/trades")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=600"
    assert response.json()["trades"] == [ROW]


def test_public_trades_stay_on_the_newest_page_and_cap_the_size():
    http, query = client([ROW])
    assert http.get("/congress/public/trades?limit=101").status_code == 422
    assert http.get("/congress/public/trades?ticker=bad%20ticker").status_code == 422
    http.get("/congress/public/trades?limit=10&page=5&member=x")
    query.order.return_value.order.return_value.range.assert_called_with(0, 10)


def test_signed_in_search_still_depends_on_the_session_check():
    from app.api.dependencies.auth import get_current_user_id

    assert any(
        dependency.call is get_current_user_id
        for route in routes.router.routes
        if route.path == "/congress/trades"
        for dependency in route.dependant.dependencies
    )
