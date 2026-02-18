"""
Options Flow Service
Detects unusual options activity by analyzing volume/OI ratio,
premium size, and volume spikes via yfinance data.
"""

import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import yfinance as yf

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

# Default thresholds for unusual activity detection
DEFAULT_VOL_OI_RATIO = 2.0
DEFAULT_MIN_VOLUME = 500
DEFAULT_MIN_PREMIUM = 50_000  # $50K minimum premium
DEFAULT_MIN_OI = 10

# Popular stocks to scan when no user-specific list is provided
DEFAULT_SCAN_SYMBOLS = [
    "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META",
    "AMD", "SPY", "QQQ", "IWM", "NFLX", "BABA", "PLTR", "SOFI",
    "COIN", "MARA", "RIOT", "ARM", "SMCI", "MU", "INTC",
    "BA", "DIS", "NIO", "RIVN", "LCID", "XOM", "JPM", "BAC",
]


def _safe_float(value, default: float = 0.0) -> float:
    """Convert a value to float, handling NaN and None."""
    if value is None:
        return default
    try:
        f = float(value)
        return default if math.isnan(f) or math.isinf(f) else f
    except (ValueError, TypeError):
        return default


def _safe_int(value, default: int = 0) -> int:
    """Convert a value to int, handling NaN and None."""
    if value is None:
        return default
    try:
        f = float(value)
        return default if math.isnan(f) or math.isinf(f) else int(f)
    except (ValueError, TypeError):
        return default


