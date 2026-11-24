import json
import math
import unittest
from datetime import datetime
from unittest.mock import Mock, patch

import httpx
import pandas as pd

from app.services.yfinance import overnight
from app.services.yfinance.client import YFinanceService, _history_point


class HistoryPointTests(unittest.TestCase):
    def test_incomplete_session_bar_omits_nan_prices(self):
        row = pd.Series(
            {
                "Date": pd.Timestamp("2026-10-08", tz="America/New_York"),
                "Open": float("nan"),
                "High": float("inf"),
                "Low": float("nan"),
                "Close": float("nan"),
                "Volume": 34_459_898,
                "Dividends": float("nan"),
                "Stock Splits": 0,
            }
        )

        bar = _history_point(row)

        self.assertTrue(all(bar[field] is None for field in ("open", "high", "low", "close")))
        self.assertEqual(bar["volume"], 34_459_898)
        self.assertEqual(bar["dividends"], 0.0)
        self.assertEqual(bar["stock_splits"], 0.0)
        json.dumps(bar)
        self.assertFalse(
            any(isinstance(value, float) and not math.isfinite(value) for value in bar.values())
        )

    def test_complete_bar_keeps_rounded_ohlc(self):
        row = pd.Series(
            {
                "Date": pd.Timestamp("2026-10-07", tz="America/New_York"),
                "Open": 310.244,
                "High": 316.2,
                "Low": 307.891,
                "Close": 315.956,
                "Volume": 48_124_500,
                "Dividends": 0.25,
                "Stock Splits": 0,
            }
        )

        bar = _history_point(row)

        self.assertEqual(bar["open"], 310.24)
        self.assertEqual(bar["high"], 316.2)
        self.assertEqual(bar["low"], 307.89)
        self.assertEqual(bar["close"], 315.96)
        self.assertEqual(bar["volume"], 48_124_500)
        self.assertEqual(bar["dividends"], 0.25)


class OvernightHistoryTests(unittest.TestCase):
    def test_one_day_joins_sunday_and_monday_without_losing_friday_close(self):
        ticker = Mock()
        index = pd.DatetimeIndex(
            ["2026-11-20 15:55", "2026-11-20 19:55", "2026-11-23 04:00"],
            tz="America/New_York",
            name="Datetime",
        )
        ticker.history.return_value = pd.DataFrame(
            {"Open": 100, "High": 104, "Low": 99, "Close": [100, 101, 103], "Volume": 10},
            index=index,
        )
        night = [
            {
                "Datetime": pd.Timestamp(at, tz="America/New_York"),
                "Open": 102,
                "High": 103,
                "Low": 101,
                "Close": 102,
                "Volume": 4,
                "Source": "boats",
            }
            for at in ["2026-11-22 20:05", "2026-11-23 00:10"]
        ]
        service = YFinanceService()
        with (
            patch.object(service, "get_ticker", return_value=ticker),
            patch.object(service, "_overnight_bars", return_value=night),
        ):
            result = service.get_intraday("AAPL")

        ticker.history.assert_called_once_with(
            period="5d", interval="5m", prepost=True, auto_adjust=False
        )
        self.assertEqual([bar["close"] for bar in result], [100, 101, 102, 102, 103])
        self.assertEqual(
            [bar["session"] for bar in result], [None, None, "overnight", "overnight", None]
        )
        self.assertEqual(result[2]["source"], "Alpaca / Blue Ocean ATS")
        self.assertEqual(result[3]["date"], "2026-11-23T00:10:00-05:00")

    def test_boats_history_is_opt_in_and_keeps_cash_index_symbols_out(self):
        with patch.dict(
            "os.environ",
            {
                "ALPACA_BOATS_ENABLED": "true",
                "ALPACA_API_KEY_ID": "test",
                "ALPACA_API_SECRET_KEY": "test",
            },
        ):
            with patch.object(overnight.httpx, "Client") as http:
                self.assertEqual(overnight.history("^GSPC", "1d", "5m", None, None), [])
                http.assert_not_called()

    def test_boats_history_preserves_requested_window_and_filters_other_sessions(self):
        now = datetime(2026, 11, 23, 10, tzinfo=overnight.NEW_YORK)
        prices = {"o": 100, "h": 103, "l": 99, "c": 102, "v": 10}
        with (
            patch.object(overnight, "_headers", return_value={"test": "test"}),
            patch.object(overnight, "datetime", wraps=datetime) as clock,
            patch.object(overnight.httpx, "Client") as http,
        ):
            clock.now.return_value = now
            get = http.return_value.__enter__.return_value.get
            get.return_value.json.return_value = {
                "bars": {
                    "AAPL": [
                        {"t": "2026-11-23T00:59:00Z", **prices},
                        {"t": "2026-11-23T06:00:00Z", **prices},
                        {"t": "2026-11-23T09:00:00Z", **prices},
                    ],
                },
            }
            bars = overnight.history("AAPL", "1mo", "5m", "2026-11-22", "2026-11-23T08:00")
        params = get.call_args.kwargs["params"]
        self.assertEqual((params["feed"], params["timeframe"]), ("boats", "5Min"))
        self.assertEqual(params["start"], "2026-11-22T00:00:00-05:00")
        self.assertEqual(params["end"], "2026-11-23T08:00:00-05:00")
        self.assertEqual(
            [bar["Datetime"].isoformat() for bar in bars], ["2026-11-23T01:00:00-05:00"]
        )

    def test_latest_trade_rejects_prior_overnight_sessions(self):
        now = datetime(2026, 11, 23, 1, tzinfo=overnight.NEW_YORK)
        with (
            patch.object(overnight, "_headers", return_value={"test": "test"}),
            patch.object(overnight, "datetime", wraps=datetime) as clock,
            patch.object(overnight.httpx, "get") as get,
        ):
            clock.now.return_value = now
            get.return_value.json.return_value = {"trade": {"p": 102, "t": "2026-11-20T04:55:00Z"}}
            self.assertIsNone(overnight.latest_trade("AAPL"))
            get.return_value.json.return_value = {"trade": {"p": 104, "t": "2026-11-23T05:55:00Z"}}
            self.assertEqual(overnight.latest_trade("AAPL"), (104, int(now.timestamp()) - 300))
            self.assertEqual(get.call_args.kwargs["params"], {"feed": "boats"})

    def test_boats_history_retries_permission_denial_with_delayed_end(self):
        now = datetime(2026, 11, 23, 1, tzinfo=overnight.NEW_YORK)
        requests = []

        def get(url, *, params):
            requests.append(dict(params))
            request = httpx.Request("GET", url)
            if len(requests) == 1:
                return httpx.Response(403, request=request)
            return httpx.Response(
                200,
                request=request,
                json={
                    "bars": {
                        "META": [
                            {
                                "t": "2026-11-23T05:40:00Z",
                                "o": 100,
                                "h": 103,
                                "l": 99,
                                "c": 102,
                                "v": 10,
                            }
                        ]
                    }
                },
            )

        with (
            patch.object(overnight, "_headers", return_value={"test": "test"}),
            patch.object(overnight, "datetime", wraps=datetime) as clock,
            patch.object(overnight.httpx, "Client") as http,
        ):
            clock.now.return_value = now
            http.return_value.__enter__.return_value.get.side_effect = get
            bars = overnight.history("META", "1mo", "5m", None, None)

        self.assertEqual(
            [request["end"] for request in requests],
            ["2026-11-23T01:00:00-05:00", "2026-11-23T00:45:00-05:00"],
        )
        self.assertEqual(bars[0]["Datetime"].isoformat(), "2026-11-23T00:40:00-05:00")
        self.assertEqual(bars[0]["Source"], "boats")


