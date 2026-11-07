"""Alpaca options market data client.

Free tier: the `indicative` options feed (delayed, non-OPRA) plus the contracts
endpoint for open interest. Personal/internal use only under Alpaca's terms —
public display of options quotes needs a paid OPRA-licensed feed.

Docs: https://docs.alpaca.markets/reference/optionchain
"""

import logging
import os
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

DATA_BASE_URL = "https://data.alpaca.markets"
TRADING_BASE_URL = os.getenv("ALPACA_TRADING_BASE_URL", "https://paper-api.alpaca.markets")
MAX_PAGES = 20  # hard stop so a bad page_token loop can't run forever


class AlpacaNotConfigured(RuntimeError):
    pass


class AlpacaOptionsClient:
    def __init__(
        self,
        key_id: Optional[str] = None,
        secret_key: Optional[str] = None,
        feed: Optional[str] = None,
        transport: Optional[httpx.AsyncBaseTransport] = None,
        limiter: Optional[Any] = None,
    ):
        self.key_id = key_id if key_id is not None else os.getenv("ALPACA_API_KEY_ID", "")
        self.secret_key = secret_key if secret_key is not None else os.getenv("ALPACA_API_SECRET_KEY", "")
        self.feed = feed or os.getenv("ALPACA_OPTIONS_FEED", "indicative")
        self._transport = transport
        self._limiter = limiter  # optional object with `async wait()`, called before every request

    @property
    def configured(self) -> bool:
        return bool(self.key_id and self.secret_key)

    def _client(self) -> httpx.AsyncClient:
        if not self.configured:
            raise AlpacaNotConfigured("ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY are not set")
        return httpx.AsyncClient(
            timeout=20.0,
            transport=self._transport,
            headers={"APCA-API-KEY-ID": self.key_id, "APCA-API-SECRET-KEY": self.secret_key},
        )

    async def _get(self, client: httpx.AsyncClient, url: str, params: dict) -> dict:
        if self._limiter is not None:
            await self._limiter.wait()
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()

    async def _paginate(self, client: httpx.AsyncClient, url: str, params: dict, items_key: str) -> list | dict:
        """Follow next_page_token. Items are a list (contracts) or a dict (snapshots)."""
        merged: Any = None
        params = dict(params)
        for _ in range(MAX_PAGES):
            body = await self._get(client, url, params)
            page = body.get(items_key) or ({} if items_key == "snapshots" else [])
            if merged is None:
                merged = page
            elif isinstance(merged, dict):
                merged.update(page)
            else:
                merged.extend(page)
            token = body.get("next_page_token")
            if not token:
                return merged
            params["page_token"] = token
        logger.warning("Alpaca pagination hit MAX_PAGES for %s", url)
        return merged if merged is not None else []

    async def get_stock_snapshot(self, symbol: str) -> dict:
        """Raw IEX stock snapshot: latestTrade, dailyBar, prevDailyBar, ..."""
        async with self._client() as client:
            return await self._get(client, f"{DATA_BASE_URL}/v2/stocks/{symbol}/snapshot", {"feed": "iex"})

    async def get_underlying_price(self, symbol: str) -> Optional[float]:
        body = await self.get_stock_snapshot(symbol)
        for path in (("latestTrade", "p"), ("dailyBar", "c"), ("prevDailyBar", "c")):
            value = (body.get(path[0]) or {}).get(path[1])
            if value:
                return float(value)
        return None

    async def get_contracts(
        self,
        symbol: str,
        expiration: Optional[str] = None,
        expiration_gte: Optional[str] = None,
        expiration_lte: Optional[str] = None,
        strike_gte: Optional[float] = None,
        strike_lte: Optional[float] = None,
    ) -> list[dict]:
        """Contract metadata including open_interest (updated daily)."""
        params: dict = {"underlying_symbols": symbol, "status": "active", "limit": 10000}
        params.update(_filters(expiration, expiration_gte, expiration_lte, strike_gte, strike_lte))
        async with self._client() as client:
            return await self._paginate(client, f"{TRADING_BASE_URL}/v2/options/contracts", params, "option_contracts")

    async def get_chain_snapshots(
        self,
        symbol: str,
        expiration: Optional[str] = None,
        expiration_gte: Optional[str] = None,
        expiration_lte: Optional[str] = None,
        strike_gte: Optional[float] = None,
        strike_lte: Optional[float] = None,
    ) -> dict[str, dict]:
        """OCC symbol -> snapshot (latestQuote, latestTrade, dailyBar, greeks, impliedVolatility)."""
        params = {"feed": self.feed, "limit": 1000}
        params.update(_filters(expiration, expiration_gte, expiration_lte, strike_gte, strike_lte))
        async with self._client() as client:
            return await self._paginate(client, f"{DATA_BASE_URL}/v1beta1/options/snapshots/{symbol}", params, "snapshots")


def _filters(expiration, expiration_gte, expiration_lte, strike_gte, strike_lte) -> dict:
    """Alpaca's shared expiration/strike query parameters; unset values are omitted."""
    pairs = {
        "expiration_date": expiration,
        "expiration_date_gte": expiration_gte,
        "expiration_date_lte": expiration_lte,
        "strike_price_gte": None if strike_gte is None else round(strike_gte, 2),
        "strike_price_lte": None if strike_lte is None else round(strike_lte, 2),
    }
    return {key: value for key, value in pairs.items() if value is not None}
