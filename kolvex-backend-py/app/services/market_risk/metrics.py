"""Metric definitions for the Market Risk Monitor, versioned in code.

Observed metrics come straight from a provider; derived metrics are arithmetic on
observed values from the same trading date and source. Nothing here is estimated.
"""

from dataclasses import dataclass
from datetime import time

MARKET = "US"
# Display rights for Cboe index data are not confirmed (docs/market-risk/technical-review.md §3).
LICENSE_PENDING = "internal_pending_review"


@dataclass(frozen=True)
class MetricDefinition:
    key: str
    name_en: str
    name_zh: str
    unit: str
    category: str
    source: str
    source_symbol: str
    source_url: str
    # Close time (ET) of the value the provider publishes for a trading day.
    close_time: time = time(16, 15)
    lower_bound: float = 0.0
    upper_bound: float = 1_000.0
    frequency: str = "daily"
    is_estimated: bool = False
    license_scope: str = LICENSE_PENDING
    inputs: tuple[str, str] | None = None  # (numerator, denominator) for ratios


CBOE_HISTORY_URL = "https://cdn.cboe.com/api/global/us_indices/daily_prices/{symbol}_History.csv"

OBSERVED = (
    MetricDefinition(
        "vix", "Cboe Volatility Index", "VIX 波动率指数", "index_points",
        "volatility", "cboe", "VIX", CBOE_HISTORY_URL.format(symbol="VIX"),
        lower_bound=5.0, upper_bound=150.0,
    ),
    MetricDefinition(
        "vvix", "Cboe VIX of VIX Index", "VVIX 波动率的波动率", "index_points",
        "volatility_of_volatility", "cboe", "VVIX", CBOE_HISTORY_URL.format(symbol="VVIX"),
        lower_bound=40.0, upper_bound=400.0,
    ),
    MetricDefinition(
        "vix9d", "Cboe S&P 500 9-Day Volatility Index", "VIX9D 九日波动率指数", "index_points",
        "term_structure", "cboe", "VIX9D", CBOE_HISTORY_URL.format(symbol="VIX9D"),
        lower_bound=3.0, upper_bound=250.0,
    ),
    MetricDefinition(
        "vix3m", "Cboe S&P 500 3-Month Volatility Index", "VIX3M 三个月波动率指数",
        "index_points", "term_structure", "cboe", "VIX3M", CBOE_HISTORY_URL.format(symbol="VIX3M"),
        lower_bound=5.0, upper_bound=120.0,
    ),
)  # fmt: skip

DERIVED = (
    MetricDefinition(
        "vix9d_vix_ratio", "VIX9D / VIX", "VIX9D / VIX 比值", "ratio", "term_structure",
        "derived", "VIX9D/VIX", "", lower_bound=0.2, upper_bound=5.0, inputs=("vix9d", "vix"),
    ),
    MetricDefinition(
        "vix_vix3m_ratio", "VIX / VIX3M", "VIX / VIX3M 比值", "ratio", "term_structure",
        "derived", "VIX/VIX3M", "", lower_bound=0.2, upper_bound=5.0, inputs=("vix", "vix3m"),
    ),
)  # fmt: skip

METRICS = {metric.key: metric for metric in OBSERVED + DERIVED}

# FRED republishes some Cboe series; used only to cross-check the primary source.
FRED_CROSS_CHECK = {"vix": "VIXCLS", "vix3m": "VXVCLS"}
