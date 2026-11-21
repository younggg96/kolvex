"""Free weekly allowance on the server DeepSeek key (app/services/free_llm_quota.py)."""

import asyncio
import contextvars
import json
import math
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, LLMResult

from app.services import free_llm_quota as quota

# 2026-11-18 is a Wednesday. 02:00 UTC is peak; 12:00 UTC is off-peak.
PEAK = datetime(2026, 11, 18, 2, tzinfo=timezone.utc)
OFF_PEAK = datetime(2026, 11, 18, 12, tzinfo=timezone.utc)


class FakeStore:
    def __init__(self, connected=True):
        self.is_connected = connected
        self.values: dict[str, int] = {}
        self.ttls: dict[str, int] = {}

    async def get(self, key):
        value = self.values.get(key)
        return None if value is None else str(value)

    async def incr(self, key, amount=1):
        self.values[key] = self.values.get(key, 0) + amount
        return self.values[key]

    async def expire(self, key, ttl):
        self.ttls[key] = ttl
        return True

    async def set_if_absent(self, key, value, ttl):
        if key in self.values:
            return False
        self.values[key] = int(value)
        self.ttls[key] = ttl
        return True


class FakeLedger:
    def __init__(self, readable=True):
        self.rows: list[dict] = []
        self.readable = readable

    async def insert(self, row):
        self.rows.append(row)
        return True

    async def week_usage(self, user_id, week):
        if not self.readable:
            return None
        rows = [r for r in self.rows if r["user_id"] == user_id and r["week_start"] == week]
        totals = {k: sum(r[k] for r in rows) for k in quota.USAGE_FIELDS if k != "calls"}
        return {**totals, "calls": len(rows)}

    async def week_spend(self, user_id, week):
        usage = await self.week_usage(user_id, week)
        return None if usage is None else usage["cost_micro_yuan"]


@pytest.fixture(autouse=True)
def ledger():
    """Every test gets its own in-memory ledger; none reaches Supabase."""
    fake = FakeLedger()
    with patch.object(quota, "_ledger", lambda: fake):
        yield fake


def run(coro):
    return asyncio.run(coro)


def in_fresh_context(fn):
    """Run fn so bill_to() inside it never leaks into other tests."""
    return contextvars.copy_context().run(fn)


# ---------- pricing ----------


def test_peak_cost_uses_the_official_flash_prices():
    # 1M of each at peak: 0.006 + 0.30 + 1.20 = 1.506 USD
    cost = quota.cost_micro_yuan(1_000_000, 1_000_000, 1_000_000, PEAK)
    assert cost == pytest.approx(1.506 * quota.settings.FREE_LLM_USD_CNY * quota.MICRO, abs=1)


def test_off_peak_is_half_price():
    peak = quota.cost_micro_yuan(0, 2000, 800, PEAK)
    assert quota.cost_micro_yuan(0, 2000, 800, OFF_PEAK) == pytest.approx(peak / 2, abs=1)


def test_weekend_is_off_peak():
    saturday = datetime(2026, 11, 21, 2, tzinfo=timezone.utc)
    assert not quota.is_peak(saturday)
    assert quota.is_peak(PEAK)


def test_any_nonzero_call_costs_at_least_one_unit():
    assert quota.cost_micro_yuan(1, 0, 0, OFF_PEAK) == 1  # 0.02 µ¥ rounds up, never down to free
    assert quota.cost_micro_yuan(0, 0, 0, OFF_PEAK) == 0


# ---------- weeks ----------


def test_week_turns_over_at_monday_midnight_beijing():
    sunday_late = datetime(2026, 11, 22, 15, 59, tzinfo=timezone.utc)  # Sun 23:59 Beijing
    monday = datetime(2026, 11, 22, 16, 0, tzinfo=timezone.utc)  # Mon 00:00 Beijing
    assert quota.week_id(sunday_late) == "2026-11-16"
    assert quota.week_id(monday) == "2026-11-23"


