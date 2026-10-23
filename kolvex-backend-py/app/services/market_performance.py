"""
近期股价表现服务

批量计算股票最近 1 个交易日、5 个交易日与 1 个月的收盘价涨跌幅，
供股票目录把博主情绪与真实走势做对比。数据来自 yfinance 批量下载，
并按 symbol 做内存缓存，避免目录刷新时反复请求 Yahoo。

Yahoo 在并发批量下载时会静默降级（返回大量 NaN Close），所以所有
yf.download 调用都由进程级 DOWNLOAD_LOCK 串行化；成功数据缓存 300 秒，
失败/无数据只缓存 NEGATIVE_TTL_SECONDS，瞬时失败则完全不缓存。
"""

import logging
import re
import threading
import time
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
import yfinance as yf

from app.services.yfinance.client import _optional_number

logger = logging.getLogger(__name__)

MAX_SYMBOLS = 80
DOWNLOAD_CHUNK_SIZE = 50
CACHE_TTL_SECONDS = 300.0
NEGATIVE_TTL_SECONDS = 60.0
DOWNLOAD_RETRY_DELAY_SECONDS = 0.5
DOWNLOAD_PERIOD = "3mo"
DOWNLOAD_INTERVAL = "1d"

_SYMBOL_PATTERN = re.compile(r"^[A-Z0-9.\-^=]{1,20}$")

# Yahoo 在并发批量下载时会静默降级，因此所有 downloader 调用必须经此锁串行化。
_download_lock = threading.Lock()

# symbol -> (写入缓存时的 monotonic 时间, 结果 dict)；TTL 按结果类型在读取时判定
_cache: Dict[str, tuple] = {}
_cache_lock = threading.Lock()


class TooManySymbolsError(ValueError):
    """请求归一化后超过 MAX_SYMBOLS 时抛出，由路由转换为 400。"""


def normalize_symbols(symbols: Iterable[str]) -> List[str]:
    """处理逗号分隔和重复参数：去空白、转大写、去重并过滤非法代码。"""
    normalized: List[str] = []
    seen = set()
    for raw in symbols or ():
        if raw is None:
            continue
        for part in str(raw).split(","):
            symbol = part.strip().upper()
            if not symbol or symbol in seen or not _SYMBOL_PATTERN.fullmatch(symbol):
                continue
            seen.add(symbol)
            normalized.append(symbol)
    return normalized


def clear_cache() -> None:
    """清空内存缓存（测试与运维使用）。"""
    with _cache_lock:
        _cache.clear()


def _cache_entry(symbol: str, now: float) -> Optional[Dict[str, Any]]:
    """返回仍在新 TTL 内的缓存结果；调用方需持有 _cache_lock。"""
    cached = _cache.get(symbol)
    if not cached:
        return None
    stored_at, entry = cached
    ttl = NEGATIVE_TTL_SECONDS if "error" in entry else CACHE_TTL_SECONDS
    if now - stored_at < ttl:
        return entry
    return None


def _download(tickers: Sequence[str]) -> pd.DataFrame:
    """yfinance 批量日线下载；group_by="ticker" 得到 (ticker, field) 列。"""
    return yf.download(
        tickers=list(tickers),
        period=DOWNLOAD_PERIOD,
        interval=DOWNLOAD_INTERVAL,
        group_by="ticker",
        auto_adjust=False,
        progress=False,
        threads=True,
    )


def _close_series(frame: Optional[pd.DataFrame], symbol: str) -> Optional[pd.Series]:
    """从单票平铺列或多票 (ticker, field) 列中取出有效收盘价序列。"""
    if frame is None or getattr(frame, "empty", True):
        return None
    columns = frame.columns
    try:
        if isinstance(columns, pd.MultiIndex):
            if symbol not in columns.get_level_values(0):
                return None
            block = frame[symbol]
            if isinstance(block, pd.Series):
                closes = block
            elif "Close" in block.columns:
                closes = block["Close"]
            else:
                return None
        elif isinstance(frame, pd.Series):
            closes = frame
        elif "Close" in columns:
            closes = frame["Close"]
        else:
            return None
    except (KeyError, TypeError, ValueError):
        return None

    if isinstance(closes, pd.DataFrame):
        if closes.shape[1] == 0:
            return None
        closes = closes.iloc[:, 0]
    closes = pd.to_numeric(closes, errors="coerce")
    closes = closes[np.isfinite(closes)]
    if closes.empty:
        return None
    return closes.sort_index()


def _percent_change(latest: float, base: Any) -> Optional[float]:
    """(latest / base - 1) * 100，保留两位小数；基数为 0 或缺失时返回 None。"""
    try:
        base_value = float(base)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(base_value) or base_value == 0 or not np.isfinite(latest):
        return None
    return round((latest / base_value - 1.0) * 100.0, 2)


def _as_of(index_value: Any) -> str:
    """最新一根 bar 的日期，格式 YYYY-MM-DD。"""
    date_value = index_value.date() if hasattr(index_value, "date") else index_value
    return date_value.isoformat() if hasattr(date_value, "isoformat") else str(date_value)


def _month_ago_position(index: pd.Index) -> int:
    """最新 bar 之前（含当天）最后一条 <= 一个月前的 bar 的位置，没有则 -1。"""
    if not isinstance(index, pd.DatetimeIndex) or len(index) == 0:
        return -1
    try:
        target = index[-1] - pd.DateOffset(months=1)
        return int(index.searchsorted(target, side="right")) - 1
    except (TypeError, ValueError):
        return -1


def _no_data(symbol: str) -> Dict[str, Any]:
    return {"symbol": symbol, "error": "No price data"}


