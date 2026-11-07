import pandas as pd
import pytest

from forecast_service import engine


def test_future_trading_days_skip_weekends_and_nyse_holidays():
    # Fri 2026-11-20 -> skips weekend, Thanksgiving (Thu 11-26) stays closed.
    days = engine.future_timestamps(pd.Timestamp("2026-11-20"), "1d", 5).dt.strftime("%Y-%m-%d").tolist()
    assert days == ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-27", "2026-11-30"]
    # Veterans Day (11-11) is a trading day on NYSE.
    assert "2026-11-11" in engine.future_timestamps(pd.Timestamp("2026-11-10"), "1d", 1).dt.strftime("%Y-%m-%d").tolist()


def test_rejects_short_history_and_bad_interval():
    bars = [{"date": f"2026-01-{d:02d}", "open": 1, "high": 1, "low": 1, "close": 1} for d in range(1, 10)]
    with pytest.raises(engine.ForecastInputError):
        engine.forecast(bars)
    with pytest.raises(engine.ForecastInputError):
        engine.forecast(bars, interval="5m")


def test_forecast_shape_and_band_order():
    dates = pd.bdate_range("2025-01-02", periods=200)
    bars = [
        {"date": d.isoformat(), "open": 100 + i * 0.1, "high": 101 + i * 0.1, "low": 99 + i * 0.1, "close": 100 + i * 0.1, "volume": 1e6}
        for i, d in enumerate(dates)
    ]
    out = engine.forecast(bars, "1d", horizon=5, samples=4, seed=1)
    assert len(out["points"]) == 5
    for p in out["points"]:
        assert p["close_p10"] <= p["close"] <= p["close_p90"]
        assert p["low"] <= p["close"] <= p["high"]
    assert 0 <= out["summary"]["prob_up"] <= 1
