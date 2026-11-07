"""The fixed watchlist scanned by the options-activity report.

Kept small enough to fit Alpaca's free-tier rate limit (~200 requests/minute)
three times a day. ETFs and single stocks are filtered separately in the UI.
"""

ETFS = ("SPY", "QQQ", "IWM", "DIA", "SMH", "SOXL", "TQQQ", "XLF", "XLE", "TLT", "GLD", "SLV", "ARKK", "HYG", "FXI")

STOCKS = (
    "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "AMD", "AVGO", "MU",
    "PLTR", "COIN", "NFLX", "ORCL", "MSTR", "SMCI", "INTC", "BA", "JPM", "UNH",
    "HOOD", "SOFI", "MARA", "BABA", "CRM",
)

UNIVERSE = ETFS + STOCKS
ETF_SET = frozenset(ETFS)

# Scan window. Near-dated, near-the-money contracts carry almost all premium,
# and narrowing here is what keeps a run within the request budget.
MAX_DAYS_TO_EXPIRATION = 45
STRIKE_BAND = 0.15


def is_etf(symbol: str) -> bool:
    return symbol in ETF_SET
