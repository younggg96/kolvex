"""
邮件服务 - 使用 Resend 发送邮件通知
"""

import logging
from typing import Optional, List, Dict, Any
import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """邮件服务类"""

    def __init__(self):
        self.api_key = settings.RESEND_API_KEY
        self.from_address = settings.EMAIL_FROM_ADDRESS
        self.enabled = settings.EMAIL_ENABLED and bool(self.api_key)
        
        if self.enabled:
            resend.api_key = self.api_key
            logger.info("📧 Email service initialized")
        else:
            logger.warning("📧 Email service is disabled (no API key or disabled in config)")

    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """
        发送单封邮件

        Args:
            to: 收件人邮箱
            subject: 邮件主题
            html_content: HTML 内容
            text_content: 纯文本内容（可选）

        Returns:
            是否发送成功
        """
        if not self.enabled:
            logger.debug(f"Email service disabled, skipping email to {to}")
            return False

        try:
            params: resend.Emails.SendParams = {
                "from": self.from_address,
                "to": [to],
                "subject": subject,
                "html": html_content,
            }
            
            if text_content:
                params["text"] = text_content

            email = resend.Emails.send(params)
            logger.info(f"✅ Email sent successfully to {to}, id: {email.get('id')}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to send email to {to}: {e}")
            return False

    async def send_bulk_emails(
        self,
        emails: List[Dict[str, Any]],
    ) -> int:
        """
        批量发送邮件

        Args:
            emails: 邮件列表，每项包含:
                - to: 收件人邮箱
                - subject: 邮件主题
                - html_content: HTML 内容

        Returns:
            成功发送的数量
        """
        if not self.enabled:
            logger.debug("Email service disabled, skipping bulk emails")
            return 0

        success_count = 0
        for email_data in emails:
            try:
                success = await self.send_email(
                    to=email_data["to"],
                    subject=email_data["subject"],
                    html_content=email_data["html_content"],
                    text_content=email_data.get("text_content"),
                )
                if success:
                    success_count += 1
            except Exception as e:
                logger.error(f"Failed to send bulk email: {e}")

        logger.info(f"📧 Bulk email sent: {success_count}/{len(emails)} successful")
        return success_count

    def generate_notification_email_html(
        self,
        username: str,
        notification_type: str,
        title: str,
        message: str,
        related_symbol: Optional[str] = None,
        related_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        生成通知邮件的 HTML 内容

        Args:
            username: 收件人用户名
            notification_type: 通知类型
            title: 通知标题
            message: 通知消息
            related_symbol: 相关股票代码
            related_data: 额外数据

        Returns:
            HTML 内容
        """
        # 根据通知类型选择图标和颜色
        type_config = {
            "POSITION_BUY": {"icon": "📈", "color": "#22c55e", "label": "New Position"},
            "POSITION_SELL": {"icon": "📉", "color": "#ef4444", "label": "Position Closed"},
            "POSITION_INCREASE": {"icon": "⬆️", "color": "#3b82f6", "label": "Position Increased"},
            "POSITION_DECREASE": {"icon": "⬇️", "color": "#f59e0b", "label": "Position Decreased"},
            "NEW_FOLLOWER": {"icon": "👤", "color": "#8b5cf6", "label": "New Follower"},
            "SYSTEM": {"icon": "🔔", "color": "#6b7280", "label": "System"},
        }
        
        config = type_config.get(notification_type, type_config["SYSTEM"])
        
        # 构建股票信息部分
        stock_info = ""
        if related_symbol:
            stock_info = f"""
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 12px; margin-top: 16px;">
                <div style="font-size: 14px; color: #6b7280;">Stock Symbol</div>
                <div style="font-size: 20px; font-weight: 600; color: #111827;">{related_symbol}</div>
            </div>
            """
        
        # 构建变化详情
        change_details = ""
        if related_data:
            units_change = related_data.get("units_change")
            price = related_data.get("price")
            if units_change or price:
                change_details = f"""
                <div style="display: flex; gap: 16px; margin-top: 12px;">
                    {f'<div style="flex: 1; background-color: #f3f4f6; border-radius: 8px; padding: 12px;"><div style="font-size: 12px; color: #6b7280;">Units Changed</div><div style="font-size: 16px; font-weight: 600; color: #111827;">{units_change}</div></div>' if units_change else ''}
                    {f'<div style="flex: 1; background-color: #f3f4f6; border-radius: 8px; padding: 12px;"><div style="font-size: 12px; color: #6b7280;">Current Price</div><div style="font-size: 16px; font-weight: 600; color: #111827;">${price:.2f}</div></div>' if price else ''}
                </div>
                """

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 32px;">
                    <div style="font-size: 24px; font-weight: 700; color: #111827;">Kolvex</div>
                    <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Portfolio Tracking & Insights</div>
                </div>
                
                <!-- Main Card -->
                <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px;">
                    <!-- Notification Type Badge -->
                    <div style="display: inline-block; background-color: {config['color']}20; color: {config['color']}; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px;">
                        {config['icon']} {config['label']}
                    </div>
                    
                    <!-- Title -->
                    <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #111827;">
                        {title}
                    </h1>
                    
                    <!-- Message -->
                    <p style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.5;">
                        {message}
                    </p>
                    
                    {stock_info}
                    {change_details}
                    
                    <!-- CTA Button -->
                    <div style="margin-top: 24px;">
                        <a href="https://kolvex.com/dashboard/notifications" 
                           style="display: inline-block; background-color: #111827; color: #ffffff; font-size: 14px; font-weight: 500; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
                            View in Kolvex
                        </a>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; margin-top: 32px; font-size: 12px; color: #9ca3af;">
                    <p style="margin: 0;">You're receiving this email because you enabled email notifications for followed users.</p>
                    <p style="margin: 8px 0 0 0;">
                        <a href="https://kolvex.com/dashboard/config" style="color: #6b7280; text-decoration: underline;">Manage notification settings</a>
                    </p>
                    <p style="margin: 16px 0 0 0;">© 2026 Kolvex. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        return html

    def generate_notification_email_text(
        self,
        username: str,
        notification_type: str,
        title: str,
        message: str,
        related_symbol: Optional[str] = None,
    ) -> str:
        """
        生成通知邮件的纯文本内容

        Args:
            username: 收件人用户名
            notification_type: 通知类型
            title: 通知标题
            message: 通知消息
            related_symbol: 相关股票代码

        Returns:
            纯文本内容
        """
        text = f"""
Hi {username or 'there'},

{title}

{message}
"""
        if related_symbol:
            text += f"\nStock Symbol: {related_symbol}"
        
        text += """

View this notification in Kolvex: https://kolvex.com/dashboard/notifications

---
You're receiving this email because you enabled email notifications for followed users.
Manage your notification settings: https://kolvex.com/dashboard/config

© 2026 Kolvex. All rights reserved.
"""
        return text


def get_email_service() -> EmailService:
    """获取邮件服务实例（用于 FastAPI 依赖注入）"""
    return EmailService()