# ---------- usage ----------


def result_with(message):
    return LLMResult(generations=[[ChatGeneration(message=message)]])


def test_usage_reads_cache_hits_from_usage_metadata():
    message = AIMessage(
        content="x",
        usage_metadata={
            "input_tokens": 1000,
            "output_tokens": 50,
            "total_tokens": 1050,
            "input_token_details": {"cache_read": 600},
        },
    )
    assert quota.usage_of(result_with(message)) == (600, 400, 50)


def test_usage_falls_back_to_deepseek_raw_usage():
    result = LLMResult(
        generations=[[ChatGeneration(message=AIMessage(content="x"))]],
        llm_output={
            "token_usage": {
                "prompt_tokens": 900,
                "prompt_cache_hit_tokens": 100,
                "completion_tokens": 30,
            }
        },
    )
    assert quota.usage_of(result) == (100, 800, 30)


def test_missing_usage_is_reported_as_none():
    assert quota.usage_of(result_with(AIMessage(content="x"))) is None


# ---------- allowance ----------


def test_allowance_is_refused_once_the_limit_is_spent():
    store = FakeStore()
    run(quota.ensure_allowance("u1", PEAK, store))  # nothing spent yet
    run(quota.record_spend("u1", quota.weekly_limit_micro(), PEAK, store))
    with pytest.raises(quota.FreeQuotaExceeded):
        run(quota.ensure_allowance("u1", PEAK, store))
    # Another user and next week are untouched.
    run(quota.ensure_allowance("u2", PEAK, store))
    run(quota.ensure_allowance("u1", datetime(2026, 11, 25, 2, tzinfo=timezone.utc), store))


def test_each_charge_writes_a_ledger_row(ledger):
    store = FakeStore()
    run(quota.record_spend("u1", 42, PEAK, store, usage=(10, 20, 30)))
    assert ledger.rows == [
        {
            "user_id": "u1",
            "week_start": "2026-11-16",
            "model": "deepseek-flash",
            "cache_hit_tokens": 10,
            "cache_miss_tokens": 20,
            "output_tokens": 30,
            "cost_micro_yuan": 42,
            "estimated": False,
            "peak": True,
        }
    ]


def test_lost_redis_total_is_rebuilt_from_the_ledger_before_a_call(ledger):
    store = FakeStore()
    run(quota.record_spend("u1", quota.weekly_limit_micro(), PEAK, store))
    store.values.clear()  # Redis restarted
    with pytest.raises(quota.FreeQuotaExceeded):
        run(quota.ensure_allowance("u1", PEAK, store))
    assert store.values[quota.spend_key("u1", PEAK)] == quota.weekly_limit_micro()


def test_lost_redis_total_is_rebuilt_when_a_call_finishes_first(ledger):
    store = FakeStore()
    run(quota.record_spend("u1", 300, PEAK, store))
    store.values.clear()
    assert run(quota.record_spend("u1", 50, PEAK, store)) == 350
    assert run(quota.spent_micro("u1", PEAK, store)) == 350


def test_new_week_starts_from_zero_and_caches_it(ledger):
    store = FakeStore()
    assert run(quota.spent_micro("u1", PEAK, store)) == 0
    assert store.values[quota.spend_key("u1", PEAK)] == 0


def test_unreadable_ledger_with_no_redis_total_refuses():
    store = FakeStore()
    with patch.object(quota, "_ledger", lambda: FakeLedger(readable=False)):
        with pytest.raises(quota.FreeQuotaUnavailable):
            run(quota.ensure_allowance("u1", PEAK, store))


def test_spend_key_expires_after_the_week():
    store = FakeStore()
    run(quota.record_spend("u1", 10, PEAK, store))
    assert store.ttls[quota.spend_key("u1", PEAK)] == 8 * 24 * 3600


