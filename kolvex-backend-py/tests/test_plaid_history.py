import asyncio
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, call

from app.services import plaid_snapshot_worker as worker
from app.services.plaid import PlaidService
from app.services.plaid_history import calculate_snapshot, capture_session

SESSION = date(2026, 11, 16)


def holdings_payload():
    return {
        "accounts": [{"account_id": "A"}],
        "securities": [
            {
                "security_id": "stock",
                "ticker_symbol": "PANW",
                "type": "equity",
                "market_identifier_code": "XNAS",
                "iso_currency_code": "USD",
            },
            {"security_id": "cash", "type": "cash"},
        ],
        "holdings": [
            {
                "account_id": "A",
                "security_id": "stock",
                "quantity": 10,
                "iso_currency_code": "USD",
                "institution_price": 100,
                "institution_price_as_of": "2026-11-13",
                "institution_value": 1000,
                "cost_basis": 600,
            },
            {
                "account_id": "A",
                "security_id": "cash",
                "quantity": 20,
                "iso_currency_code": "USD",
                "institution_value": 20,
            },
        ],
    }


def test_stale_broker_quote_uses_same_session_market_close():
    lookup = AsyncMock(return_value=110)
    snapshot = asyncio.run(calculate_snapshot([holdings_payload()], SESSION, lookup))
    assert snapshot == {
        "total_value": 1120,
        "total_cost_basis": 600,
        "unrealized_pnl": 500,
        "positions_count": 2,
        "accounts_count": 1,
    }
    lookup.assert_awaited_once_with("PANW", SESSION)


def test_missing_quote_leaves_a_gap_instead_of_recording_stale_value():
    snapshot = asyncio.run(
        calculate_snapshot([holdings_payload()], SESSION, AsyncMock(return_value=None))
    )
    assert snapshot is None


def test_incomplete_second_account_does_not_save_partial_portfolio():
    complete = holdings_payload()
    complete["holdings"][0]["institution_price_as_of"] = SESSION.isoformat()
    incomplete = holdings_payload()
    del incomplete["holdings"][0]["cost_basis"]
    snapshot = asyncio.run(
        calculate_snapshot([complete, incomplete], SESSION, AsyncMock(return_value=110))
    )
    assert snapshot is None


def test_same_price_on_a_new_date_is_valid():
    payload = holdings_payload()
    payload["holdings"][0]["institution_price_as_of"] = SESSION.isoformat()
    lookup = AsyncMock()
    snapshot = asyncio.run(calculate_snapshot([payload], SESSION, lookup))
    assert snapshot["total_value"] == 1020
    lookup.assert_not_awaited()


def test_session_is_exchange_close_not_sync_date():
    assert capture_session(datetime(2026, 11, 14, 3, tzinfo=timezone.utc)) == date(2026, 11, 13)
    assert capture_session(datetime(2026, 11, 17, 11, tzinfo=timezone.utc)) == SESSION
    assert capture_session(datetime(2026, 11, 16, 17, tzinfo=timezone.utc)) is None
    # Thanksgiving and the following early close.
    assert capture_session(datetime(2026, 11, 27, 3, tzinfo=timezone.utc)) is None
    assert capture_session(datetime(2026, 11, 27, 20, tzinfo=timezone.utc)) == date(2026, 11, 27)


def test_securities_close_can_value_stale_broker_holding_without_external_fallback():
    payload = holdings_payload()
    payload["securities"][0].update(close_price=108, close_price_as_of=SESSION.isoformat())
    lookup = AsyncMock()
    snapshot = asyncio.run(calculate_snapshot([payload], SESSION, lookup))
    assert snapshot["total_value"] == 1100
    assert snapshot["unrealized_pnl"] == 480
    lookup.assert_not_awaited()


def test_capture_skips_existing_day_without_calling_broker():
    service = PlaidService(supabase=object())
    service.has_snapshot = AsyncMock(return_value=True)
    service._post = AsyncMock()
    connection = {
        "id": "connection",
        "user_id": "user",
        "created_at": "2026-11-12T00:00:00Z",
    }
    assert not asyncio.run(service.capture_daily_snapshot(connection, SESSION))
    service._post.assert_not_awaited()


def test_capture_reads_all_items_and_saves_first_valid_snapshot(monkeypatch):
    service = PlaidService(supabase=object())
    connection = {
        "id": "connection",
        "user_id": "user",
        "created_at": "2026-11-12T00:00:00Z",
        "is_connected": True,
    }
    item = {"id": "item", "is_connected": True, "access_token_encrypted": service._encrypt("mock")}
    service.has_snapshot = AsyncMock(return_value=False)
    service._get_items = AsyncMock(return_value=[item])
    service._get_portfolio_connection = AsyncMock(return_value=connection)
    payload = holdings_payload()
    payload["holdings"][0]["institution_price_as_of"] = SESSION.isoformat()
    service._post = AsyncMock(return_value=payload)
    record = AsyncMock(return_value={"snapshot_date": SESSION.isoformat()})
    monkeypatch.setattr(
        "app.services.plaid.get_portfolio_snapshot_service",
        lambda: SimpleNamespace(record_snapshot=record),
    )

    assert asyncio.run(service.capture_daily_snapshot(connection, SESSION))
    service._post.assert_awaited_once_with("/investments/holdings/get", {"access_token": "mock"})
    record.assert_awaited_once_with(
        user_id="user",
        snapshot_date=SESSION,
        replace_existing=False,
        total_value=1020,
        total_cost_basis=600,
        unrealized_pnl=400,
        positions_count=2,
        accounts_count=1,
    )

    service._get_items.side_effect = [[item], [item, {"id": "new", "is_connected": True}]]
    assert not asyncio.run(service.capture_daily_snapshot(connection, SESSION))
    assert record.await_count == 1


def test_worker_runs_once_per_slot_and_retries_next_slot(monkeypatch):
    completed = {}

    async def remember(key, value, ttl):
        completed[key] = value

    redis = SimpleNamespace(
        get=AsyncMock(side_effect=completed.get),
        acquire_lock=AsyncMock(return_value=True),
        release_lock=AsyncMock(),
        set=AsyncMock(side_effect=remember),
    )
    service = object()
    collect = AsyncMock()
    monkeypatch.setattr(worker, "get_redis", lambda: redis)
    monkeypatch.setattr(worker, "PlaidService", lambda: service)
    monkeypatch.setattr(worker, "collect_snapshots", collect)

    async def run():
        await worker.run_snapshot_tick(datetime(2026, 11, 16, 17, tzinfo=timezone.utc))
        await worker.run_snapshot_tick(datetime(2026, 11, 17, 0, tzinfo=timezone.utc))
        await worker.run_snapshot_tick(datetime(2026, 11, 17, 1, tzinfo=timezone.utc))
        await worker.run_snapshot_tick(datetime(2026, 11, 17, 2, tzinfo=timezone.utc))

    asyncio.run(run())
    assert collect.await_args_list == [call(service, SESSION), call(service, SESSION)]
    assert redis.release_lock.await_count == 2
