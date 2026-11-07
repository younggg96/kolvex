"""Kronos inference: turn recent OHLCV bars into a probabilistic forecast band.

KronosPredictor.predict averages its sample paths internally, which hides the
spread. To get quantiles we pass N copies of the same series to predict_batch
with sample_count=1, so each copy is one independent sampled path.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from pandas.tseries.holiday import (
    AbstractHolidayCalendar,
    GoodFriday,
    Holiday,
    USLaborDay,
    USMartinLutherKingJr,
    USMemorialDay,
    USPresidentsDay,
    USThanksgivingDay,
    nearest_workday,
)
from pandas.tseries.offsets import CustomBusinessDay

logger = logging.getLogger(__name__)

MODEL_ID = os.getenv("KRONOS_MODEL", "NeoQuasar/Kronos-small")
TOKENIZER_ID = os.getenv("KRONOS_TOKENIZER", "NeoQuasar/Kronos-Tokenizer-base")
# Pinned to the revisions upstream's regression test checks (tests/test_kronos_regression.py).
MODEL_REVISION = os.getenv("KRONOS_MODEL_REVISION", "901c26c1332695a2a8f243eb2f37243a37bea320")
TOKENIZER_REVISION = os.getenv("KRONOS_TOKENIZER_REVISION", "0e0117387f39004a9016484a186a908917e22426")
DEVICE = os.getenv("KRONOS_DEVICE", "cpu")
# Kronos-small/base have a 512-token context; leave headroom like the README example.
MAX_CONTEXT = 512
LOOKBACK = min(int(os.getenv("KRONOS_LOOKBACK", "400")), MAX_CONTEXT)
MIN_BARS = 64

SUPPORTED_INTERVALS = ("1d", "1wk")
MARKET_TZ = "America/New_York"



class NYSEHolidayCalendar(AbstractHolidayCalendar):
    """Full-day NYSE closures (ignores one-off closures and early closes)."""

    rules = [
        Holiday("NewYearsDay", month=1, day=1, observance=nearest_workday),
        USMartinLutherKingJr,
        USPresidentsDay,
        GoodFriday,
        USMemorialDay,
        Holiday("Juneteenth", month=6, day=19, start_date="2022-01-01", observance=nearest_workday),
        Holiday("IndependenceDay", month=7, day=4, observance=nearest_workday),
        USLaborDay,
        USThanksgivingDay,
        Holiday("Christmas", month=12, day=25, observance=nearest_workday),
    ]


_TRADING_DAY = CustomBusinessDay(calendar=NYSEHolidayCalendar())

_predictor = None
_load_lock = threading.Lock()
# Torch inference on CPU already uses all cores; run one forecast at a time.
_infer_lock = threading.Lock()


class ForecastInputError(ValueError):
    pass


def get_predictor():
    global _predictor
    if _predictor is None:
        with _load_lock:
            if _predictor is None:
                from .kronos import Kronos, KronosPredictor, KronosTokenizer

                started = time.monotonic()
                tokenizer = KronosTokenizer.from_pretrained(TOKENIZER_ID, revision=TOKENIZER_REVISION)
                model = Kronos.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
                tokenizer.eval()
                model.eval()
                _predictor = KronosPredictor(model, tokenizer, device=DEVICE, max_context=MAX_CONTEXT)
                logger.info("Loaded %s on %s in %.1fs", MODEL_ID, DEVICE, time.monotonic() - started)
    return _predictor


def is_loaded() -> bool:
    return _predictor is not None


def _bars_frame(bars: List[Dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(bars)
    missing = {"date", "open", "high", "low", "close"} - set(df.columns)
    if missing:
        raise ForecastInputError(f"bars missing fields: {sorted(missing)}")
    if "volume" not in df.columns:
        df["volume"] = 0.0
    df = df.dropna(subset=["open", "high", "low", "close"]).copy()
    df["volume"] = df["volume"].fillna(0).astype(float)
    ts = pd.to_datetime(df["date"], utc=True).dt.tz_convert(MARKET_TZ).dt.tz_localize(None)
    df["timestamps"] = ts.dt.normalize()
    df = df.sort_values("timestamps").drop_duplicates("timestamps", keep="last")
    return df.tail(LOOKBACK).reset_index(drop=True)


def future_timestamps(last: pd.Timestamp, interval: str, horizon: int) -> pd.Series:
    if interval == "1d":
        dates = pd.date_range(last + _TRADING_DAY, periods=horizon, freq=_TRADING_DAY)
    elif interval == "1wk":
        dates = pd.date_range(last + pd.Timedelta(weeks=1), periods=horizon, freq="7D")
    else:
        raise ForecastInputError(f"interval must be one of {SUPPORTED_INTERVALS}")
    return pd.Series(dates)


def forecast(
    bars: List[Dict[str, Any]],
    interval: str = "1d",
    horizon: int = 20,
    samples: int = 16,
    temperature: float = 1.0,
    top_p: float = 0.9,
    seed: Optional[int] = None,
) -> Dict[str, Any]:
    if interval not in SUPPORTED_INTERVALS:
        raise ForecastInputError(f"interval must be one of {SUPPORTED_INTERVALS}")
    df = _bars_frame(bars)
    if len(df) < MIN_BARS:
        raise ForecastInputError(f"need at least {MIN_BARS} bars, got {len(df)}")

    x_df = df[["open", "high", "low", "close", "volume"]].astype(float)
    # yfinance has no turnover column; approximate it the same way Kronos does.
    x_df["amount"] = x_df["volume"] * x_df[["open", "high", "low", "close"]].mean(axis=1)
    x_ts = df["timestamps"]
    y_ts = future_timestamps(x_ts.iloc[-1], interval, horizon)

    predictor = get_predictor()
    started = time.monotonic()
    with _infer_lock:
        if seed is not None:
            import torch

            torch.manual_seed(seed)
        paths = predictor.predict_batch(
            df_list=[x_df] * samples,
            x_timestamp_list=[x_ts] * samples,
            y_timestamp_list=[y_ts] * samples,
            pred_len=horizon,
            T=temperature,
            top_p=top_p,
            sample_count=1,
            verbose=False,
        )
    elapsed = time.monotonic() - started

    closes = np.stack([p["close"].to_numpy() for p in paths])  # (samples, horizon)
    p10, p50, p90 = np.percentile(closes, [10, 50, 90], axis=0)
    median = {col: np.median(np.stack([p[col].to_numpy() for p in paths]), axis=0) for col in ("open", "high", "low", "volume")}
    last_close = float(x_df["close"].iloc[-1])

    points = []
    for i, ts in enumerate(y_ts):
        points.append({
            "date": ts.strftime("%Y-%m-%d"),
            "open": round(float(median["open"][i]), 4),
            "high": round(float(max(median["high"][i], p50[i])), 4),
            "low": round(float(min(median["low"][i], p50[i])), 4),
            "close": round(float(p50[i]), 4),
            "close_p10": round(float(p10[i]), 4),
            "close_p90": round(float(p90[i]), 4),
            "volume": max(0, int(median["volume"][i])),
        })

    end_closes = closes[:, -1]
    return {
        "model": MODEL_ID,
        "interval": interval,
        "horizon": horizon,
        "samples": samples,
        "lookback": len(df),
        "context_end": x_ts.iloc[-1].strftime("%Y-%m-%d"),
        "last_close": round(last_close, 4),
        "points": points,
        "summary": {
            "median_return": round(float(np.median(end_closes) / last_close - 1), 4),
            "p10_return": round(float(np.percentile(end_closes, 10) / last_close - 1), 4),
            "p90_return": round(float(np.percentile(end_closes, 90) / last_close - 1), 4),
            "prob_up": round(float(np.mean(end_closes > last_close)), 4),
        },
        "elapsed_seconds": round(elapsed, 2),
    }
