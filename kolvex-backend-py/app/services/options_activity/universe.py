"""The core watchlist and size limits of the options-activity scan.

The core list is scanned every run and is the only part whose market totals are
compared with earlier runs. selection.py adds upcoming earnings, movers,
high-volume names and creator-discussed names on top. The total is capped to stay well inside
Alpaca's free-tier rate limit (~200 requests/minute, about 3-5 requests per
symbol) and the 15-minute run lease. ETFs and single stocks are filtered
separately in the UI.
"""

ETFS = ("SPY", "QQQ", "IWM", "DIA", "SMH", "SOXL", "TQQQ", "XLF", "XLE", "TLT", "GLD", "SLV", "ARKK", "HYG", "FXI")

STOCKS = (
    "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AMD", "AVGO", "MU",
    "PLTR", "COIN", "NFLX", "ORCL", "MSTR", "SMCI", "INTC", "BA", "JPM", "UNH",
    "HOOD", "SOFI", "MARA", "BABA", "CRM",
)

UNIVERSE = ETFS + STOCKS
ETF_SET = frozenset(ETFS)

# Dynamic additions per run (beyond the core list).
EARNINGS_LIMIT = 15  # largest companies reporting within EARNINGS_DAYS that have not reported yet
EARNINGS_DAYS = 7
EARNINGS_MIN_MARKET_CAP = 20_000_000_000  # big enough that the options trade actively
MOVERS_LIMIT = 20  # biggest |change %| of the latest session
ACTIVE_LIMIT = 20  # highest volume vs 3-month average
KOL_LIMIT = 25  # most discussed on Reddit, X and YouTube
KOL_WINDOW_DAYS = 3
# Movers/active names need real stock liquidity, or their options barely trade.
MIN_DOLLAR_VOLUME = 200_000_000
# A KOL pick needs this many platforms (Reddit/X/YouTube), or this many distinct
# creators on X or YouTube. Filters cashtag noise such as $ALL, $IT or $DTE.
KOL_MIN_PLATFORMS = 2
KOL_MIN_CREATORS = 2
MANUAL_LIMIT = 20  # symbols an admin can add to one manual run; not capped by MAX_UNIVERSE
MAX_UNIVERSE = 120  # ~500 Alpaca requests, about 3 minutes at 180/min

# Scan window. Near-dated, near-the-money contracts carry almost all premium,
# and narrowing here is what keeps a run within the request budget.
MAX_DAYS_TO_EXPIRATION = 45
STRIKE_BAND = 0.15


def is_etf(symbol: str) -> bool:
    return symbol in ETF_SET