def test_without_redis_the_limit_is_enforced_from_the_ledger(ledger):
    store = FakeStore(connected=False)
    run(quota.ensure_allowance("u1", PEAK, store))  # nothing spent yet
    run(quota.record_spend("u1", quota.weekly_limit_micro() - 1, PEAK, store, usage=(0, 5, 5)))
    run(quota.ensure_allowance("u1", PEAK, store))
    run(quota.record_spend("u1", 1, PEAK, store))
    with pytest.raises(quota.FreeQuotaExceeded):
        run(quota.ensure_allowance("u1", PEAK, store))
    assert len(ledger.rows) == 2
    status = run(quota.allowance("u1", PEAK, store))
    assert status["used_percent"] == 100 and status["tokens"]["output_tokens"] == 5


def test_without_redis_or_ledger_the_free_model_is_refused():
    with patch.object(quota, "_ledger", lambda: FakeLedger(readable=False)):
        with pytest.raises(quota.FreeQuotaUnavailable):
            run(quota.ensure_allowance("u1", PEAK, FakeStore(connected=False)))


def test_allowance_shows_tokens_and_share_used_never_money():
    store = FakeStore()
    run(quota.record_spend("u1", 250_000, PEAK, store, usage=(600, 400, 50)))
    run(quota.record_spend("u1", 1, PEAK, store, usage=(0, 10, 5)))
    status = run(quota.allowance("u1", PEAK, store))
    assert status == {
        "model": "deepseek-flash",
        "used_percent": math.ceil(250_001 * 100 / quota.weekly_limit_micro()),
        "exhausted": False,
        "resets_at": "2026-11-23T00:00:00+08:00",
        "tokens": {
            "input_tokens": 1010,
            "cached_input_tokens": 600,
            "output_tokens": 55,
            "model_calls": 2,
        },
    }
    assert not any("yuan" in key for key in status)


def test_a_single_call_never_reads_as_zero_percent():
    store = FakeStore()
    run(quota.record_spend("u1", 1, PEAK, store))
    assert run(quota.allowance("u1", PEAK, store))["used_percent"] == 1


def test_allowance_without_a_readable_ledger_still_shows_the_share():
    store = FakeStore()
    run(quota.record_spend("u1", 10, PEAK, store))
    with patch.object(quota, "_ledger", lambda: FakeLedger(readable=False)):
        status = run(quota.allowance("u1", PEAK, store))
    assert status["tokens"] is None
    assert status["used_percent"] == 1


def test_call_without_usage_is_still_charged_by_an_estimate(ledger):
    store = FakeStore()
    callback = quota.FreeQuotaCallback("u1")
    with patch.object(quota, "_store", lambda: store):
        run(callback.on_chat_model_start({}, [[AIMessage(content="a" * 3000)]], run_id="r1"))
        run(callback.on_llm_end(result_with(AIMessage(content="b" * 500)), run_id="r1"))
    now = datetime.now(timezone.utc)
    assert sum(store.values.values()) == quota.cost_micro_yuan(0, 3000, 500, now)
    assert ledger.rows[0]["estimated"] is True
    assert ledger.rows[0]["cache_miss_tokens"] == 3000


def test_callback_charges_each_finished_call_and_blocks_when_spent():
    store = FakeStore()
    callback = quota.FreeQuotaCallback("u1")
    message = AIMessage(
        content="x",
        usage_metadata={"input_tokens": 2000, "output_tokens": 800, "total_tokens": 2800},
    )
    with patch.object(quota, "_store", lambda: store):
        run(callback.on_chat_model_start({}, []))
        run(callback.on_llm_end(result_with(message)))
        assert sum(store.values.values()) > 0
        store.values = {k: quota.weekly_limit_micro() for k in store.values}
        with pytest.raises(quota.FreeQuotaExceeded):
            run(callback.on_chat_model_start({}, []))


# ---------- model factory ----------


