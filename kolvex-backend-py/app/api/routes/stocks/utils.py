"""
Stocks API 辅助函数
"""

import json
from typing import Any, Optional


def calculate_sentiment_score(
    sentiment_value: Optional[str], confidence: Optional[float]
) -> Optional[float]:
    """
    计算情感分数 (-100 到 100)
    bullish -> positive, bearish -> negative, neutral -> 0
    """
    if not sentiment_value:
        return None

    conf = confidence or 0.5

    if sentiment_value.lower() == "bullish":
        return conf * 100
    elif sentiment_value.lower() == "bearish":
        return conf * -100
    else:
        return 0


def parse_json_field(value: Any, default: Any = None) -> Any:
    """解析可能是 JSON 字符串或已解析对象的字段"""
    if value is None:
        return default
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return value


def normalize_ticker(ticker: str) -> str:
    """标准化股票代码"""
    ticker = ticker.strip().upper()
    if ticker.startswith("$"):
        ticker = ticker[1:]
    return ticker


def tweet_contains_ticker(tickers_raw: Any, target_ticker: str) -> bool:
    """检查推文是否包含目标股票代码"""
    if not tickers_raw:
        return False

    tickers = []
    if isinstance(tickers_raw, list):
        tickers = tickers_raw
    elif isinstance(tickers_raw, str):
        if tickers_raw.startswith("["):
            try:
                tickers = json.loads(tickers_raw)
            except:
                tickers = [t.strip() for t in tickers_raw.split(",") if t.strip()]
        else:
            tickers = [t.strip() for t in tickers_raw.split(",") if t.strip()]

    for ticker in tickers:
        if normalize_ticker(ticker) == target_ticker:
            return True
    return False


def parse_tickers_from_raw(tickers_raw: Any) -> list:
    """从原始数据解析 tickers 列表"""
    if not tickers_raw:
        return []

    tickers = []
    if isinstance(tickers_raw, list):
        tickers = tickers_raw
    elif isinstance(tickers_raw, str):
        if tickers_raw.startswith("["):
            try:
                tickers = json.loads(tickers_raw)
            except:
                tickers = [t.strip() for t in tickers_raw.split(",") if t.strip()]
        else:
            tickers = [t.strip() for t in tickers_raw.split(",") if t.strip()]

    return tickers