class OptionsFlowService:
    """Service for scanning and detecting unusual options activity."""

    def __init__(
        self,
        vol_oi_ratio: float = DEFAULT_VOL_OI_RATIO,
        min_volume: int = DEFAULT_MIN_VOLUME,
        min_premium: float = DEFAULT_MIN_PREMIUM,
        min_oi: int = DEFAULT_MIN_OI,
    ):
        self.vol_oi_ratio_threshold = vol_oi_ratio
        self.min_volume = min_volume
        self.min_premium = min_premium
        self.min_oi = min_oi

    # ------------------------------------------------------------------
    # Core scanning logic
    # ------------------------------------------------------------------

    def scan_symbol(
        self,
        symbol: str,
        max_expirations: int = 4,
    ) -> List[Dict[str, Any]]:
        """
        Scan a single symbol for unusual options activity.

        Returns a list of unusual option contracts with enriched metadata.
        """
        ticker = yf.Ticker(symbol.upper())
        results: List[Dict[str, Any]] = []

        try:
            expirations = ticker.options
        except Exception as e:
            logger.warning(f"Failed to get options expirations for {symbol}: {e}")
            return results

        if not expirations:
            return results

        # Get underlying stock price for context
        try:
            info = ticker.info
            stock_price = info.get("currentPrice") or info.get("regularMarketPrice") or 0
            company_name = info.get("shortName") or info.get("longName") or symbol
        except Exception:
            stock_price = 0
            company_name = symbol

        # Scan the nearest expirations
        for exp in expirations[:max_expirations]:
            try:
                chain = ticker.option_chain(exp)
            except Exception as e:
                logger.warning(f"Failed to get options chain for {symbol} exp={exp}: {e}")
                continue

            for option_type, df in [("call", chain.calls), ("put", chain.puts)]:
                if df is None or df.empty:
                    continue

                for _, row in df.iterrows():
                    volume = _safe_int(row.get("volume"))
                    open_interest = _safe_int(row.get("openInterest"))
                    last_price = _safe_float(row.get("lastPrice"))
                    strike = _safe_float(row.get("strike"))
                    implied_vol = _safe_float(row.get("impliedVolatility"))
                    bid = _safe_float(row.get("bid"))
                    ask = _safe_float(row.get("ask"))
                    contract_symbol = row.get("contractSymbol") or ""
                    in_the_money = bool(row.get("inTheMoney", False))

                    # Skip low-activity contracts
                    if volume < self.min_volume:
                        continue

                    # Calculate metrics
                    vol_oi_ratio = (
                        round(volume / open_interest, 2)
                        if open_interest >= self.min_oi
                        else 0
                    )
                    premium = round(volume * last_price * 100, 2)

                    # Determine signal type(s)
                    signals = self._classify_signals(
                        volume, open_interest, vol_oi_ratio, premium
                    )

                    if not signals:
                        continue

                    signal_strength = self._calculate_strength(
                        vol_oi_ratio, premium, volume
                    )

                    results.append(
                        {
                            "symbol": symbol.upper(),
                            "company_name": company_name,
                            "contract_symbol": contract_symbol,
                            "option_type": option_type,
                            "strike": strike,
                            "expiration": exp,
                            "volume": volume,
                            "open_interest": open_interest,
                            "vol_oi_ratio": vol_oi_ratio,
                            "implied_volatility": round(implied_vol, 4),
                            "last_price": last_price,
                            "bid": bid,
                            "ask": ask,
                            "premium": premium,
                            "stock_price": stock_price,
                            "in_the_money": in_the_money,
                            "signal_types": signals,
                            "signal_strength": signal_strength,
                            "detected_at": datetime.now(timezone.utc).isoformat(),
                        }
                    )

        # Sort by signal strength descending, then by premium
        results.sort(key=lambda x: (-x["signal_strength"], -x["premium"]))
        return results

    def scan_multiple(
        self,
        symbols: Optional[List[str]] = None,
        max_expirations: int = 4,
    ) -> List[Dict[str, Any]]:
        """Scan multiple symbols for unusual activity."""
        symbols = symbols or DEFAULT_SCAN_SYMBOLS
        all_results: List[Dict[str, Any]] = []

        for symbol in symbols:
            try:
                hits = self.scan_symbol(symbol, max_expirations=max_expirations)
                all_results.extend(hits)
            except Exception as e:
                logger.error(f"Error scanning {symbol}: {e}")

        all_results.sort(key=lambda x: (-x["signal_strength"], -x["premium"]))
        return all_results

    # ------------------------------------------------------------------
    # Persistence (Supabase)
    # ------------------------------------------------------------------

    def save_results(self, results: List[Dict[str, Any]]) -> int:
        """Save unusual activity results to Supabase."""
        if not results:
            return 0

        supabase = get_supabase_service()
        saved = 0

        for item in results:
            row = {
                "symbol": item["symbol"],
                "company_name": item.get("company_name"),
                "contract_symbol": item["contract_symbol"],
                "option_type": item["option_type"],
                "strike": item["strike"],
                "expiration": item["expiration"],
                "volume": item["volume"],
                "open_interest": item["open_interest"],
                "vol_oi_ratio": item["vol_oi_ratio"],
                "implied_volatility": item["implied_volatility"],
                "last_price": item["last_price"],
                "bid": item["bid"],
                "ask": item["ask"],
                "premium": item["premium"],
                "stock_price": item["stock_price"],
                "in_the_money": item["in_the_money"],
                "signal_types": item["signal_types"],
                "signal_strength": item["signal_strength"],
                "detected_at": item["detected_at"],
            }
            try:
                supabase.table("options_unusual_activity").upsert(
                    row, on_conflict="contract_symbol,detected_at"
                ).execute()
                saved += 1
            except Exception as e:
                logger.error(f"Failed to save unusual activity for {item['contract_symbol']}: {e}")

        logger.info(f"Saved {saved}/{len(results)} unusual options records")
        return saved

    def get_recent_activity(
        self,
        symbol: Optional[str] = None,
        option_type: Optional[str] = None,
        min_premium: Optional[float] = None,
        min_vol_oi: Optional[float] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Retrieve recent unusual activity from Supabase."""
        supabase = get_supabase_service()
        query = (
            supabase.table("options_unusual_activity")
            .select("*", count="exact")
            .order("detected_at", desc=True)
        )

        if symbol:
            query = query.eq("symbol", symbol.upper())
        if option_type:
            query = query.eq("option_type", option_type.lower())
        if min_premium:
            query = query.gte("premium", min_premium)
        if min_vol_oi:
            query = query.gte("vol_oi_ratio", min_vol_oi)

        query = query.range(offset, offset + limit - 1)
        result = query.execute()

        return {
            "data": result.data or [],
            "total": result.count or 0,
            "limit": limit,
            "offset": offset,
        }

    def get_activity_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get summary statistics for recent unusual activity."""
        supabase = get_supabase_service()

        from datetime import timedelta

        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

        result = (
            supabase.table("options_unusual_activity")
            .select("*")
            .gte("detected_at", since)
            .order("detected_at", desc=True)
            .execute()
        )

        data = result.data or []
        if not data:
            return {
                "period_hours": hours,
                "total_signals": 0,
                "total_premium": 0,
                "by_type": {"call": 0, "put": 0},
                "top_symbols": [],
                "top_contracts": [],
                "avg_vol_oi_ratio": 0,
                "call_put_ratio": 0,
            }

        call_count = sum(1 for d in data if d["option_type"] == "call")
        put_count = sum(1 for d in data if d["option_type"] == "put")
        total_premium = sum(d.get("premium", 0) for d in data)

        # Top symbols by signal count
        symbol_counts: Dict[str, int] = {}
        symbol_premium: Dict[str, float] = {}
        for d in data:
            sym = d["symbol"]
            symbol_counts[sym] = symbol_counts.get(sym, 0) + 1
            symbol_premium[sym] = symbol_premium.get(sym, 0) + d.get("premium", 0)

        top_symbols = sorted(
            [{"symbol": k, "count": v, "premium": symbol_premium[k]} for k, v in symbol_counts.items()],
            key=lambda x: -x["count"],
        )[:10]

        # Top contracts by premium
        top_contracts = sorted(data, key=lambda x: -x.get("premium", 0))[:5]

        avg_vol_oi = (
            round(sum(d.get("vol_oi_ratio", 0) for d in data) / len(data), 2)
            if data
            else 0
        )

        return {
            "period_hours": hours,
            "total_signals": len(data),
            "total_premium": round(total_premium, 2),
            "by_type": {"call": call_count, "put": put_count},
            "top_symbols": top_symbols,
            "top_contracts": [
                {
                    "contract_symbol": c.get("contract_symbol"),
                    "symbol": c.get("symbol"),
                    "option_type": c.get("option_type"),
                    "strike": c.get("strike"),
                    "expiration": c.get("expiration"),
                    "premium": c.get("premium"),
                    "vol_oi_ratio": c.get("vol_oi_ratio"),
                }
                for c in top_contracts
            ],
            "avg_vol_oi_ratio": avg_vol_oi,
            "call_put_ratio": round(call_count / put_count, 2) if put_count else call_count,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _classify_signals(
        self,
        volume: int,
        open_interest: int,
        vol_oi_ratio: float,
        premium: float,
    ) -> List[str]:
        """Determine which types of unusual signals this contract exhibits."""
        signals = []

        if vol_oi_ratio >= self.vol_oi_ratio_threshold and open_interest >= self.min_oi:
            signals.append("high_vol_oi")

        if premium >= self.min_premium:
            signals.append("large_premium")

        if volume >= 5000:
            signals.append("high_volume")

        if vol_oi_ratio >= 10 and open_interest >= self.min_oi:
            signals.append("extreme_vol_oi")

        if premium >= 500_000:
            signals.append("whale_trade")

        return signals

    def _calculate_strength(
        self,
        vol_oi_ratio: float,
        premium: float,
        volume: int,
    ) -> int:
        """
        Calculate signal strength score from 1-5.
        Higher = more unusual activity.
        """
        score = 0

        # Vol/OI contribution (0-2 points)
        if vol_oi_ratio >= 10:
            score += 2
        elif vol_oi_ratio >= 5:
            score += 1.5
        elif vol_oi_ratio >= self.vol_oi_ratio_threshold:
            score += 1

        # Premium contribution (0-2 points)
        if premium >= 1_000_000:
            score += 2
        elif premium >= 500_000:
            score += 1.5
        elif premium >= 100_000:
            score += 1
        elif premium >= self.min_premium:
            score += 0.5

        # Volume contribution (0-1 point)
        if volume >= 10_000:
            score += 1
        elif volume >= 5_000:
            score += 0.5

        return min(5, max(1, round(score)))


# Singleton
_options_flow_service: Optional[OptionsFlowService] = None


def get_options_flow_service() -> OptionsFlowService:
    """Get OptionsFlowService singleton."""
    global _options_flow_service
    if _options_flow_service is None:
        _options_flow_service = OptionsFlowService()
    return _options_flow_service