def test_signed_in_user_without_a_key_gets_the_metered_free_model():
    from app.agent import llm

    def create():
        quota.bill_to("u1")
        return llm._create_llm("openai", "gpt-6-astra")

    with patch.object(llm, "DEEPSEEK_API_KEY", "server-key"):
        model = in_fresh_context(create)
    assert model.model_name == "deepseek-flash"
    assert model.openai_api_base == "https://api.deepseek.com/v1"
    assert any(isinstance(c, quota.FreeQuotaCallback) for c in model.callbacks)
    assert model.stream_usage is True


def test_user_with_their_own_key_is_not_metered():
    from app.agent import llm

    def create():
        quota.bill_to("u1")
        return llm._create_llm("deepseek", "deepseek-v4-pro", user_api_keys={"deepseek": "mine"})

    model = in_fresh_context(create)
    assert model.model_name == "deepseek-v4-pro"
    assert not any(isinstance(c, quota.FreeQuotaCallback) for c in model.callbacks or [])


def test_work_without_a_signed_in_user_is_not_metered():
    from app.agent import llm

    with patch.object(llm, "DEEPSEEK_API_KEY", "server-key"):
        model = in_fresh_context(lambda: llm._create_llm("deepseek", "deepseek-v4-pro"))
    assert model.model_name == "deepseek-v4-pro"
    assert not model.callbacks


def test_uses_free_model_follows_the_users_own_keys():
    from app.agent import llm

    def check():
        quota.bill_to("u1")
        return (
            llm.uses_free_model("claude-opus-5-5", {}),
            llm.uses_free_model("claude-opus-5-5", {"anthropic": "mine"}),
        )

    assert in_fresh_context(check) == (True, False)


# ---------- authentication sets the billed user ----------


def test_authentication_bills_the_request_to_the_signed_in_user():
    from app.api.dependencies import auth

    app = FastAPI()

    @app.get("/who")
    async def who(user_id: str = Depends(auth.get_current_user_id)):
        return {"user": user_id, "billed": quota.billed_user()}

    app.dependency_overrides[auth.get_supabase] = lambda: None
    with patch.object(auth, "_verified_user", AsyncMock(return_value=SimpleNamespace(id="u9"))):
        response = TestClient(app).get("/who", headers={"Authorization": "Bearer t"})
    assert response.json() == {"user": "u9", "billed": "u9"}


# ---------- features outside the allowance ----------


def test_trading_analysis_needs_the_users_own_key():
    from app.services import trading_analysis_service as ta

    def build():
        quota.bill_to("u1")
        return ta.build_ta_config(provider="deepseek", user_api_keys={})

    with pytest.raises(quota.FreeTierNotSupported):
        in_fresh_context(build)
    config = in_fresh_context(
        lambda: (
            quota.bill_to("u1"),
            ta.build_ta_config("deepseek", user_api_keys={"deepseek": "mine"}),
        )[1]
    )
    assert config["api_key"] == "mine"


# ---------- chat ----------


def test_chat_refuses_a_turn_once_the_free_allowance_is_spent():
    from app.api.routes.chat import routes

    app = FastAPI()
    app.include_router(routes.router)

    async def signed_in():
        quota.bill_to("user-1")
        return "user-1"

    app.dependency_overrides[routes.get_current_user_id] = signed_in
    app.dependency_overrides[routes.get_user_api_keys_service] = lambda: SimpleNamespace(
        get_keys_dict=AsyncMock(return_value={})
    )
    with patch.object(quota, "ensure_allowance", AsyncMock(side_effect=quota.FreeQuotaExceeded())):
        response = TestClient(app).post(
            "/conversations/c1/stream", json={"content": "hi", "model": "deepseek-flash"}
        )
    assert response.status_code == 429
    assert response.json()["detail"] == "free_quota_exceeded"


def test_stream_reports_a_spent_allowance_by_code():
    from app.agent.graphs import supervisor

    class Spent:
        async def astream_events(self, *_args, **_kwargs):
            raise quota.FreeQuotaExceeded()
            yield  # pragma: no cover

    async def collect():
        with patch.object(supervisor, "_create_agent_for_request", lambda *a, **k: Spent()):
            return [
                event
                async for event in supervisor.stream_agent(
                    messages=[], user_id="u1", agent="financial"
                )
            ]

    events = run(collect())
    assert events[-1]["type"] == "error"
    assert events[-1]["code"] == "free_quota_exceeded"


