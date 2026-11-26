from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_current_user_id
from app.api.routes import fear_greed as routes
from app.core.supabase import get_supabase_service
from app.services import fear_greed as store

HEADER = "DATE,SCORE,RATING\n"
CSV = HEADER + "2026-01-08,100,Extreme Greed\n2026-01-07,0,EXTREME FEAR\n"
TODAY = date(2026, 1, 9)


def test_parse_accepts_both_header_variants_scores_at_bounds_and_official_labels():
    rows = store.parse_csv(("\ufeff" + CSV).encode(), TODAY)
    assert [row.model_dump(mode="json") for row in rows] == [
        {"date": "2026-01-07", "score": 0, "rating": "extreme fear"},
        {"date": "2026-01-08", "score": 100, "rating": "extreme greed"},
    ]
    bare = store.parse_csv(b"DATE,SCORE\n2026-01-08,51.4\n", TODAY)[0]
    assert (bare.score, bare.rating) == (51.4, None)


@pytest.mark.parametrize(
    ("csv", "code", "line"),
    [
        ("DATE,CLOSE\n", "header", 1),
        (HEADER, "empty", None),
        (HEADER + "2026-01-08,10", "columns", 2),
        (HEADER + "2026-01-10,1,", "date", 2),
        (HEADER + "2026-02-30,1,", "date", 2),
        (CSV + "2026-01-07,2,", "duplicate", 4),
        (HEADER + "2026-01-08,NaN,", "score", 2),
        (HEADER + "2026-01-08,-0.1,", "score", 2),
        (HEADER + "2026-01-08,100.001,", "score", 2),
        (HEADER + "2026-01-08,70,bullish", "rating", 2),
    ],
)
def test_reject_whole_invalid_batch(csv, code, line):
    with pytest.raises(store.InvalidCsv) as error:
        store.parse_csv(csv.encode(), TODAY)
    assert (error.value.code, error.value.line) == (code, line)


@pytest.fixture
def local_api(monkeypatch):
    db = Mock()
    observations = db.table.return_value
    listing = observations.select.return_value.order.return_value.limit.return_value
    listing.execute.return_value = SimpleNamespace(data=[])
    profile = Mock()
    profile.select.return_value.eq.return_value.single.return_value.execute.side_effect = [
        SimpleNamespace(data={"is_admin": value}) for value in (False, True, True, True, True)
    ]
    db.table.side_effect = lambda table: profile if table == "user_profiles" else observations
    monkeypatch.setattr(routes, "get_supabase_service", lambda: db)

    def identity(authorization: str = Header("")):
        if not authorization:
            raise HTTPException(401)
        return authorization

    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[get_current_user_id] = identity
    app.dependency_overrides[get_supabase_service] = lambda: db
    return TestClient(app), observations, listing


def test_only_admin_can_import_preview_is_read_only_and_read_model_hides_audit_fields(local_api):
    client, table, listing = local_api
    path = "/admin/fear-greed"
    admin = {"Authorization": "admin"}

    assert client.post(path, content=CSV).status_code == 401
    assert client.post(path, content=CSV, headers={"Authorization": "reader"}).status_code == 403
    assert client.get("/market/fear-greed").json() == []
    assert client.post(path + "?validate=true", content=CSV, headers=admin).json() == {
        "count": 2,
        "first_date": "2026-01-07",
        "last_date": "2026-01-08",
    }
    assert client.post(path, content=CSV + "wrong", headers=admin).status_code == 422
    assert client.post(path, content=b"x" * (store.MAX_BYTES + 1), headers=admin).status_code == 413
    table.upsert.assert_not_called()

    assert client.post(path, content=CSV, headers=admin).status_code == 200
    records = table.upsert.call_args.args[0]
    assert table.upsert.call_args.kwargs == {"on_conflict": "date", "returning": "minimal"}
    assert [row["updated_by"] for row in records] == ["admin", "admin"]

    listing.execute.return_value = SimpleNamespace(data=list(reversed(records)))
    assert client.get("/market/fear-greed").json() == [
        {"date": "2026-01-07", "score": 0, "rating": "extreme fear"},
        {"date": "2026-01-08", "score": 100, "rating": "extreme greed"},
    ]
    query = table.select.return_value.order.return_value
    query.limit.assert_called_with(90)


def test_database_failure_is_distinct_from_empty_history(local_api):
    client, _, listing = local_api
    listing.execute.side_effect = RuntimeError("database unavailable")
    assert client.get("/market/fear-greed").status_code == 503


# ---------------- automatic sync from the local Playwright worker ----------------

MIDNIGHT_JAN_7 = 1767744000000  # 2026-01-07T00:00:00Z
DAY_MS = 86_400_000
NOW = datetime(2026, 1, 9, 12, 0, tzinfo=store.NEW_YORK)  # Friday, after the open
CNN = {
    "fear_and_greed": {
        "score": 61.2,
        "rating": "Greed",
        # 21:30 New York on Jan 8 is already Jan 9 in UTC; it belongs to Jan 8.
        "timestamp": "2026-01-09T02:30:00+00:00",
    },
    "fear_and_greed_historical": {
        "data": [
            {"x": MIDNIGHT_JAN_7, "y": 24.9, "rating": "extreme fear"},
            {"x": MIDNIGHT_JAN_7 + DAY_MS, "y": 55.0, "rating": "neutral"},
            {"x": MIDNIGHT_JAN_7 + 3 * DAY_MS, "y": 50.0, "rating": "neutral"},
        ]
    },
}


