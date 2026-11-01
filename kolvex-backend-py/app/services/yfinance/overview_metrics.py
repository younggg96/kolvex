"""Supplementary stock facts. Ratios use matching statements and explicit periods."""
import logging
import math
import time
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import datetime, timezone
from threading import Lock

_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="overview-facts")
_CACHE = {}
_LOCK = Lock()


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def ratio(numerator, denominator, positive=True):
    a, b = number(numerator), number(denominator)
    if a is None or b is None or b == 0 or (positive and b < 0):
        return None
    return number(a / b)


def ordered(rows):
    return sorted((row for row in rows if row.get("period")), key=lambda row: row["period"], reverse=True)


def cagr(rows, key):
    rows = ordered(rows)
    if not rows:
        return None
    latest = rows[0]
    end = datetime.fromisoformat(latest["period"])
    for previous in rows[1:]:
        years = (end - datetime.fromisoformat(previous["period"])).days / 365.25
        if abs(years - 3) > .17:
            continue
        a, b = number(latest.get(key)), number(previous.get(key))
        if a is not None and b is not None and a > 0 and b > 0:
            return number((a / b) ** (1 / years) - 1)
    return None


def price_metrics(stock, benchmark, year):
    """Aligned adjusted daily closes; previous-year close is required for YTD."""
    def prices(rows):
        return {row["date"][:10]: value for row in rows
                if (value := number(row.get("close"))) is not None and value > 0}
    stock, benchmark = prices(stock), prices(benchmark)
    result = {"max_drawdown_5y": None, "history_start": None, "history_end": None,
              "ytd_return": None, "benchmark_ytd_return": None, "ytd_vs_sp500": None,
              "ytd_start": None, "ytd_end": None}
    if stock:
        dates = sorted(stock)
        peak, drawdown = 0, 0
        for day in dates:
            peak = max(peak, stock[day])
            drawdown = max(drawdown, 1 - stock[day] / peak)
        if len(dates) > 1:
            result.update(max_drawdown_5y=drawdown, history_start=dates[0], history_end=dates[-1])
    common = sorted(stock.keys() & benchmark.keys())
    baseline = [day for day in common if day < f"{year}-01-01"]
    current = [day for day in common if day.startswith(str(year))]
    if baseline and current:
        start, end = baseline[-1], current[-1]
        # Reject stale baselines and mismatched/newly listed histories.
        if (datetime.fromisoformat(f"{year}-01-01") - datetime.fromisoformat(start)).days <= 7:
            a, b = stock[end] / stock[start] - 1, benchmark[end] / benchmark[start] - 1
            result.update(ytd_return=a, benchmark_ytd_return=b, ytd_vs_sp500=a-b,
                          ytd_start=start, ytd_end=end)
    return result


