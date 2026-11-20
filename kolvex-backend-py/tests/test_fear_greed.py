from datetime import date
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
