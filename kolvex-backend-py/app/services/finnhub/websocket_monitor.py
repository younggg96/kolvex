"""
Finnhub WebSocket 实时价格监控服务
支持盘前、盘中、盘后实时价格推送
"""

import os
import json
import asyncio
import logging
from typing import Callable, List, Dict, Optional, Set
from datetime import datetime, timedelta
from collections import defaultdict
import threading

logger = logging.getLogger(__name__)


class FinnhubWebSocketMonitor:
    """
    Finnhub WebSocket 实时价格监控
    
    Features:
    - 实时价格推送 (盘前/盘中/盘后)
    - 自动重连机制
    - 价格变化计算 (日内涨跌幅、5分钟涨跌幅)
    - 回调函数支持
    """
    
    WS_URL = "wss://ws.finnhub.io"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("FINNHUB_API_KEY", "")
        if not self.api_key:
            raise ValueError("Finnhub API Key 未配置")
        
        self.ws = None
        self.subscribed_symbols: Set[str] = set()
        self.callbacks: List[Callable] = []
        
        # 价格缓存 (用于计算涨跌幅)
        self.price_cache: Dict[str, Dict] = defaultdict(lambda: {
            "open_price": None,
            "previous_close": None,
            "prices_5min": [],  # 5分钟内的价格记录
            "last_price": None,
            "last_volume": 0,
        })
        
        # 控制标志
        self._running = False
        self._reconnect_delay = 5  # 重连延迟(秒)
        self._max_reconnect_attempts = 10
    
    def add_callback(self, callback: Callable[[Dict], None]):
        """
        添加价格变化回调函数
        
        Args:
            callback: 回调函数，接收价格数据字典
        """
        self.callbacks.append(callback)
    
    def remove_callback(self, callback: Callable):
        """移除回调函数"""
        if callback in self.callbacks:
            self.callbacks.remove(callback)
    
    def _trigger_callbacks(self, price_data: Dict):
        """触发所有回调"""
        for callback in self.callbacks:
            try:
                # 支持同步和异步回调
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(price_data))
                else:
                    callback(price_data)
            except Exception as e:
                logger.error(f"回调函数执行失败: {e}")
    
    def _get_market_session(self) -> str:
        """获取当前市场时段"""
        now = datetime.utcnow()
        hour = now.hour
        minute = now.minute
        weekday = now.weekday()
        
        if weekday >= 5:
            return "closed"
        
        total_minutes = hour * 60 + minute
        
        # 盘前: UTC 9:00 - 14:30
        if 540 <= total_minutes < 870:
            return "pre_market"
        
        # 盘中: UTC 14:30 - 21:00
        if 870 <= total_minutes < 1260:
            return "regular"
        
        # 盘后: UTC 21:00 - 01:00
        if total_minutes >= 1260 or total_minutes < 60:
            return "after_hours"
        
        return "closed"
    
    def _calculate_change(self, symbol: str, current_price: float) -> Dict:
        """
        计算价格变化
        
        Returns:
            {
                "change_percent": 日内涨跌幅,
                "change_5min": 5分钟涨跌幅,
                "change_amount": 变化金额
            }
        """
        cache = self.price_cache[symbol]
        result = {
            "change_percent": 0.0,
            "change_5min": 0.0,
            "change_amount": 0.0,
        }
        
        # 计算日内涨跌幅
        base_price = cache.get("previous_close") or cache.get("open_price")
        if base_price and base_price > 0:
            result["change_percent"] = ((current_price - base_price) / base_price) * 100
            result["change_amount"] = current_price - base_price
        
        # 计算5分钟涨跌幅
        now = datetime.utcnow()
        prices_5min = cache.get("prices_5min", [])
        
        # 过滤出5分钟内的价格
        cutoff = now - timedelta(minutes=5)
        recent_prices = [p for p in prices_5min if p["time"] > cutoff]
        
        if recent_prices:
            oldest_price = recent_prices[0]["price"]
            if oldest_price > 0:
                result["change_5min"] = ((current_price - oldest_price) / oldest_price) * 100
        
        return result
    
    def _update_price_cache(self, symbol: str, price: float, volume: int = 0):
        """更新价格缓存"""
        now = datetime.utcnow()
        cache = self.price_cache[symbol]
        
        # 设置开盘价 (当天第一个价格)
        if cache["open_price"] is None:
            cache["open_price"] = price
        
        # 更新最新价格
        cache["last_price"] = price
        cache["last_volume"] = volume
        
        # 添加到5分钟价格记录
        cache["prices_5min"].append({"price": price, "time": now})
        
        # 清理超过5分钟的记录
        cutoff = now - timedelta(minutes=5)
        cache["prices_5min"] = [p for p in cache["prices_5min"] if p["time"] > cutoff]
    
    async def set_previous_close(self, symbol: str, previous_close: float):
        """设置前收盘价 (用于计算日内涨跌幅)"""
        self.price_cache[symbol]["previous_close"] = previous_close
    
    def _on_message(self, ws, message: str):
        """处理 WebSocket 消息"""
        try:
            data = json.loads(message)
            
            if data.get("type") == "trade":
                for trade in data.get("data", []):
                    symbol = trade.get("s", "")
                    price = trade.get("p", 0)
                    volume = trade.get("v", 0)
                    timestamp = trade.get("t", 0)
                    
                    if not symbol or price <= 0:
                        continue
                    
                    # 更新缓存
                    self._update_price_cache(symbol, price, volume)
                    
                    # 计算变化
                    changes = self._calculate_change(symbol, price)
                    
                    # 构造价格数据
                    price_data = {
                        "symbol": symbol,
                        "price": price,
                        "volume": volume,
                        "timestamp": timestamp,
                        "session": self._get_market_session(),
                        "change_percent": changes["change_percent"],
                        "change_5min": changes["change_5min"],
                        "change_amount": changes["change_amount"],
                        "received_at": datetime.utcnow().isoformat(),
                    }
                    
                    # 触发回调
                    self._trigger_callbacks(price_data)
            
            elif data.get("type") == "ping":
                # 心跳响应
                pass
            
            elif data.get("type") == "error":
                logger.error(f"Finnhub WebSocket 错误: {data.get('msg')}")
        
        except json.JSONDecodeError as e:
            logger.error(f"JSON 解析失败: {e}")
        except Exception as e:
            logger.error(f"处理消息异常: {e}")
    
    def _on_error(self, ws, error):
        """处理 WebSocket 错误"""
        logger.error(f"Finnhub WebSocket 错误: {error}")
    
    def _on_close(self, ws, close_status_code, close_msg):
        """处理 WebSocket 关闭"""
        logger.warning(f"Finnhub WebSocket 关闭: {close_status_code} - {close_msg}")
        
        # 尝试重连
        if self._running:
            logger.info(f"{self._reconnect_delay}秒后尝试重连...")
    
    def _on_open(self, ws):
        """WebSocket 连接成功"""
        logger.info("Finnhub WebSocket 连接成功")
        
        # 重新订阅所有股票
        for symbol in self.subscribed_symbols:
            self._send_subscribe(ws, symbol)
    
    def _send_subscribe(self, ws, symbol: str):
        """发送订阅消息"""
        try:
            ws.send(json.dumps({"type": "subscribe", "symbol": symbol}))
            logger.info(f"已订阅: {symbol}")
        except Exception as e:
            logger.error(f"订阅 {symbol} 失败: {e}")
    
    def _send_unsubscribe(self, ws, symbol: str):
        """发送取消订阅消息"""
        try:
            ws.send(json.dumps({"type": "unsubscribe", "symbol": symbol}))
            logger.info(f"已取消订阅: {symbol}")
        except Exception as e:
            logger.error(f"取消订阅 {symbol} 失败: {e}")
    
    def subscribe(self, symbols: List[str]):
        """订阅股票"""
        for symbol in symbols:
            symbol = symbol.upper()
            self.subscribed_symbols.add(symbol)
            
            if self.ws:
                self._send_subscribe(self.ws, symbol)
    
    def unsubscribe(self, symbols: List[str]):
        """取消订阅股票"""
        for symbol in symbols:
            symbol = symbol.upper()
            self.subscribed_symbols.discard(symbol)
            
            if self.ws:
                self._send_unsubscribe(self.ws, symbol)
    
    def start(self, symbols: Optional[List[str]] = None):
        """
        启动 WebSocket 监控 (阻塞式)
        
        Args:
            symbols: 要订阅的股票列表
        """
        import websocket
        
        if symbols:
            self.subscribe(symbols)
        
        self._running = True
        reconnect_attempts = 0
        
        while self._running and reconnect_attempts < self._max_reconnect_attempts:
            try:
                ws_url = f"{self.WS_URL}?token={self.api_key}"
                
                self.ws = websocket.WebSocketApp(
                    ws_url,
                    on_message=self._on_message,
                    on_error=self._on_error,
                    on_close=self._on_close,
                    on_open=self._on_open
                )
                
                logger.info("正在连接 Finnhub WebSocket...")
                self.ws.run_forever()
                
                # 连接断开后
                if self._running:
                    reconnect_attempts += 1
                    logger.info(f"重连尝试 {reconnect_attempts}/{self._max_reconnect_attempts}")
                    import time
                    time.sleep(self._reconnect_delay)
            
            except Exception as e:
                logger.error(f"WebSocket 启动失败: {e}")
                reconnect_attempts += 1
                import time
                time.sleep(self._reconnect_delay)
        
        logger.info("Finnhub WebSocket 监控已停止")
    
    async def start_async(self, symbols: Optional[List[str]] = None):
        """
        启动 WebSocket 监控 (异步版本，在后台线程中运行)
        
        Args:
            symbols: 要订阅的股票列表
        """
        if symbols:
            self.subscribe(symbols)
        
        # 在后台线程中运行 WebSocket
        thread = threading.Thread(target=self.start, daemon=True)
        thread.start()
        
        # 等待连接建立
        await asyncio.sleep(2)
        
        return thread
    
    def stop(self):
        """停止 WebSocket 监控"""
        self._running = False
        if self.ws:
            self.ws.close()
            self.ws = None
        logger.info("Finnhub WebSocket 监控已请求停止")
    
    def is_running(self) -> bool:
        """检查是否正在运行"""
        return self._running and self.ws is not None


# 全局实例
_monitor_instance: Optional[FinnhubWebSocketMonitor] = None


def get_websocket_monitor() -> FinnhubWebSocketMonitor:
    """获取 WebSocket 监控单例"""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = FinnhubWebSocketMonitor()
    return _monitor_instance
