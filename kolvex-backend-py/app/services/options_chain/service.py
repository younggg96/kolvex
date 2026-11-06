"""Options chain + derived metrics for one underlying and expiration, cached in Redis."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from app.core.redis import get_redis
from app.services.options_chain import metrics
from app.services.options_chain.alpaca_client import AlpacaOptionsClient

logger = logging.getLogger(__name__)
NY = ZoneInfo("America/New_York")
CHAIN_TTL = 60
EXPIRATIONS_TTL = 3600


class ExpirationNotFound(ValueError):
    pass


class OptionsChainService:
    def __init__(self, client: Optional[AlpacaOptionsClient] = None):
        self.client = client or AlpacaOptionsClient()

    @staticmethod
    def _today():
        return datetime.now(NY).date()

    async def get_expirations(self, symbol: str) -> list[str]:
        redis = get_redis()
        key = f"options:expirations:v1:{symbol}"
        cached = await redis.get_json(key)
        if cached:
            return cached
        contracts = await self.client.get_contracts(symbol, expiration_gte=self._today().isoformat())
        expirations = sorted({c["expiration_date"] for c in contracts if c.get("expiration_date")})
        if expirations:
            await redis.set_json(key, expirations, ttl=EXPIRATIONS_TTL)
        return expirations

    async def get_chain(self, symbol: str, expiration: Optional[str] = None) -> dict:
        symbol = symbol.upper()
        expirations = await self.get_expirations(symbol)
        if not expirations:
            raise ExpirationNotFound(f"No listed options for {symbol}")
        expiration = expiration or expirations[0]
        if expiration not in expirations:
            raise ExpirationNotFound(f"{expiration} is not a listed expiration for {symbol}")

        redis = get_redis()
        key = f"options:chain:v2:{symbol}:{expiration}"
        cached = await redis.get_json(key)
        if cached:
            return cached

        spot, snapshots, contracts = await asyncio.gather(
            self.client.get_underlying_price(symbol),
            self.client.get_chain_snapshots(symbol, expiration),
            self.client.get_contracts(symbol, expiration=expiration),
        )
        by_symbol = {c["symbol"]: c for c in contracts if c.get("symbol")}
        rows = []
        for occ in set(snapshots) | set(by_symbol):
            row = metrics.normalize_contract(occ, snapshots.get(occ), by_symbol.get(occ))
            if row and row["expiration"] == expiration:
                row["mid"] = metrics.mid_price(row)
                rows.append(row)
        rows.sort(key=lambda r: (r["strike"], r["type"]))

        result = {
            "symbol": symbol,
            "expiration": expiration,
            "expirations": expirations,
            "underlying_price": spot,
            "metrics": metrics.chain_metrics(rows, spot, expiration, self._today()),
            "contracts": rows,
            "source": {"provider": "alpaca", "feed": self.client.feed, "delayed": self.client.feed != "opra"},
            "as_of": datetime.now(timezone.utc).isoformat(),
        }
        await redis.set_json(key, result, ttl=CHAIN_TTL)
        return result


options_chain_service = OptionsChainService()