def build_metrics(symbol, sources, now):
    info = sources.get("info") or {}
    income = ordered(sources.get("income") or [])
    balance = ordered(sources.get("balance") or [])
    cash = ordered(sources.get("cash") or [])
    annual_balance = ordered(sources.get("annual_balance") or [])
    i, b, cf = (rows[0] if rows else {} for rows in (income, balance, cash))
    # Annual return ratios require a balance sheet for the same fiscal ending date.
    ab = next((row for row in annual_balance if row["period"] == i.get("period")), {})
    same_cash = next((row for row in cash if row["period"] == i.get("period")), {})
    n = lambda key: number(info.get(key))
    same_currency = bool(info.get("currency") and info.get("currency") == info.get("financialCurrency"))
    result = {
        "symbol": symbol.upper(), "analyzed_at": now.isoformat(),
        "financial_currency": info.get("financialCurrency"), "currency": info.get("currency"),
        "income_period": i.get("period"), "balance_period": b.get("period"), "cash_period": cf.get("period"),
        "shares_outstanding": n("sharesOutstanding"), "insider_ownership": n("heldPercentInsiders"),
        "short_float": n("shortPercentOfFloat"), "target_mean_price": n("targetMeanPrice"),
        "target_currency": info.get("currency"), "current_price": n("currentPrice"),
        "analyst_consensus": info.get("recommendationKey"), "analyst_count": n("numberOfAnalystOpinions"),
        "earnings_date": n("earningsTimestamp"), "beta_5y": n("beta"),
        "dividend_yield": ratio(info.get("dividendRate"), info.get("currentPrice")),
        "payout_ratio": n("payoutRatio"),
        "total_assets": number(b.get("Total Assets")), "long_term_debt": number(b.get("Long Term Debt")),
        "total_liabilities": number(b.get("Total Liabilities Net Minority Interest")),
        "shareholder_equity": number(b.get("Stockholders Equity")),
        "operating_income": number(i.get("Operating Income")),
        "capital_expenditure": abs(cf["Capital Expenditure"]) if number(cf.get("Capital Expenditure")) is not None else None,
        "pretax_margin": ratio(i.get("Pretax Income"), i.get("Total Revenue")),
        "fcf_margin_annual": ratio(cf.get("Free Cash Flow"), i.get("Total Revenue")) if cf.get("period") == i.get("period") else None,
        "cash_conversion_annual": ratio(same_cash.get("Operating Cash Flow"), i.get("Net Income")),
        "revenue_cagr_3y": cagr(income, "Total Revenue"), "eps_cagr_3y": cagr(income, "Diluted EPS"),
        "roce_annual": None, "roic_annual": None,
        "price_to_fcf": ratio(info.get("marketCap"), info.get("freeCashflow")) if same_currency else None,
        "buyback_yield_annual": None,
        "forecast_earnings_growth": number((sources.get("forecast") or {}).get("growth")),
    }
    assets, current_liabilities = number(ab.get("Total Assets")), number(ab.get("Current Liabilities"))
    if assets is not None and current_liabilities is not None:
        result["roce_annual"] = ratio(i.get("EBIT"), assets-current_liabilities)
    # ROIC = NOPAT / average (debt + equity - cash); require consecutive annual balances.
    previous = next((row for row in annual_balance if ab and 300 <= (
        datetime.fromisoformat(ab["period"]) - datetime.fromisoformat(row["period"])).days <= 430), {})
    def invested(row):
        values = [number(row.get(key)) for key in ("Total Debt", "Stockholders Equity", "Cash And Cash Equivalents")]
        return values[0] + values[1] - values[2] if all(value is not None for value in values) else None
    capital, prior = invested(ab), invested(previous)
    tax = ratio(i.get("Tax Provision"), i.get("Pretax Income"))
    ebit = number(i.get("EBIT"))
    if capital is not None and prior is not None and tax is not None and 0 <= tax <= 1 and ebit is not None:
        result["roic_annual"] = ratio(ebit*(1-tax), (capital+prior)/2)
    repurchase, issuance = number(cf.get("Repurchase Of Capital Stock")), number(cf.get("Issuance Of Capital Stock"))
    if same_currency and repurchase is not None and issuance is not None:
        result["buyback_yield_annual"] = ratio(abs(repurchase)-abs(issuance), info.get("marketCap"))
    result.update(price_metrics(sources.get("history") or [], sources.get("benchmark") or [], now.year))
    return result


def get_overview_metrics(service, symbol):
    symbol = symbol.upper()
    with _LOCK:
        cached = _CACHE.get(symbol)
        if cached and cached[0] > time.monotonic():
            return cached[1]
    now = datetime.now(timezone.utc)
    def history(ticker_symbol):
        frame = service.get_ticker(ticker_symbol).history(period="5y", interval="1d", auto_adjust=True, timeout=8)
        return [{"date": day.isoformat(), "close": number(row.get("Close"))} for day, row in frame.iterrows()]
    def forecast():
        frame = service.get_ticker(symbol).earnings_estimate
        return {"growth": number(frame.loc["+1y", "growth"])} if "+1y" in frame.index and "growth" in frame else {}
    tasks = {
        "info": lambda: service.get_ticker(symbol).info,
        "income": lambda: service.get_income_statement(symbol),
        "balance": lambda: service.get_balance_sheet(symbol, quarterly=True),
        "annual_balance": lambda: service.get_balance_sheet(symbol),
        "cash": lambda: service.get_cash_flow(symbol),
        "forecast": forecast,
        "history": lambda: history(symbol), "benchmark": lambda: history("^GSPC"),
    }
    futures = {key: _EXECUTOR.submit(load) for key, load in tasks.items()}
    done, _ = wait(futures.values(), timeout=16)
    sources, unavailable = {}, []
    for key, future in futures.items():
        try:
            if future not in done:
                future.cancel()
                raise TimeoutError(key)
            sources[key] = future.result()
        except Exception as error:
            unavailable.append(key)
            logging.getLogger(__name__).warning("Overview %s failed for %s: %s", key, symbol, type(error).__name__)
    if len(unavailable) == len(tasks):
        raise RuntimeError("Overview sources unavailable")
    if not sources.get("balance"):
        sources["balance"] = sources.get("annual_balance") or []
    result = build_metrics(symbol, sources, now)
    result["unavailable_sources"] = unavailable
    with _LOCK:
        if len(_CACHE) >= 128:
            _CACHE.pop(next(iter(_CACHE)))
        _CACHE[symbol] = (time.monotonic() + (30 if unavailable else 300), result)
    return result
