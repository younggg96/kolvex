"""
Finnhub REST API 客户端
用于获取股票报价、公司信息等数据
"""

import os
import httpx
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FinnhubClient:
    """Finnhub REST API 客户端"""
    
    BASE_URL = "https://finnhub.io/api/v1"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("FINNHUB_API_KEY", "")
        if not self.api_key:
            logger.warning("Finnhub API Key 未配置，部分功能可能不可用")
        self._client = httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        """关闭客户端"""
        await self._client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    def _build_url(self, endpoint: str) -> str:
        """构建请求 URL"""
        return f"{self.BASE_URL}/{endpoint}"
    
    async def _request(self, endpoint: str, params: Optional[Dict] = None) -> Dict:
        """发送请求"""
        url = self._build_url(endpoint)
        params = params or {}
        params["token"] = self.api_key
        
        try:
            response = await self._client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Finnhub API 请求失败: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Finnhub API 请求异常: {e}")
            raise
    
    # ==================== 实时报价 ====================
    
    async def get_quote(self, symbol: str) -> Dict[str, Any]:
        """
        获取股票实时报价
        
        Args:
            symbol: 股票代码 (如 AAPL, TSLA)
            
        Returns:
            {
                "c": 当前价格,
                "d": 变化金额,
                "dp": 变化百分比,
                "h": 当日最高,
                "l": 当日最低,
                "o": 开盘价,
                "pc": 前收盘价,
                "t": 时间戳
            }
        """
        data = await self._request("quote", {"symbol": symbol.upper()})
        
        return {
            "symbol": symbol.upper(),
            "current_price": data.get("c"),
            "change": data.get("d"),
            "change_percent": data.get("dp"),
            "high": data.get("h"),
            "low": data.get("l"),
            "open": data.get("o"),
            "previous_close": data.get("pc"),
            "timestamp": data.get("t"),
        }
    
    async def get_multiple_quotes(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """批量获取多个股票的实时报价"""
        results = []
        for symbol in symbols:
            try:
                quote = await self.get_quote(symbol)
                results.append(quote)
            except Exception as e:
                logger.error(f"获取 {symbol} 报价失败: {e}")
                results.append({"symbol": symbol, "error": str(e)})
        return results
    
    # ==================== 公司信息 ====================
    
    async def get_company_profile(self, symbol: str) -> Dict[str, Any]:
        """
        获取公司基本信息
        
        Returns:
            {
                "country": 国家,
                "currency": 货币,
                "exchange": 交易所,
                "finnhubIndustry": 行业,
                "ipo": IPO 日期,
                "logo": Logo URL,
                "marketCapitalization": 市值,
                "name": 公司名称,
                "phone": 电话,
                "shareOutstanding": 流通股数,
                "ticker": 股票代码,
                "weburl": 网站
            }
        """
        return await self._request("stock/profile2", {"symbol": symbol.upper()})
    
    # ==================== 市场状态 ====================
    
    async def get_market_status(self, exchange: str = "US") -> Dict[str, Any]:
        """
        获取市场开盘状态
        
        Args:
            exchange: 交易所代码 (US, LSE, etc.)
            
        Returns:
            {
                "exchange": 交易所,
                "holiday": 是否假日,
                "isOpen": 是否开盘,
                "session": 当前交易时段,
                "t": 时间戳,
                "timezone": 时区
            }
        """
        return await self._request("stock/market-status", {"exchange": exchange})
    
    def get_market_session(self) -> str:
        """
        判断当前美股市场时段
        
        Returns:
            "pre_market" | "regular" | "after_hours" | "closed"
        """
        now = datetime.utcnow()
        hour = now.hour
        minute = now.minute
        weekday = now.weekday()
        
        # 周末闭市
        if weekday >= 5:
            return "closed"
        
        # 美东时间 = UTC - 5 (冬令时) 或 UTC - 4 (夏令时)
        # 这里使用近似计算，假设 UTC-5
        # 盘前: 4:00-9:30 ET → UTC 9:00-14:30
        # 盘中: 9:30-16:00 ET → UTC 14:30-21:00
        # 盘后: 16:00-20:00 ET → UTC 21:00-01:00
        
        total_minutes = hour * 60 + minute
        
        # 盘前: UTC 9:00 - 14:30 (540 - 870)
        if 540 <= total_minutes < 870:
            return "pre_market"
        
        # 盘中: UTC 14:30 - 21:00 (870 - 1260)
        if 870 <= total_minutes < 1260:
            return "regular"
        
        # 盘后: UTC 21:00 - 01:00 (1260 - 1440 或 0 - 60)
        if total_minutes >= 1260 or total_minutes < 60:
            return "after_hours"
        
        return "closed"
    
    # ==================== 新闻 ====================
    
    async def get_company_news(
        self, 
        symbol: str, 
        from_date: Optional[str] = None,
        to_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取公司相关新闻
        
        Args:
            symbol: 股票代码
            from_date: 开始日期 (YYYY-MM-DD)
            to_date: 结束日期 (YYYY-MM-DD)
        """
        if not from_date:
            from_date = datetime.now().strftime("%Y-%m-%d")
        if not to_date:
            to_date = datetime.now().strftime("%Y-%m-%d")
        
        return await self._request("company-news", {
            "symbol": symbol.upper(),
            "from": from_date,
            "to": to_date
        })
    
    # ==================== 技术指标 ====================
    
    async def get_technical_indicator(
        self,
        symbol: str,
        indicator: str = "rsi",
        resolution: str = "D",
        from_timestamp: Optional[int] = None,
        to_timestamp: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取技术指标
        
        Args:
            symbol: 股票代码
            indicator: 指标类型 (rsi, macd, sma, ema, etc.)
            resolution: 时间粒度 (1, 5, 15, 30, 60, D, W, M)
            from_timestamp: 开始时间戳
            to_timestamp: 结束时间戳
        """
        import time
        
        if not to_timestamp:
            to_timestamp = int(time.time())
        if not from_timestamp:
            from_timestamp = to_timestamp - 86400 * 30  # 默认30天
        
        return await self._request("indicator", {
            "symbol": symbol.upper(),
            "indicator": indicator,
            "resolution": resolution,
            "from": from_timestamp,
            "to": to_timestamp
        })


# 单例模式
_finnhub_client: Optional[FinnhubClient] = None


def get_finnhub_client() -> FinnhubClient:
    """获取 Finnhub 客户端单例"""
    global _finnhub_client
    if _finnhub_client is None:
        _finnhub_client = FinnhubClient()
    return _finnhub_client