def test_parse_cnn_graph_dates_ratings_and_current_reading_wins():
    rows = store.parse_cnn_graph(CNN, NOW)
    assert [row.model_dump(mode="json") for row in rows] == [
        {"date": "2026-01-07", "score": 24.9, "rating": "extreme fear"},
        {"date": "2026-01-08", "score": 61.2, "rating": "greed"},
    ]  # Jan 10 is a future Saturday and dropped.


def test_parse_cnn_graph_drops_carried_points_for_holidays_and_before_the_open():
    # Real shape seen 2026-11-25 20:39 ET: after the close CNN opens Thanksgiving's point
    # with the last close; it is not an observation.
    nov_25 = 1795564800000  # 2026-11-25T00:00:00Z
    payload = {
        "fear_and_greed": {
            "score": 15.2,
            "rating": "extreme fear",
            "timestamp": "2026-11-26T01:00:00+00:00",
        },
        "fear_and_greed_historical": {
            "data": [
                {"x": nov_25 - DAY_MS, "y": 10.9, "rating": "extreme fear"},
                {"x": nov_25, "y": 15.2, "rating": "extreme fear"},
                {"x": nov_25 + DAY_MS, "y": 15.2, "rating": "extreme fear"},
                {"x": nov_25 + 2 * DAY_MS, "y": 15.2, "rating": "extreme fear"},
            ]
        },
    }

    def dates(now):
        return [str(row.date) for row in store.parse_cnn_graph(payload, now)]

    assert dates(datetime(2026, 11, 26, 0, 39, tzinfo=store.NEW_YORK)) == [
        "2026-11-24",
        "2026-11-25",
    ]
    # Friday the 27th trades, but its carried point is not kept before 09:30.
    assert dates(datetime(2026, 11, 27, 9, 29, tzinfo=store.NEW_YORK)) == [
        "2026-11-24",
        "2026-11-25",
    ]
    assert dates(datetime(2026, 11, 27, 9, 30, tzinfo=store.NEW_YORK))[-1] == "2026-11-27"


def test_parse_cnn_graph_unknown_rating_keeps_score():
    payload = {**CNN, "fear_and_greed": {**CNN["fear_and_greed"], "rating": "bullish"}}
    assert store.parse_cnn_graph(payload, NOW)[-1].rating is None


@pytest.mark.parametrize(
    ("payload", "code"),
    [
        ([], "shape"),
        ({"fear_and_greed": {}}, "shape"),
        ({**CNN, "fear_and_greed_historical": {"data": [{"x": "today", "y": 1}]}}, "date"),
        (
            {**CNN, "fear_and_greed_historical": {"data": [{"x": MIDNIGHT_JAN_7, "y": 101}]}},
            "score",
        ),
        (
            {**CNN, "fear_and_greed_historical": {"data": [{"x": MIDNIGHT_JAN_7, "y": True}]}},
            "score",
        ),
        ({**CNN, "fear_and_greed": {"score": 50, "timestamp": "2026-01-08"}}, "date"),
        (
            {
                **CNN,
                "fear_and_greed": {"score": 50, "timestamp": "2026-02-01T00:00:00+00:00"},
                "fear_and_greed_historical": {"data": []},
            },
            "empty",
        ),
    ],
)
def test_parse_cnn_graph_rejects_whole_malformed_payload(payload, code):
    with pytest.raises(store.InvalidCnnData) as error:
        store.parse_cnn_graph(payload, NOW)
    assert str(error.value) == code


def test_worker_endpoint_requires_token_and_saves_as_automatic(local_api, monkeypatch):
    client, table, _ = local_api
    path = "/fear-greed/worker/cnn"
    monkeypatch.setattr(routes, "datetime", SimpleNamespace(now=lambda tz: NOW))

    monkeypatch.setattr(routes.settings, "FEAR_GREED_WORKER_TOKEN", "")
    assert client.post(path, json=CNN, headers={"X-Worker-Token": "x"}).status_code == 503

    monkeypatch.setattr(routes.settings, "FEAR_GREED_WORKER_TOKEN", "secret")
    assert client.post(path, json=CNN).status_code == 401
    assert client.post(path, json=CNN, headers={"X-Worker-Token": "wrong"}).status_code == 401
    bad = client.post(path, content=b"not json", headers={"X-Worker-Token": "secret"})
    assert (bad.status_code, bad.json()["detail"]) == (422, {"code": "json"})
    table.upsert.assert_not_called()

    response = client.post(path, json=CNN, headers={"X-Worker-Token": "secret"})
    assert response.json() == {
        "count": 2,
        "first_date": "2026-01-07",
        "last_date": "2026-01-08",
        "latest_score": 61.2,
    }
    records = table.upsert.call_args.args[0]
    assert [row["updated_by"] for row in records] == [None, None]


def test_admin_status_reports_source_of_latest_day(local_api, monkeypatch):
    client, table, _ = local_api
    monkeypatch.setattr(routes.settings, "FEAR_GREED_WORKER_TOKEN", "secret")
    latest = table.select.return_value.order.return_value.limit.return_value
    latest.execute.return_value = SimpleNamespace(
        data=[{"date": "2026-01-08", "score": 61.2, "updated_by": None, "updated_at": "t"}]
    )
    assert client.get("/admin/fear-greed/status").status_code == 401
    assert (
        client.get("/admin/fear-greed/status", headers={"Authorization": "reader"}).status_code
        == 403
    )
    assert client.get("/admin/fear-greed/status", headers={"Authorization": "admin"}).json() == {
        "worker_configured": True,
        "latest": {"date": "2026-01-08", "score": 61.2, "updated_at": "t", "source": "worker"},
    }