# ---------- tokens per chat turn ----------


def test_turn_usage_counts_every_model_call_of_the_turn():
    from app.agent import llm
    from app.agent.turn_usage import TurnUsageCallback, start_turn

    def build():
        turn = start_turn()
        model = llm._create_llm("deepseek", "deepseek-v4-pro", user_api_keys={"deepseek": "mine"})
        return turn, model

    turn, model = in_fresh_context(build)
    callback = next(c for c in model.callbacks if isinstance(c, TurnUsageCallback))
    usage = {
        "input_tokens": 1000,
        "output_tokens": 80,
        "total_tokens": 1080,
        "input_token_details": {"cache_read": 700},
    }
    run(callback.on_llm_end(result_with(AIMessage(content="a", usage_metadata=usage))))
    run(callback.on_llm_end(result_with(AIMessage(content="b", usage_metadata=usage))))
    assert turn.as_dict() == {
        "input_tokens": 2000,
        "cached_input_tokens": 1400,
        "output_tokens": 160,
        "model_calls": 2,
        "incomplete": False,
    }
    assert model.stream_usage is True


def test_turn_with_a_call_missing_usage_is_marked_incomplete():
    from app.agent.turn_usage import TurnUsage, TurnUsageCallback

    turn = TurnUsage()
    run(TurnUsageCallback(turn).on_llm_end(result_with(AIMessage(content="x"))))
    assert turn.as_dict()["incomplete"] is True


def test_turn_without_model_calls_saves_no_token_usage():
    from app.agent.turn_usage import TurnUsage

    assert TurnUsage().as_dict() is None


def test_models_outside_a_chat_turn_are_not_counted():
    from app.agent import llm
    from app.agent.turn_usage import TurnUsageCallback

    model = in_fresh_context(
        lambda: llm._create_llm("deepseek", "deepseek-v4-pro", user_api_keys={"deepseek": "mine"})
    )
    assert not any(isinstance(c, TurnUsageCallback) for c in model.callbacks or [])


def test_streamed_answer_is_saved_and_sent_with_its_tokens():
    from app.agent.turn_usage import current_turn
    from app.api.routes.chat import routes

    async def fake_stream(**_kwargs):
        turn = current_turn()
        turn.model_calls, turn.input_tokens, turn.output_tokens = 2, 900, 120
        yield {"type": "token", "content": "Answer"}
        yield {"type": "done"}

    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_current_user_id] = lambda: "user-1"
    app.dependency_overrides[routes.get_user_api_keys_service] = lambda: SimpleNamespace(
        get_keys_dict=AsyncMock(return_value={})
    )
    save = AsyncMock(return_value={"id": "m1", "created_at": "now"})

    async def save_user(*_args, **_kwargs):
        return {
            "id": "u1",
            "conversation_id": "c1",
            "role": "user",
            "content": "hi",
            "created_at": "now",
        }

    with (
        patch("app.agent.memory.save_message", save),
        patch("app.agent.memory.save_user_message_once", save_user),
        patch("app.agent.memory.load_conversation_history", AsyncMock(return_value=[])),
        patch.object(routes, "turn_context", AsyncMock(return_value=None)),
        patch("app.agent.graphs.supervisor.stream_agent", fake_stream),
    ):
        response = TestClient(app).post("/conversations/c1/stream", json={"content": "hi"})
    expected = {
        "input_tokens": 900,
        "cached_input_tokens": 0,
        "output_tokens": 120,
        "model_calls": 2,
        "incomplete": False,
    }
    assert save.await_args.kwargs["token_usage"] == expected
    done = [line for line in response.text.splitlines() if '"done"' in line][-1]
    assert json.loads(done[6:])["token_usage"] == expected
