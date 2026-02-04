"""
股票预警 API Schemas
"""

from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


# ==================== 通知渠道 ====================

class NotificationChannelType(str, Enum):
    EMAIL = "email"
    DISCORD = "discord"
    TELEGRAM = "telegram"
    WECHAT = "wechat"
    WHATSAPP = "whatsapp"


# ==================== 预警规则 ====================

class AlertRuleCreate(BaseModel):
    """创建预警规则请求"""
    symbol: str = Field(..., min_length=1, max_length=20, description="股票代码")
    company_name: Optional[str] = Field(None, max_length=255, description="公司名称")
    
    # 预警阈值
    daily_change_threshold: float = Field(5.0, ge=0.1, le=50, description="日内涨跌幅阈值(%)")
    spike_change_threshold: float = Field(3.0, ge=0.1, le=20, description="短时急涨急跌阈值(%)")
    price_above: Optional[float] = Field(None, ge=0, description="价格突破上限")
    price_below: Optional[float] = Field(None, ge=0, description="价格跌破下限")
    volume_surge_multiplier: float = Field(3.0, ge=1, le=20, description="成交量异常倍数")
    
    # 监控时段
    premarket_enabled: bool = Field(True, description="是否监控盘前")
    regular_hours_enabled: bool = Field(True, description="是否监控盘中")
    afterhours_enabled: bool = Field(True, description="是否监控盘后")
    
    # 通知配置
    channels: List[NotificationChannelType] = Field(
        default=["email"],
        description="通知渠道列表"
    )
    ai_analysis_enabled: bool = Field(True, description="是否启用 AI 分析")
    cooldown_minutes: int = Field(30, ge=5, le=1440, description="通知冷却时间(分钟)")


class AlertRuleUpdate(BaseModel):
    """更新预警规则请求"""
    daily_change_threshold: Optional[float] = Field(None, ge=0.1, le=50)
    spike_change_threshold: Optional[float] = Field(None, ge=0.1, le=20)
    price_above: Optional[float] = Field(None, ge=0)
    price_below: Optional[float] = Field(None, ge=0)
    volume_surge_multiplier: Optional[float] = Field(None, ge=1, le=20)
    
    premarket_enabled: Optional[bool] = None
    regular_hours_enabled: Optional[bool] = None
    afterhours_enabled: Optional[bool] = None
    
    channels: Optional[List[NotificationChannelType]] = None
    ai_analysis_enabled: Optional[bool] = None
    cooldown_minutes: Optional[int] = Field(None, ge=5, le=1440)
    
    is_active: Optional[bool] = None


class AlertRuleResponse(BaseModel):
    """预警规则响应"""
    id: str
    user_id: str
    symbol: str
    company_name: Optional[str] = None
    
    daily_change_threshold: float
    spike_change_threshold: float
    price_above: Optional[float] = None
    price_below: Optional[float] = None
    volume_surge_multiplier: float
    
    premarket_enabled: bool
    regular_hours_enabled: bool
    afterhours_enabled: bool
    
    channels: List[str]
    ai_analysis_enabled: bool
    cooldown_minutes: int
    
    is_active: bool
    last_triggered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AlertRulesListResponse(BaseModel):
    """预警规则列表响应"""
    rules: List[AlertRuleResponse]
    total: int


# ==================== 通知渠道配置 ====================

class ChannelConfigCreate(BaseModel):
    """创建通知渠道配置"""
    channel_type: NotificationChannelType
    
    # Discord
    discord_webhook_url: Optional[str] = None
    
    # Telegram
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    
    # 微信
    wechat_webhook_url: Optional[str] = None
    
    # WhatsApp
    whatsapp_phone_number: Optional[str] = None


class ChannelConfigUpdate(BaseModel):
    """更新通知渠道配置"""
    discord_webhook_url: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    wechat_webhook_url: Optional[str] = None
    whatsapp_phone_number: Optional[str] = None


class ChannelConfigResponse(BaseModel):
    """通知渠道配置响应"""
    id: str
    user_id: str
    channel_type: str
    
    discord_webhook_url: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    wechat_webhook_url: Optional[str] = None
    whatsapp_phone_number: Optional[str] = None
    
    is_verified: bool
    verified_at: Optional[datetime] = None
    created_at: datetime


class ChannelConfigsListResponse(BaseModel):
    """通知渠道配置列表响应"""
    channels: List[ChannelConfigResponse]
    total: int


# ==================== 预警历史 ====================

class AlertHistoryResponse(BaseModel):
    """预警历史响应"""
    id: str
    user_id: str
    rule_id: Optional[str] = None
    symbol: str
    alert_type: str
    
    triggered_price: float
    previous_price: Optional[float] = None
    change_percent: float
    volume: Optional[int] = None
    market_session: Optional[str] = None
    
    ai_summary: Optional[str] = None
    risk_level: Optional[str] = None
    ai_suggestion: Optional[str] = None
    
    channels_sent: List[str] = []
    channels_failed: List[Any] = []
    
    triggered_at: datetime
    created_at: datetime


class AlertHistoryListResponse(BaseModel):
    """预警历史列表响应"""
    history: List[AlertHistoryResponse]
    total: int


# ==================== 测试 ====================

class TestAlertRequest(BaseModel):
    """测试预警请求"""
    symbol: str
    channels: List[NotificationChannelType] = ["email"]
    test_message: Optional[str] = None


class TestAlertResponse(BaseModel):
    """测试预警响应"""
    success: bool
    channels_sent: List[str] = []
    channels_failed: List[Any] = []
    message: str


# ==================== 通用响应 ====================

class MessageResponse(BaseModel):
    """通用消息响应"""
    success: bool
    message: str
