"""
多渠道通知服务
支持 Discord、Telegram、微信企业号、WhatsApp、邮件等多种通知渠道
"""

import os
import asyncio
import logging
from typing import Dict, List, Optional, Any
from enum import Enum
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)


class NotificationChannel(str, Enum):
    """通知渠道类型"""
    EMAIL = "email"
    DISCORD = "discord"
    TELEGRAM = "telegram"
    WECHAT = "wechat"
    WHATSAPP = "whatsapp"


class MultiChannelNotifier:
    """
    多渠道通知分发器
    
    支持的渠道:
    - Email: 使用现有的 email_service
    - Discord: Webhook (免费)
    - Telegram: Bot API (免费)
    - 微信企业号: Webhook (免费)
    - WhatsApp: Twilio API (付费)
    """
    
    def __init__(self, config: Optional[Dict[str, str]] = None):
        """
        初始化通知器
        
        Args:
            config: 渠道配置字典，包含各渠道的 API Key、Webhook URL 等
        """
        self.config = config or {}
        self._client = httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        """关闭客户端"""
        await self._client.aclose()
    
    async def send_alert(
        self,
        channels: List[NotificationChannel],
        alert_data: Dict[str, Any],
        user_channel_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        向多个渠道发送预警通知
        
        Args:
            channels: 要发送的渠道列表
            alert_data: 预警数据
            user_channel_config: 用户的渠道配置 (从数据库读取)
            
        Returns:
            {
                "success": bool,
                "channels_sent": ["discord", "telegram"],
                "channels_failed": [{"channel": "email", "error": "..."}],
            }
        """
        config = {**self.config, **(user_channel_config or {})}
        
        tasks = []
        channel_names = []
        
        for channel in channels:
            if channel == NotificationChannel.DISCORD:
                tasks.append(self._send_discord(alert_data, config))
            elif channel == NotificationChannel.TELEGRAM:
                tasks.append(self._send_telegram(alert_data, config))
            elif channel == NotificationChannel.WECHAT:
                tasks.append(self._send_wechat(alert_data, config))
            elif channel == NotificationChannel.WHATSAPP:
                tasks.append(self._send_whatsapp(alert_data, config))
            elif channel == NotificationChannel.EMAIL:
                tasks.append(self._send_email(alert_data, config))
            else:
                continue
            channel_names.append(channel.value)
        
        # 并行发送所有通知
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 统计结果
        channels_sent = []
        channels_failed = []
        
        for channel_name, result in zip(channel_names, results):
            if isinstance(result, Exception):
                channels_failed.append({
                    "channel": channel_name,
                    "error": str(result)
                })
            elif isinstance(result, dict):
                if result.get("success"):
                    channels_sent.append(channel_name)
                else:
                    channels_failed.append({
                        "channel": channel_name,
                        "error": result.get("error", "Unknown error")
                    })
        
        return {
            "success": len(channels_sent) > 0,
            "channels_sent": channels_sent,
            "channels_failed": channels_failed,
        }
    
    # ==================== Discord (免费) ====================
    
    async def _send_discord(self, alert_data: Dict, config: Dict) -> Dict:
        """发送 Discord Webhook 通知"""
        webhook_url = config.get("discord_webhook_url")
        
        if not webhook_url:
            return {"success": False, "error": "Discord Webhook URL 未配置"}
        
        try:
            symbol = alert_data.get("symbol", "N/A")
            price = alert_data.get("price", 0)
            change_percent = alert_data.get("change_percent", 0)
            risk_level = alert_data.get("risk_level", "未知")
            summary = alert_data.get("summary", "")
            suggestion = alert_data.get("suggestion", "")
            session = alert_data.get("session", "regular")
            
            # 颜色: 绿色=上涨, 红色=下跌
            color = 0x00FF00 if change_percent >= 0 else 0xFF0000
            
            # 交易时段中文
            session_names = {
                "pre_market": "🌅 盘前",
                "regular": "📈 盘中",
                "after_hours": "🌙 盘后",
            }
            session_text = session_names.get(session, session)
            
            embed = {
                "title": f"🚨 {symbol} 价格预警",
                "description": summary,
                "color": color,
                "fields": [
                    {"name": "💰 当前价格", "value": f"${price:.2f}", "inline": True},
                    {"name": "📊 涨跌幅", "value": f"{change_percent:+.2f}%", "inline": True},
                    {"name": "⚠️ 风险等级", "value": risk_level, "inline": True},
                    {"name": "🕐 交易时段", "value": session_text, "inline": True},
                    {"name": "💡 建议", "value": suggestion or "暂无", "inline": False},
                ],
                "footer": {"text": f"Kolvex 股票预警 • {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"},
            }
            
            payload = {"embeds": [embed]}
            
            response = await self._client.post(webhook_url, json=payload)
            
            if response.status_code == 204:
                return {"success": True}
            else:
                return {"success": False, "error": f"HTTP {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Discord 通知发送失败: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Telegram (免费) ====================
    
    async def _send_telegram(self, alert_data: Dict, config: Dict) -> Dict:
        """发送 Telegram Bot 消息"""
        bot_token = config.get("telegram_bot_token")
        chat_id = config.get("telegram_chat_id")
        
        if not bot_token or not chat_id:
            return {"success": False, "error": "Telegram 配置不完整"}
        
        try:
            symbol = alert_data.get("symbol", "N/A")
            price = alert_data.get("price", 0)
            change_percent = alert_data.get("change_percent", 0)
            risk_level = alert_data.get("risk_level", "未知")
            summary = alert_data.get("summary", "")
            suggestion = alert_data.get("suggestion", "")
            session = alert_data.get("session", "regular")
            reason = alert_data.get("reason", "")
            
            emoji = "📈" if change_percent >= 0 else "📉"
            
            session_names = {
                "pre_market": "🌅 盘前",
                "regular": "📊 盘中",
                "after_hours": "🌙 盘后",
            }
            session_text = session_names.get(session, session)
            
            message = f"""
{emoji} *{symbol} 价格预警*

💰 当前价格: `${price:.2f}`
📊 涨跌幅: `{change_percent:+.2f}%`
⚠️ 风险等级: *{risk_level}*
🕐 交易时段: {session_text}

📝 *分析:*
{summary}

💡 *建议:* {suggestion}

🔍 *可能原因:* {reason}

_Kolvex 股票预警系统_
"""
            
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "Markdown",
            }
            
            response = await self._client.post(url, json=payload)
            data = response.json()
            
            if data.get("ok"):
                return {"success": True}
            else:
                return {"success": False, "error": data.get("description", "Unknown error")}
                
        except Exception as e:
            logger.error(f"Telegram 通知发送失败: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== 微信企业号 (免费) ====================
    
    async def _send_wechat(self, alert_data: Dict, config: Dict) -> Dict:
        """发送微信企业号/钉钉 Webhook 消息"""
        webhook_url = config.get("wechat_webhook_url")
        
        if not webhook_url:
            return {"success": False, "error": "微信 Webhook URL 未配置"}
        
        try:
            symbol = alert_data.get("symbol", "N/A")
            price = alert_data.get("price", 0)
            change_percent = alert_data.get("change_percent", 0)
            risk_level = alert_data.get("risk_level", "未知")
            summary = alert_data.get("summary", "")
            suggestion = alert_data.get("suggestion", "")
            session = alert_data.get("session", "regular")
            
            emoji = "📈" if change_percent >= 0 else "📉"
            color = "info" if change_percent >= 0 else "warning"
            
            session_names = {
                "pre_market": "盘前",
                "regular": "盘中",
                "after_hours": "盘后",
            }
            session_text = session_names.get(session, session)
            
            # 企业微信 Markdown 格式
            payload = {
                "msgtype": "markdown",
                "markdown": {
                    "content": f"""
{emoji} **{symbol} 价格预警**

> 💰 当前价格: <font color="{color}">${price:.2f}</font>
> 📊 涨跌幅: <font color="{color}">{change_percent:+.2f}%</font>
> ⚠️ 风险等级: **{risk_level}**
> 🕐 交易时段: {session_text}

**分析:** {summary}

**建议:** {suggestion}
"""
                }
            }
            
            response = await self._client.post(webhook_url, json=payload)
            data = response.json()
            
            if data.get("errcode") == 0:
                return {"success": True}
            else:
                return {"success": False, "error": data.get("errmsg", "Unknown error")}
                
        except Exception as e:
            logger.error(f"微信通知发送失败: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== WhatsApp via Twilio (付费) ====================
    
    async def _send_whatsapp(self, alert_data: Dict, config: Dict) -> Dict:
        """发送 WhatsApp 消息 (通过 Twilio)"""
        account_sid = config.get("twilio_account_sid") or os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = config.get("twilio_auth_token") or os.getenv("TWILIO_AUTH_TOKEN")
        from_number = config.get("twilio_whatsapp_from") or os.getenv("TWILIO_WHATSAPP_FROM")
        to_number = config.get("whatsapp_phone_number")
        
        if not all([account_sid, auth_token, from_number, to_number]):
            return {"success": False, "error": "WhatsApp/Twilio 配置不完整"}
        
        try:
            symbol = alert_data.get("symbol", "N/A")
            price = alert_data.get("price", 0)
            change_percent = alert_data.get("change_percent", 0)
            risk_level = alert_data.get("risk_level", "未知")
            summary = alert_data.get("summary", "")
            suggestion = alert_data.get("suggestion", "")
            
            emoji = "📈" if change_percent >= 0 else "📉"
            
            message = f"""
{emoji} {symbol} 价格预警

💰 价格: ${price:.2f}
📊 涨跌: {change_percent:+.2f}%
⚠️ 风险: {risk_level}

{summary}

💡 {suggestion}
"""
            
            # Twilio API
            url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
            
            auth = (account_sid, auth_token)
            data = {
                "From": f"whatsapp:{from_number}",
                "To": f"whatsapp:{to_number}",
                "Body": message.strip(),
            }
            
            response = await self._client.post(url, auth=auth, data=data)
            
            if response.status_code in [200, 201]:
                result = response.json()
                return {"success": True, "message_sid": result.get("sid")}
            else:
                return {"success": False, "error": f"HTTP {response.status_code}"}
                
        except Exception as e:
            logger.error(f"WhatsApp 通知发送失败: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Email (使用现有服务) ====================
    
    async def _send_email(self, alert_data: Dict, config: Dict) -> Dict:
        """发送邮件通知"""
        try:
            from app.services.email_service import get_email_service
            
            email_service = get_email_service()
            to_email = config.get("user_email")
            
            if not to_email:
                return {"success": False, "error": "用户邮箱未配置"}
            
            symbol = alert_data.get("symbol", "N/A")
            price = alert_data.get("price", 0)
            change_percent = alert_data.get("change_percent", 0)
            risk_level = alert_data.get("risk_level", "未知")
            summary = alert_data.get("summary", "")
            suggestion = alert_data.get("suggestion", "")
            reason = alert_data.get("reason", "")
            session = alert_data.get("session", "regular")
            
            emoji = "📈" if change_percent >= 0 else "📉"
            color = "#00C853" if change_percent >= 0 else "#FF5252"
            
            session_names = {
                "pre_market": "盘前交易",
                "regular": "常规交易",
                "after_hours": "盘后交易",
            }
            session_text = session_names.get(session, session)
            
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; }}
        .price {{ font-size: 32px; color: {color}; font-weight: bold; }}
        .change {{ font-size: 24px; color: {color}; }}
        .info-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }}
        .label {{ color: #666; }}
        .value {{ font-weight: 500; }}
        .analysis {{ background: white; padding: 15px; border-radius: 8px; margin-top: 15px; }}
        .suggestion {{ background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #2196F3; }}
        .footer {{ text-align: center; color: #999; font-size: 12px; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>{emoji} {symbol} 价格预警</h2>
        </div>
        <div class="content">
            <div style="text-align: center; margin-bottom: 20px;">
                <div class="price">${price:.2f}</div>
                <div class="change">{change_percent:+.2f}%</div>
            </div>
            
            <div class="info-row">
                <span class="label">⚠️ 风险等级</span>
                <span class="value">{risk_level}</span>
            </div>
            <div class="info-row">
                <span class="label">🕐 交易时段</span>
                <span class="value">{session_text}</span>
            </div>
            
            <div class="analysis">
                <h4>📝 AI 分析</h4>
                <p>{summary}</p>
                <p><strong>可能原因:</strong> {reason}</p>
            </div>
            
            <div class="suggestion">
                <h4>💡 建议</h4>
                <p>{suggestion}</p>
            </div>
        </div>
        <div class="footer">
            <p>此邮件由 Kolvex 股票预警系统自动发送</p>
            <p>{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
        </div>
    </div>
</body>
</html>
"""
            
            subject = f"🚨 {symbol} 价格预警 ({change_percent:+.2f}%)"
            
            success, error = await email_service.send_email(
                to=to_email,
                subject=subject,
                html_content=html_content,
            )
            
            if success:
                return {"success": True}
            else:
                return {"success": False, "error": error or "发送失败"}
                
        except Exception as e:
            logger.error(f"邮件通知发送失败: {e}")
            return {"success": False, "error": str(e)}


# 单例
_notifier_instance: Optional[MultiChannelNotifier] = None


def get_multi_channel_notifier() -> MultiChannelNotifier:
    """获取通知器单例"""
    global _notifier_instance
    if _notifier_instance is None:
        _notifier_instance = MultiChannelNotifier()
    return _notifier_instance
