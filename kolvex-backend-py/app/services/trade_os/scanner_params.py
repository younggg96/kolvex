"""
Editable scanner logic (Trade OS 扫描逻辑).

Every scan runs the same four filter layers and pullback state machine; a *logic* is the set
of numbers it uses. The built-in default is Swing V3.1 exactly as `setup_detection` and
`scanner` define it. Custom logics change only these numbers — never the code path — so a
custom scan is as auditable and testable as the default one.

Values are stored as plain JSON numbers. Percentages are fractions (0.03 = 3%).
"""

from decimal import Decimal
from typing import Any, Dict, Optional, Tuple

from app.services.trade_os.setup_detection import DEFAULT_PARAMS

# key: (default, minimum, maximum, integer?)
PARAM_SPEC: Dict[str, Tuple[float, float, float, bool]] = {
    # Layer 1 — liquidity
    "min_price": (10, 1, 1000, False),
    "min_avg_dollar_volume": (20_000_000, 1_000_000, 10_000_000_000, False),
    # Layer 3 — relative strength vs SPY over 20 sessions (fraction)
    "rs20_min": (0, -0.5, 0.5, False),
    # Setup — pivot and pullback
    "pivot_lookback": (int(DEFAULT_PARAMS["pivot_lookback"]), 5, 120, True),
    "pullback_min_days": (int(DEFAULT_PARAMS["pullback_min_days"]), 1, 60, True),
    "pullback_max_days": (int(DEFAULT_PARAMS["pullback_max_days"]), 1, 60, True),
    "pullback_min_depth": (float(DEFAULT_PARAMS["pullback_min_depth"]), 0, 0.5, False),
    "pullback_max_depth": (float(DEFAULT_PARAMS["pullback_max_depth"]), 0.005, 0.6, False),
    "ema_touch_atr": (float(DEFAULT_PARAMS["ema_touch_atr"]), 0, 5, False),
    # Plan — stop, target and entry window
    "stop_atr_buffer": (float(DEFAULT_PARAMS["stop_atr_buffer"]), 0, 5, False),
    "target_r_multiple": (float(DEFAULT_PARAMS["target_r_multiple"]), 0.5, 20, False),
    "min_stop_distance": (float(DEFAULT_PARAMS["min_stop_distance"]), 0, 0.5, False),
    "max_stop_distance": (float(DEFAULT_PARAMS["max_stop_distance"]), 0.005, 0.6, False),
    "entry_window_days": (int(DEFAULT_PARAMS["entry_window_days"]), 1, 20, True),
    "max_gap_r": (float(DEFAULT_PARAMS["max_gap_r"]), 0, 5, False),
    # Layer 4 — events; and the holding-period exit the plan carries
    "earnings_blackout_sessions": (int(DEFAULT_PARAMS["earnings_blackout_sessions"]), 0, 30, True),
    "time_exit_day": (int(DEFAULT_PARAMS["time_exit_day"]), 1, 500, True),
}

# min ≤ max pairs, checked after each value is in range.
_ORDERED_PAIRS = (
    ("pullback_min_days", "pullback_max_days"),
    ("pullback_min_depth", "pullback_max_depth"),
    ("min_stop_distance", "max_stop_distance"),
)


class InvalidScannerParams(ValueError):
    """Raised with the offending field so the API can say which value to fix."""

    def __init__(self, field: str, message: str):
        super().__init__(f"{field}: {message}")
        self.field = field
        self.message = message


def default_params() -> Dict[str, float]:
    """The built-in default logic (Swing V3.1) as JSON-friendly numbers."""
    return {key: spec[0] for key, spec in PARAM_SPEC.items()}


def validate_params(raw: Optional[Dict[str, Any]]) -> Dict[str, float]:
    """
    Fills missing keys from the default, rejects unknown keys, out-of-range values and
    min > max pairs. Never coerces a bad value into range: a typo must not silently become
    a different strategy.
    """
    raw = raw or {}
    unknown = sorted(set(raw) - set(PARAM_SPEC))
    if unknown:
        raise InvalidScannerParams(unknown[0], "unknown parameter")
    clean: Dict[str, float] = {}
    for key, (default, low, high, integer) in PARAM_SPEC.items():
        value = raw.get(key, default)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise InvalidScannerParams(key, "must be a number")
        if value != value or value in (float("inf"), float("-inf")):
            raise InvalidScannerParams(key, "must be a finite number")
        if integer and float(value) != int(value):
            raise InvalidScannerParams(key, "must be a whole number")
        if not low <= value <= high:
            raise InvalidScannerParams(key, f"must be between {low} and {high}")
        clean[key] = int(value) if integer else float(value)
    for low_key, high_key in _ORDERED_PAIRS:
        if clean[low_key] > clean[high_key]:
            raise InvalidScannerParams(low_key, f"must not exceed {high_key}")
    return clean


def detection_params(clean: Dict[str, float]) -> Dict[str, Any]:
    """`setup_detection` parameters (Decimals) for a validated logic."""
    return {
        **DEFAULT_PARAMS,
        "pivot_lookback": int(clean["pivot_lookback"]),
        "pullback_min_days": int(clean["pullback_min_days"]),
        "pullback_max_days": int(clean["pullback_max_days"]),
        "pullback_min_depth": Decimal(str(clean["pullback_min_depth"])),
        "pullback_max_depth": Decimal(str(clean["pullback_max_depth"])),
        "ema_touch_atr": Decimal(str(clean["ema_touch_atr"])),
        "stop_atr_buffer": Decimal(str(clean["stop_atr_buffer"])),
        "target_r_multiple": Decimal(str(clean["target_r_multiple"])),
        "min_stop_distance": Decimal(str(clean["min_stop_distance"])),
        "max_stop_distance": Decimal(str(clean["max_stop_distance"])),
        "entry_window_days": int(clean["entry_window_days"]),
        "max_gap_r": Decimal(str(clean["max_gap_r"])),
        "earnings_blackout_sessions": int(clean["earnings_blackout_sessions"]),
        "time_exit_day": int(clean["time_exit_day"]),
    }


def filter_params(clean: Dict[str, float]) -> Dict[str, Any]:
    """The scanner's own layer thresholds (Decimals) for a validated logic."""
    return {
        "min_price": Decimal(str(clean["min_price"])),
        "min_dollar_volume": Decimal(str(clean["min_avg_dollar_volume"])),
        "rs20_min": Decimal(str(clean["rs20_min"])),
        "earnings_window": int(clean["earnings_blackout_sessions"]),
    }
