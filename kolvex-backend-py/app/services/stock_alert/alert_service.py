"""
股票预警主服务
整合 Finnhub 数据监控、AI 分析、多渠道通知
"""

import os
import asyncio
import logging
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timedelta
from collections import defaultdict

from app.core.supabase import get_supabase_service
from app.services.finnhub import FinnhubClient, FinnhubWebSocketMonitor
from .ai_analyzer import StockAIAnalyzer
from .multi_channel_notifier import MultiChannelNotifier, NotificationChannel

logger = logging.getLogger(__name__)


class StockAlertService:
    """
    股票预警主服务
    
    核心功能:
    1. 从数据库加载用户的预警规则
    2. 订阅 Finnhub WebSocket 实时价格
    3. 检测是否触发预警条件
    4. 调用 AI 分析价格异动
    5. 通过多渠道发送通知
    6. 记录预警历史
    """
    
    def __init__(self):
        self.supabase = get_supabase_service()
        self.finnhub_client = FinnhubClient()
        self.ws_monitor: Optional[FinnhubWebSocketMonitor] = None
        self.ai_analyzer = StockAIAnalyzer()
        self.notifier = MultiChannelNotifier()
        
        # 缓存: 预警规则
        self.alert_rules: Dict[str, List[Dict]] = defaultdict(list)  # symbol -> [rules]
        self.user_channels: Dict[str, Dict] = {}  # user_id -> channel_config
        
        # 冷却时间缓存 (避免重复通知)
        self.cooldown_cache: Dict[str, datetime] = {}  # "user_id:symbol" -> last_triggered_at
        
        # 监控状态
        self._running = False
        self._symbols_to_monitor: Set[str] = set()
    
    # ==================== 预警规则管理 ====================
    
    async def load_alert_rules(self):
        """从数据库加载所有活跃的预警规则"""
        try:
            response = (
                self.supabase.table("stock_alert_rules")
                .select("*")
                .eq("is_active", True)
                .execute()
            )
            
            rules = response.data or []
            
            # 按 symbol 分组
            self.alert_rules.clear()
            self._symbols_to_monitor.clear()
            
            for rule in rules:
                symbol = rule.get("symbol", "").upper()
                if symbol:
                    self.alert_rules[symbol].append(rule)
                    self._symbols_to_monitor.add(symbol)
            
            logger.info(f"已加载 {len(rules)} 条预警规则，监控 {len(self._symbols_to_monitor)} 只股票")
            
        except Exception as e:
            logger.error(f"加载预警规则失败: {e}")
    
    async def load_user_channels(self):
        """加载用户的通知渠道配置"""
        try:
            response = (
                self.supabase.table("user_notification_channels")
                .select("*")
                .eq("is_verified", True)
                .execute()
            )
            
            channels = response.data or []
            
            self.user_channels.clear()
            for channel in channels:
                user_id = channel.get("user_id")
                if user_id not in self.user_channels:
                    self.user_channels[user_id] = {}
                
                channel_type = channel.get("channel_type")
                
                # 根据渠道类型提取配置
                if channel_type == "discord":
                    self.user_channels[user_id]["discord_webhook_url"] = channel.get("discord_webhook_url")
                elif channel_type == "telegram":
                    self.user_channels[user_id]["telegram_bot_token"] = channel.get("telegram_bot_token")
                    self.user_channels[user_id]["telegram_chat_id"] = channel.get("telegram_chat_id")
                elif channel_type == "wechat":
                    self.user_channels[user_id]["wechat_webhook_url"] = channel.get("wechat_webhook_url")
                elif channel_type == "whatsapp":
                    self.user_channels[user_id]["whatsapp_phone_number"] = channel.get("whatsapp_phone_number")
            
            logger.info(f"已加载 {len(self.user_channels)} 个用户的通知渠道配置")
            
        except Exception as e:
            logger.error(f"加载通知渠道配置失败: {e}")
    
    async def get_user_email(self, user_id: str) -> Optional[str]:
        """获取用户邮箱"""
        try:
            response = (
                self.supabase.table("user_profiles")
                .select("email")
                .eq("id", user_id)
                .single()
                .execute()
            )
            return response.data.get("email") if response.data else None
        except Exception:
            return None
    
    # ==================== 预警检测 ====================
    
    async def process_price_update(self, price_data: Dict[str, Any]):
        """
        处理价格更新，检测是否触发预警
        
        Args:
            price_data: 来自 Finnhub WebSocket 的价格数据
        """
        symbol = price_data.get("symbol", "").upper()
        
        if symbol not in self.alert_rules:
            return
        
        rules = self.alert_rules[symbol]
        
        for rule in rules:
            try:
                should_alert = await self._check_alert_condition(rule, price_data)
                
                if should_alert:
                    # 检查冷却时间
                    if self._is_in_cooldown(rule, symbol):
                        continue
                    
                    # 触发预警流程
                    await self._trigger_alert(rule, price_data)
                    
            except Exception as e:
                logger.error(f"处理预警规则失败 (rule_id={rule.get('id')}): {e}")
    
    async def _check_alert_condition(self, rule: Dict, price_data: Dict) -> bool:
        """检查是否满足预警条件"""
        change_percent = abs(price_data.get("change_percent", 0))
        change_5min = abs(price_data.get("change_5min", 0))
        session = price_data.get("session", "regular")
        
        # 检查交易时段是否启用
        if session == "pre_market" and not rule.get("premarket_enabled", True):
            return False
        if session == "after_hours" and not rule.get("afterhours_enabled", True):
            return False
        if session == "regular" and not rule.get("regular_hours_enabled", True):
            return False
        if session == "closed":
            return False
        
        # 检查日内涨跌幅
        daily_threshold = rule.get("daily_change_threshold", 5.0)
        if change_percent >= daily_threshold:
            return True
        
        # 检查短时急涨急跌
        spike_threshold = rule.get("spike_change_threshold", 3.0)
        if change_5min >= spike_threshold:
            return True
        
        # 检查价格突破
        price = price_data.get("price", 0)
        price_above = rule.get("price_above")
        price_below = rule.get("price_below")
        
        if price_above and price >= price_above:
            return True
        if price_below and price <= price_below:
            return True
        
        return False
    
    def _is_in_cooldown(self, rule: Dict, symbol: str) -> bool:
        """检查是否在冷却期内"""
        user_id = rule.get("user_id")
        cooldown_minutes = rule.get("cooldown_minutes", 30)
        
        cache_key = f"{user_id}:{symbol}"
        last_triggered = self.cooldown_cache.get(cache_key)
        
        if last_triggered:
            elapsed = datetime.utcnow() - last_triggered
            if elapsed < timedelta(minutes=cooldown_minutes):
                return True
        
        return False
    
    def _update_cooldown(self, rule: Dict, symbol: str):
        """更新冷却时间"""
        user_id = rule.get("user_id")
        cache_key = f"{user_id}:{symbol}"
        self.cooldown_cache[cache_key] = datetime.utcnow()
    
    # ==================== 触发预警 ====================
    
    async def _trigger_alert(self, rule: Dict, price_data: Dict):
        """触发预警：AI 分析 + 发送通知 + 记录历史"""
        symbol = price_data.get("symbol")
        user_id = rule.get("user_id")
        
        logger.info(f"触发预警: {symbol} for user {user_id}")
        
        # 1. AI 分析 (如果启用)
        analysis = {}
        if rule.get("ai_analysis_enabled", True):
            try:
                analysis = await self.ai_analyzer.analyze_price_movement(price_data)
            except Exception as e:
                logger.error(f"AI 分析失败: {e}")
                # 使用备用分析
                analysis = self.ai_analyzer._fallback_analysis(price_data)
        else:
            # 不使用 AI，生成简单分析
            analysis = {
                "is_abnormal": True,
                "reason": "达到预警阈值",
                "risk_level": "中",
                "suggestion": "建议关注",
                "summary": f"{symbol} 价格变动 {price_data.get('change_percent', 0):+.2f}%",
            }
        
        # 合并数据
        alert_data = {
            **price_data,
            **analysis,
        }
        
        # 2. 发送通知
        channels_config = rule.get("channels", ["email"])
        if isinstance(channels_config, str):
            import json
            channels_config = json.loads(channels_config)
        
        # 转换为 NotificationChannel 枚举
        channels = []
        for ch in channels_config:
            try:
                channels.append(NotificationChannel(ch))
            except ValueError:
                pass
        
        # 获取用户渠道配置
        user_channel_config = self.user_channels.get(user_id, {})
        
        # 获取用户邮箱
        if NotificationChannel.EMAIL in channels:
            user_email = await self.get_user_email(user_id)
            if user_email:
                user_channel_config["user_email"] = user_email
        
        # 发送通知
        notification_result = await self.notifier.send_alert(
            channels=channels,
            alert_data=alert_data,
            user_channel_config=user_channel_config,
        )
        
        # 3. 记录历史
        await self._save_alert_history(rule, price_data, analysis, notification_result)
        
        # 4. 更新冷却时间
        self._update_cooldown(rule, symbol)
        
        # 5. 更新规则的 last_triggered_at
        await self._update_rule_triggered_at(rule.get("id"))
    
    async def _save_alert_history(
        self,
        rule: Dict,
        price_data: Dict,
        analysis: Dict,
        notification_result: Dict,
    ):
        """保存预警历史记录"""
        try:
            history_data = {
                "user_id": rule.get("user_id"),
                "rule_id": rule.get("id"),
                "symbol": price_data.get("symbol"),
                "alert_type": self._determine_alert_type(price_data),
                "triggered_price": price_data.get("price"),
                "change_percent": price_data.get("change_percent"),
                "volume": price_data.get("volume"),
                "market_session": price_data.get("session"),
                "ai_analysis": analysis,
                "ai_summary": analysis.get("summary"),
                "risk_level": analysis.get("risk_level"),
                "ai_suggestion": analysis.get("suggestion"),
                "channels_sent": notification_result.get("channels_sent", []),
                "channels_failed": notification_result.get("channels_failed", []),
            }
            
            self.supabase.table("stock_alert_history").insert(history_data).execute()
            
        except Exception as e:
            logger.error(f"保存预警历史失败: {e}")
    
    def _determine_alert_type(self, price_data: Dict) -> str:
        """判断预警类型"""
        change_percent = price_data.get("change_percent", 0)
        change_5min = price_data.get("change_5min", 0)
        session = price_data.get("session", "regular")
        
        if abs(change_5min) >= 3:
            return "PRICE_SPIKE_UP" if change_5min > 0 else "PRICE_SPIKE_DOWN"
        
        if session == "pre_market":
            return "PREMARKET_CHANGE"
        elif session == "after_hours":
            return "AFTERHOURS_CHANGE"
        else:
            return "DAILY_CHANGE"
    
    async def _update_rule_triggered_at(self, rule_id: str):
        """更新规则的最后触发时间"""
        try:
            self.supabase.table("stock_alert_rules").update({
                "last_triggered_at": datetime.utcnow().isoformat()
            }).eq("id", rule_id).execute()
        except Exception as e:
            logger.error(f"更新规则触发时间失败: {e}")
    
    # ==================== 服务启动/停止 ====================
    
    async def start(self):
        """启动预警服务"""
        if self._running:
            logger.warning("预警服务已在运行中")
            return
        
        logger.info("正在启动股票预警服务...")
        
        # 加载配置
        await self.load_alert_rules()
        await self.load_user_channels()
        
        if not self._symbols_to_monitor:
            logger.warning("没有需要监控的股票，服务将等待新规则")
        
        # 初始化 WebSocket 监控
        self.ws_monitor = FinnhubWebSocketMonitor()
        
        # 添加价格处理回调
        self.ws_monitor.add_callback(self._on_price_update)
        
        # 预加载前收盘价
        await self._preload_previous_close()
        
        # 启动 WebSocket (在后台线程)
        self._running = True
        
        if self._symbols_to_monitor:
            await self.ws_monitor.start_async(list(self._symbols_to_monitor))
        
        logger.info("股票预警服务已启动")
    
    def _on_price_update(self, price_data: Dict):
        """WebSocket 价格更新回调"""
        # 创建异步任务处理
        asyncio.create_task(self.process_price_update(price_data))
    
    async def _preload_previous_close(self):
        """预加载前收盘价 (用于计算日内涨跌幅)"""
        for symbol in self._symbols_to_monitor:
            try:
                quote = await self.finnhub_client.get_quote(symbol)
                previous_close = quote.get("previous_close")
                
                if previous_close and self.ws_monitor:
                    await self.ws_monitor.set_previous_close(symbol, previous_close)
                    
            except Exception as e:
                logger.error(f"获取 {symbol} 前收盘价失败: {e}")
    
    async def stop(self):
        """停止预警服务"""
        logger.info("正在停止股票预警服务...")
        
        self._running = False
        
        if self.ws_monitor:
            self.ws_monitor.stop()
            self.ws_monitor = None
        
        await self.finnhub_client.close()
        await self.ai_analyzer.close()
        await self.notifier.close()
        
        logger.info("股票预警服务已停止")
    
    async def add_symbol(self, symbol: str):
        """动态添加监控股票"""
        symbol = symbol.upper()
        self._symbols_to_monitor.add(symbol)
        
        if self.ws_monitor and self._running:
            self.ws_monitor.subscribe([symbol])
            
            # 加载前收盘价
            try:
                quote = await self.finnhub_client.get_quote(symbol)
                previous_close = quote.get("previous_close")
                if previous_close:
                    await self.ws_monitor.set_previous_close(symbol, previous_close)
            except Exception:
                pass
    
    async def remove_symbol(self, symbol: str):
        """动态移除监控股票"""
        symbol = symbol.upper()
        self._symbols_to_monitor.discard(symbol)
        
        if self.ws_monitor and self._running:
            self.ws_monitor.unsubscribe([symbol])
    
    async def reload_rules(self):
        """重新加载预警规则"""
        await self.load_alert_rules()
        await self.load_user_channels()
        
        # 更新 WebSocket 订阅
        if self.ws_monitor and self._running:
            current_symbols = self.ws_monitor.subscribed_symbols
            new_symbols = self._symbols_to_monitor - current_symbols
            removed_symbols = current_symbols - self._symbols_to_monitor
            
            if new_symbols:
                self.ws_monitor.subscribe(list(new_symbols))
            if removed_symbols:
                self.ws_monitor.unsubscribe(list(removed_symbols))


# 单例
_service_instance: Optional[StockAlertService] = None


def get_stock_alert_service() -> StockAlertService:
    """获取预警服务单例"""
    global _service_instance
    if _service_instance is None:
        _service_instance = StockAlertService()
    return _service_instance