class HistoryRoutePrepostTests(unittest.TestCase):
    def _call(self, **kwargs):
        from app.api.routes import market_data

        service = Mock()
        service.get_history.return_value = []
        with patch.object(market_data, "get_yfinance_service", return_value=service):
            market_data.get_history(
                symbol="nvda",
                period=market_data.HistoryPeriod.ONE_MONTH,
                interval=market_data.HistoryInterval("5m"),
                start=None,
                end=None,
                **kwargs,
            )
        return service.get_history.call_args.kwargs

    def test_extended_hours_forwarded(self):
        self.assertTrue(self._call(prepost=True)["prepost"])

    def test_regular_session_by_default(self):
        self.assertFalse(self._call(prepost=False)["prepost"])

    def test_intraday_defaults_to_prepost(self):
        from app.api.routes import market_data

        service = Mock()
        service.get_intraday.return_value = []
        with patch.object(market_data, "get_yfinance_service", return_value=service):
            market_data.get_intraday(symbol="nvda", interval="5m", prepost=True)
        self.assertTrue(service.get_intraday.call_args.kwargs["prepost"])


if __name__ == "__main__":
    unittest.main()


class CumulativeVolumeTests(unittest.TestCase):
    """Yahoo sometimes puts the day's running volume total on a single intraday bar."""

    def _minutes(self, volumes, start="2026-11-23 09:30"):
        index = pd.date_range(start, periods=len(volumes), freq="1min", tz="America/New_York")
        return pd.DataFrame(
            {
                "Open": 1.0,
                "High": 1.0,
                "Low": 1.0,
                "Close": 1.0,
                "Volume": volumes,
            },
            index=index,
        )

    def test_running_total_bar_becomes_unknown(self):
        from app.services.yfinance.client import _drop_cumulative_volume

        volumes = [1_000_000] * 60
        volumes[40] = 500_000_000  # far above the ~40M traded so far: a running total
        cleaned = _drop_cumulative_volume(self._minutes(volumes))

        self.assertTrue(pd.isna(cleaned["Volume"].iloc[40]))
        self.assertEqual(int(cleaned["Volume"].drop(cleaned.index[40]).sum()), 59_000_000)
        self.assertIsNone(_history_point(cleaned.reset_index().iloc[40])["volume"])

    def test_real_spikes_are_kept(self):
        from app.services.yfinance.client import _drop_cumulative_volume

        # Opening auction (first print of the day) and a closing auction far below the day's total.
        volumes = [120_000_000] + [1_000_000] * 389 + [38_000_000]
        frame = self._minutes(volumes)
        cleaned = _drop_cumulative_volume(frame)

        self.assertIs(cleaned, frame)
        self.assertFalse(cleaned["Volume"].isna().any())

    def test_grouped_bar_with_unknown_volume_is_unknown(self):
        from app.services.yfinance.client import _sum_known

        self.assertTrue(math.isnan(_sum_known(pd.Series([1.0, float("nan"), 2.0]))))
        self.assertEqual(_sum_known(pd.Series([1.0, 2.0])), 3.0)