def _performance_entry(symbol: str, closes: Optional[pd.Series]) -> Dict[str, Any]:
    """由收盘价序列计算单只股票的近期表现。"""
    if closes is None or closes.empty:
        return _no_data(symbol)
    latest = float(closes.iloc[-1])
    if not np.isfinite(latest) or latest <= 0:
        return _no_data(symbol)

    entry: Dict[str, Any] = {
        "symbol": symbol,
        "as_of": _as_of(closes.index[-1]),
        "price": _optional_number(latest, 2),
        "previous_close": _optional_number(closes.iloc[-2], 2) if len(closes) >= 2 else None,
        "change_1d_percent": _percent_change(latest, closes.iloc[-2]) if len(closes) >= 2 else None,
        "change_5d_percent": _percent_change(latest, closes.iloc[-6]) if len(closes) >= 6 else None,
        "change_1mo_percent": None,
    }
    month_position = _month_ago_position(closes.index)
    if month_position >= 0:
        entry["change_1mo_percent"] = _percent_change(latest, closes.iloc[month_position])
    return entry


def _extract_closes(
    symbols: Sequence[str],
    frame: Optional[pd.DataFrame],
) -> Dict[str, Optional[pd.Series]]:
    """从整帧中为每个 symbol 取出可用收盘价序列。"""
    return {symbol: _close_series(frame, symbol) for symbol in symbols}


def _attempt_download(
    symbols: Sequence[str],
    downloader: Callable[[Sequence[str]], pd.DataFrame],
) -> Tuple[Dict[str, Optional[pd.Series]], bool]:
    """单次批量下载，返回 (每个 symbol 的收盘价, 是否至少有一只有可用数据)。"""
    try:
        frame = downloader(list(symbols))
    except Exception:
        logger.warning("Bulk price download failed for %s", list(symbols), exc_info=True)
        return {symbol: None for symbol in symbols}, False
    closes = _extract_closes(symbols, frame)
    return closes, any(series is not None for series in closes.values())


def _download_with_retry(
    symbols: Sequence[str],
    downloader: Callable[[Sequence[str]], pd.DataFrame],
) -> Tuple[Dict[str, Optional[pd.Series]], bool]:
    """
    批量下载并做一次有界重试。

    整帧下载异常 / 空帧 / 整批都没有可用 Close 时，等待很短时间后重试一次；
    仍无可用数据则返回 transient=True，调用方不得缓存这批失败结果。
    """
    closes, usable = _attempt_download(symbols, downloader)
    if usable:
        return closes, False
    time.sleep(DOWNLOAD_RETRY_DELAY_SECONDS)
    closes, usable = _attempt_download(symbols, downloader)
    return closes, not usable


def _ensure_chunk(
    symbols: Sequence[str],
    downloader: Callable[[Sequence[str]], pd.DataFrame],
) -> Dict[str, Dict[str, Any]]:
    """
    保证一个 chunk 的结果，返回每个 symbol 的 entry。

    进程级 _download_lock 保证同一时刻只有一次 yf.download：等待中的请求拿到锁后
    会重新检查缓存，只下载仍缺失的 symbol。下载后的收盘价提取与百分比计算（纯 CPU，
    微秒级）留在同一串行区内，这样等待者重新检查时一定能看到已填充的缓存，避免
    突发请求把同一批 symbol 再下载一遍。真正的网络等待只发生在 downloader 上。
    """
    with _download_lock:
        now = time.monotonic()
        with _cache_lock:
            entries = {symbol: _cache_entry(symbol, now) for symbol in symbols}
        missing = [symbol for symbol in symbols if entries[symbol] is None]
        if not missing:
            return {symbol: entries[symbol] for symbol in symbols}

        closes_map, transient = _download_with_retry(missing, downloader)
        computed: Dict[str, Dict[str, Any]] = {}
        for symbol in missing:
            try:
                computed[symbol] = _performance_entry(symbol, closes_map.get(symbol))
            except Exception:
                logger.exception("Failed to compute performance for %s", symbol)
                computed[symbol] = _no_data(symbol)
        stored_at = time.monotonic()
        with _cache_lock:
            for symbol in missing:
                entry = computed[symbol]
                entries[symbol] = entry
                # 瞬时失败（整批异常/空帧/整批无可用 Close）不写缓存，下次请求立即重试。
                if transient:
                    continue
                _cache[symbol] = (stored_at, entry)
    return entries


def get_stock_performance(
    symbols: Iterable[str],
    downloader: Optional[Callable[[Sequence[str]], pd.DataFrame]] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    批量获取近期表现。

    返回 {"stocks": {symbol: entry}}，entry 含 1d/5d/1mo 涨跌幅；无可用
    数据的 symbol 返回 {"symbol": ..., "error": "No price data"}。仅下载
    缺失或缓存过期的 symbol，单次最多 DOWNLOAD_CHUNK_SIZE 个；成功结果
    缓存 CACHE_TTL_SECONDS，无数据结果只缓存 NEGATIVE_TTL_SECONDS。
    """
    normalized = normalize_symbols(symbols)
    if len(normalized) > MAX_SYMBOLS:
        raise TooManySymbolsError(f"Too many symbols (max {MAX_SYMBOLS})")
    if not normalized:
        return {"stocks": {}}

    fetch = downloader or _download
    now = time.monotonic()
    results: Dict[str, Dict[str, Any]] = {}
    stale: List[str] = []
    with _cache_lock:
        for symbol in normalized:
            entry = _cache_entry(symbol, now)
            if entry is not None:
                results[symbol] = entry
            else:
                stale.append(symbol)

    for start in range(0, len(stale), DOWNLOAD_CHUNK_SIZE):
        chunk = stale[start:start + DOWNLOAD_CHUNK_SIZE]
        results.update(_ensure_chunk(chunk, fetch))

    return {"stocks": {symbol: results[symbol] for symbol in normalized}}
