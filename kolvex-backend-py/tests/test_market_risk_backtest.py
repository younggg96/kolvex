from datetime import date

from app.services.market_risk import backtest, engine
from app.services.market_risk.calendar import trading_days

DAYS = trading_days(date(2024, 1, 2), date(2024, 12, 31))


def test_forward_outcomes_use_only_later_closes():
    closes = {DAYS[i]: v for i, v in enumerate([100, 90, 110, 100, 100, 120])}
    out = backtest.forward_outcomes(closes)
    assert round(out[DAYS[0]]["ret_5"], 6) == 0.2
    assert round(out[DAYS[0]]["dd_5"], 6) == -0.1  # worst later close is 90
    assert "ret_5" not in out[DAYS[1]]  # not enough future sessions


def test_drawdown_up_only_has_no_drawdown():
    closes = {DAYS[i]: 100 + i for i in range(10)}
    out = backtest.forward_outcomes(closes)
    assert out[DAYS[0]]["dd_5"] == 0.0
    assert backtest.drawdown_episodes(closes) == []


def test_drawdown_episodes():
    path = [100, 95, 89, 85, 92, 101, 99, 95]
    closes = {DAYS[i]: v for i, v in enumerate(path)}
    (episode,) = backtest.drawdown_episodes(closes)
    assert episode["peak"] == DAYS[0] and episode["crossed"] == DAYS[2]
    assert episode["trough"] == DAYS[3] and round(episode["depth"], 2) == -0.15
    assert "open" not in episode


def test_open_episode_is_marked():
    closes = {DAYS[i]: v for i, v in enumerate([100, 80, 85])}
    (episode,) = backtest.drawdown_episodes(closes)
    assert episode["open"] is True


def test_override_restores_constants():
    with backtest.override(CONFIRM_SESSIONS=5):
        assert engine.CONFIRM_SESSIONS == 5
    assert engine.CONFIRM_SESSIONS == 2
    try:
        with backtest.override(CONFIRM_SESSIONS=9):
            raise RuntimeError
    except RuntimeError:
        pass
    assert engine.CONFIRM_SESSIONS == 2
