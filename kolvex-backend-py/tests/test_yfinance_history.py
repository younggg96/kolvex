import json
import math
import unittest

import pandas as pd

from app.services.yfinance.client import _history_point


class HistoryPointTests(unittest.TestCase):
    def test_incomplete_session_bar_omits_nan_prices(self):
        row = pd.Series({
            "Date": pd.Timestamp("2026-10-08", tz="America/New_York"),
            "Open": float("nan"),
            "High": float("inf"),
            "Low": float("nan"),
            "Close": float("nan"),
            "Volume": 34_459_898,
            "Dividends": float("nan"),
            "Stock Splits": 0,
        })

        bar = _history_point(row)

        self.assertTrue(all(bar[field] is None for field in ("open", "high", "low", "close")))
        self.assertEqual(bar["volume"], 34_459_898)
        self.assertEqual(bar["dividends"], 0.0)
        self.assertEqual(bar["stock_splits"], 0.0)
        json.dumps(bar)
        self.assertFalse(any(isinstance(value, float) and not math.isfinite(value) for value in bar.values()))

    def test_complete_bar_keeps_rounded_ohlc(self):
        row = pd.Series({
            "Date": pd.Timestamp("2026-10-07", tz="America/New_York"),
            "Open": 310.244,
            "High": 316.2,
            "Low": 307.891,
            "Close": 315.956,
            "Volume": 48_124_500,
            "Dividends": 0.25,
            "Stock Splits": 0,
        })

        bar = _history_point(row)

        self.assertEqual(bar["open"], 310.24)
        self.assertEqual(bar["high"], 316.2)
        self.assertEqual(bar["low"], 307.89)
        self.assertEqual(bar["close"], 315.96)
        self.assertEqual(bar["volume"], 48_124_500)
        self.assertEqual(bar["dividends"], 0.25)


if __name__ == "__main__":
    unittest.main()
