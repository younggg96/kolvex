"""
Email Service - Send email notifications using Resend
"""

import logging
import asyncio
from typing import Optional, List, Dict, Any, Tuple
import resend

from app.core.config import settings

logger = logging.getLogger(__name__)

# Resend rate limit: 2 emails per second for free plan
EMAIL_SEND_DELAY = 0.55  # 550ms delay between emails (slightly more than 1/2 second)
EMAIL_RETRY_DELAY = 1.5  # Wait longer before retry on rate limit
EMAIL_MAX_RETRIES = 3  # Maximum retry attempts for rate limited requests


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
            logger.warning(
                "📧 Email service is disabled (no API key or disabled in config)"
            )

    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        with_delay: bool = False,
        retry_on_rate_limit: bool = True,
    ) -> Tuple[bool, Optional[str]]:
        """
        Send a single email with rate limit retry support

        Args:
            to: Recipient email address
            subject: Email subject
            html_content: HTML content
            text_content: Plain text content (optional)
            with_delay: Whether to add delay after sending (for rate limiting)
            retry_on_rate_limit: Whether to retry on rate limit errors

        Returns:
            Tuple of (success, error_message)
        """
        if not self.enabled:
            logger.debug(f"Email service disabled, skipping email to {to}")
            return False, "Email service is disabled"

        params: resend.Emails.SendParams = {
            "from": self.from_address,
            "to": [to],
            "subject": subject,
            "html": html_content,
        }

        if text_content:
            params["text"] = text_content

        retries = 0
        max_retries = EMAIL_MAX_RETRIES if retry_on_rate_limit else 1

        while retries < max_retries:
            try:
                email = resend.Emails.send(params)
                logger.info(
                    f"✅ Email sent successfully to {to}, id: {email.get('id')}"
                )

                # Add delay to avoid rate limiting when sending multiple emails
                if with_delay:
                    await asyncio.sleep(EMAIL_SEND_DELAY)

                return True, None

            except resend.exceptions.ResendError as e:
                error_str = str(e)
                is_rate_limit = (
                    "rate" in error_str.lower() or "too many" in error_str.lower()
                )

                if is_rate_limit and retry_on_rate_limit and retries < max_retries - 1:
                    retries += 1
                    wait_time = EMAIL_RETRY_DELAY * retries  # Exponential backoff
                    logger.warning(
                        f"⏳ Rate limited sending to {to}, retry {retries}/{max_retries - 1} after {wait_time}s"
                    )
                    await asyncio.sleep(wait_time)
                    continue

                error_msg = f"Resend API error: {error_str}"
                logger.error(f"❌ Failed to send email to {to}: {error_msg}")
                return False, error_msg

            except Exception as e:
                error_msg = str(e)
                logger.error(f"❌ Failed to send email to {to}: {error_msg}")
                return False, error_msg

        return False, "Max retries exceeded"

    async def send_bulk_emails(
        self,
        emails: List[Dict[str, Any]],
    ) -> int:
        """
        批量发送邮件（带速率限制）

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
        total = len(emails)

        logger.info(f"📧 Starting bulk email send: {total} emails (with rate limiting)")

        for i, email_data in enumerate(emails):
            try:
                # Add delay BEFORE sending to ensure rate limit compliance
                # (except for the first email)
                if i > 0:
                    await asyncio.sleep(EMAIL_SEND_DELAY)

                success, error = await self.send_email(
                    to=email_data["to"],
                    subject=email_data["subject"],
                    html_content=email_data["html_content"],
                    text_content=email_data.get("text_content"),
                    with_delay=False,  # We handle delay manually above
                    retry_on_rate_limit=True,
                )
                if success:
                    success_count += 1
            except Exception as e:
                logger.error(
                    f"Failed to send bulk email to {email_data.get('to')}: {e}"
                )

        logger.info(f"📧 Bulk email completed: {success_count}/{total} successful")
        return success_count

    def _get_notification_icon_svg(self, notification_type: str, color: str) -> str:
        """
        获取通知类型对应的 SVG 图标

        Args:
            notification_type: 通知类型
            color: 图标颜色

        Returns:
            SVG HTML 字符串
        """
        icons = {
            "POSITION_BUY": f"""<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>""",
            "POSITION_SELL": f"""<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>""",
            "POSITION_INCREASE": f"""<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>""",
            "POSITION_DECREASE": f"""<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>""",
            "NEW_FOLLOWER": f"""<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>""",
            "SYSTEM": f"""<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>""",
        }
        return icons.get(notification_type, icons["SYSTEM"])

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
        # 根据通知类型选择颜色 - 绿色(正面) / 红色(负面)
        type_config = {
            "POSITION_BUY": {"color": "#00C805", "bg": "#00C80515", "label": "Buy"},
            "POSITION_SELL": {"color": "#ef4444", "bg": "#ef444415", "label": "Sell"},
            "POSITION_INCREASE": {
                "color": "#00C805",
                "bg": "#00C80515",
                "label": "Add",
            },
            "POSITION_DECREASE": {
                "color": "#ef4444",
                "bg": "#ef444415",
                "label": "Reduce",
            },
            "NEW_FOLLOWER": {"color": "#00C805", "bg": "#00C80515", "label": "Follow"},
            "SYSTEM": {"color": "#00C805", "bg": "#00C80515", "label": "System"},
        }

        config = type_config.get(notification_type, type_config["SYSTEM"])
        icon_svg = self._get_notification_icon_svg(notification_type, config["color"])

        # 构建股票信息部分 - Dark theme style
        stock_info = ""
        if related_symbol:
            # 获取 position_type 和 is_option 信息
            position_type = ""
            is_option = False
            if related_data:
                position_type = related_data.get("position_type", "")  # LONG / SHORT
                is_option = related_data.get("is_option", False)

            # 构建标签 badges
            badges_html = ""
            if position_type or is_option:
                badge_items = ""
                if position_type:
                    # Long = 绿色, Short = 红色
                    is_short = position_type.upper() == "SHORT"
                    badge_color = "#ef4444" if is_short else "#00C805"
                    badge_bg = "#ef444415" if is_short else "#00C80515"
                    badge_label = "Short" if is_short else "Long"
                    badge_items += f"""
                        <td style="background-color: {badge_bg}; border: 1px solid {badge_color}30; border-radius: 4px; padding: 3px 8px; margin-right: 6px;">
                            <span style="font-size: 10px; font-weight: 600; color: {badge_color}; text-transform: uppercase; letter-spacing: 0.3px;">{badge_label}</span>
                        </td>
                        <td style="width: 6px;"></td>
                    """
                if is_option:
                    badge_items += f"""
                        <td style="background-color: #a855f715; border: 1px solid #a855f730; border-radius: 4px; padding: 3px 8px;">
                            <span style="font-size: 10px; font-weight: 600; color: #a855f7; text-transform: uppercase; letter-spacing: 0.3px;">Option</span>
                        </td>
                    """
                badges_html = f"""
                            <tr>
                                <td style="padding-top: 8px;">
                                    <table cellpadding="0" cellspacing="0" border="0">
                                        <tr>{badge_items}</tr>
                                    </table>
                                </td>
                            </tr>
                """

            stock_info = f"""
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px;">
                <tr>
                    <td style="background-color: #0a0e0f; border: 1px solid #2a2d2f; border-radius: 10px; padding: 14px;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                                <td style="font-size: 11px; color: #6b7280; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">Stock Symbol</td>
                            </tr>
                            <tr>
                                <td style="font-size: 22px; font-weight: 700; color: #00C805; padding-top: 4px; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">${related_symbol}</td>
                            </tr>
                            {badges_html}
                        </table>
                    </td>
                </tr>
            </table>
            """

        # 构建变化详情 - Dark theme style
        change_details = ""
        if related_data:
            price = related_data.get("price")
            if price:
                change_details = f"""
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 12px;">
                    <tr>
                        <td style="background-color: #0a0e0f; border: 1px solid #2a2d2f; border-radius: 8px; padding: 12px; vertical-align: top;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr><td style="font-size: 10px; color: #6b7280; font-weight: 500; letter-spacing: 0.3px; text-transform: uppercase;">Current Price</td></tr>
                                <tr><td style="font-size: 16px; font-weight: 600; color: #e5e7eb; padding-top: 4px;">${price:.2f}</td></tr>
                            </table>
                        </td>
                    </tr>
                </table>
                """

        # Kolvex Logo SVG - matches LogoIcon.tsx
        logo_svg = """<svg xmlns="http://www.w3.org/2000/svg" height="28" viewBox="0 -960 960 960" width="28" fill="#00C805"><path d="M280-160v-90h-80v-460h80v-90h60v90h80v460h-80v90h-60Zm-20-150h100v-340H260v340Zm360 150v-210h-80v-260h80v-170h60v170h80v260h-80v210h-60Zm-20-270h100v-140H600v140Zm-290-50Zm340-20Z"/></svg>"""

        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>Kolvex Notification</title>
            <!--[if mso]>
            <style type="text/css">
                body, table, td {{font-family: Arial, Helvetica, sans-serif !important;}}
            </style>
            <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0e0f; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
            <!-- Dark gradient background wrapper -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(180deg, #0a0e0f 0%, #111518 100%); min-height: 100vh;">
                <tr>
                    <td align="center" style="padding: 40px 16px 60px 16px;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 480px;">
                            
                            <!-- Header with Logo -->
                            <tr>
                                <td align="center" style="padding-bottom: 28px;">
                                    <table cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td style="vertical-align: middle;">
                                                {logo_svg}
                                            </td>
                                            <td style="padding-left: 8px; vertical-align: middle;">
                                                <span style="font-size: 20px; font-weight: 700; color: #e5e7eb; letter-spacing: -0.5px;">Kolvex</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- Main Card -->
                            <tr>
                                <td style="background-color: #1a1d1f; border-radius: 16px; border: 1px solid #2a2d2f; overflow: hidden;">
                                    
                                    <!-- Top accent gradient line -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                        <tr>
                                            <td style="height: 2px; background: linear-gradient(90deg, {config['color']} 0%, {config['color']}40 100%);"></td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Card Content -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 24px;">
                                        <tr>
                                            <td>
                                                <!-- Badge Row -->
                                                <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                                                    <tr>
                                                        <td style="background-color: {config['bg']}; border-radius: 6px; padding: 6px 12px; border: 1px solid {config['color']}20;">
                                                            <table cellpadding="0" cellspacing="0" border="0">
                                                                <tr>
                                                                    <td style="vertical-align: middle; padding-right: 6px;">{icon_svg}</td>
                                                                    <td style="vertical-align: middle; font-size: 12px; font-weight: 600; color: {config['color']}; letter-spacing: 0.3px; text-transform: uppercase;">{config['label']}</td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </table>
                                                
                                                <!-- Title -->
                                                <h1 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #e5e7eb; line-height: 1.4; letter-spacing: -0.3px;">
                                                    {title}
                                                </h1>
                                                
                                                <!-- Message -->
                                                <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.6;">
                                                    {message}
                                                </p>
                                                
                                                {stock_info}
                                                {change_details}
                                                
                                                <!-- CTA Button -->
                                                <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
                                                    <tr>
                                                        <td style="background-color: #00C805; border-radius: 8px;">
                                                            <a href="https://kolvex.app/dashboard/notifications" 
                                                               style="display: inline-block; color: #ffffff; font-size: 13px; font-weight: 600; padding: 12px 24px; text-decoration: none; letter-spacing: 0.2px;">
                                                                View in Kolvex →
                                                            </a>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="padding-top: 28px; text-align: center;">
                                    <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                                        You're receiving this because you enabled email notifications.
                                    </p>
                                    <p style="margin: 10px 0 0 0;">
                                        <a href="https://kolvex.app/dashboard/config" style="font-size: 12px; color: #9ca3af; text-decoration: none; border-bottom: 1px solid #4b5563;">Manage settings</a>
                                    </p>
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 20px;">
                                        <tr>
                                            <td style="text-align: center;">
                                                <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                                                    <tr>
                                                        <td style="border-top: 1px solid #2a2d2f; padding-top: 16px;">
                                                            <span style="font-size: 11px; color: #4b5563;">© 2026 Kolvex · All rights reserved</span>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                        </table>
                    </td>
                </tr>
            </table>
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
        Generate plain text content for notification email

        Args:
            username: Recipient username
            notification_type: Notification type
            title: Notification title
            message: Notification message
            related_symbol: Related stock symbol

        Returns:
            Plain text content
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

    def generate_digest_email_html(
        self,
        username: str,
        notifications: List[Dict[str, Any]],
    ) -> str:
        """
        Generate HTML content for digest email containing multiple notifications

        Args:
            username: Recipient username
            notifications: List of notification data dictionaries

        Returns:
            HTML content
        """
        type_config = {
            "POSITION_BUY": {"color": "#00C805", "bg": "#00C80515", "label": "Buy"},
            "POSITION_SELL": {"color": "#ef4444", "bg": "#ef444415", "label": "Sell"},
            "POSITION_INCREASE": {
                "color": "#00C805",
                "bg": "#00C80515",
                "label": "Add",
            },
            "POSITION_DECREASE": {
                "color": "#ef4444",
                "bg": "#ef444415",
                "label": "Reduce",
            },
            "NEW_FOLLOWER": {"color": "#00C805", "bg": "#00C80515", "label": "Follow"},
            "SYSTEM": {"color": "#00C805", "bg": "#00C80515", "label": "System"},
        }

        # Build notification items
        notification_items = ""
        for notif in notifications:
            notif_type = notif.get("type", "SYSTEM")
            config = type_config.get(notif_type, type_config["SYSTEM"])
            icon_svg = self._get_notification_icon_svg(notif_type, config["color"])
            title = notif.get("title", "Notification")
            message = notif.get("message", "")
            related_symbol = notif.get("related_symbol", "")
            related_data = notif.get("related_data", {}) or {}
            position_type = related_data.get("position_type", "")
            is_option = related_data.get("is_option", False)

            # 构建 symbol 和 position/option 标签
            symbol_badge = ""
            if related_symbol:
                symbol_badge = f"""
                <td style="padding-left: 8px;">
                    <span style="background-color: #0a0e0f; color: #00C805; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 5px; border: 1px solid #2a2d2f;">${related_symbol}</span>
                </td>
                """

            # 构建 Long/Short 和 Option 标签
            position_badges = ""
            if position_type:
                is_short = position_type.upper() == "SHORT"
                pos_color = "#ef4444" if is_short else "#00C805"
                pos_bg = "#ef444415" if is_short else "#00C80515"
                pos_label = "Short" if is_short else "Long"
                position_badges += f"""
                <td style="padding-left: 6px;">
                    <span style="background-color: {pos_bg}; color: {pos_color}; font-size: 10px; font-weight: 600; padding: 3px 6px; border-radius: 4px; border: 1px solid {pos_color}30;">{pos_label}</span>
                </td>
                """
            if is_option:
                position_badges += f"""
                <td style="padding-left: 6px;">
                    <span style="background-color: #a855f715; color: #a855f7; font-size: 10px; font-weight: 600; padding: 3px 6px; border-radius: 4px; border: 1px solid #a855f730;">Option</span>
                </td>
                """

            notification_items += f"""
            <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #2a2d2f;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                            <td>
                                <!-- Badge, Symbol, and Position Tags -->
                                <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                                    <tr>
                                        <td style="background-color: {config['bg']}; border-radius: 5px; padding: 4px 8px; border: 1px solid {config['color']}20;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td style="vertical-align: middle; padding-right: 5px;">{icon_svg}</td>
                                                    <td style="vertical-align: middle; font-size: 11px; font-weight: 600; color: {config['color']}; text-transform: uppercase;">{config['label']}</td>
                                                </tr>
                                            </table>
                                        </td>
                                        {symbol_badge}
                                        {position_badges}
                                    </tr>
                                </table>
                                <!-- Title -->
                                <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #e5e7eb; line-height: 1.4;">
                                    {title}
                                </p>
                                <!-- Message -->
                                <p style="margin: 0; font-size: 13px; color: #9ca3af; line-height: 1.5;">
                                    {message}
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            """

        # Kolvex Logo SVG - matches LogoIcon.tsx
        logo_svg = """<svg xmlns="http://www.w3.org/2000/svg" height="28" viewBox="0 -960 960 960" width="28" fill="#00C805"><path d="M280-160v-90h-80v-460h80v-90h60v90h80v460h-80v90h-60Zm-20-150h100v-340H260v340Zm360 150v-210h-80v-260h80v-170h60v170h80v260h-80v210h-60Zm-20-270h100v-140H600v140Zm-290-50Zm340-20Z"/></svg>"""

        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>Kolvex Notifications Digest</title>
            <!--[if mso]>
            <style type="text/css">
                body, table, td {{font-family: Arial, Helvetica, sans-serif !important;}}
            </style>
            <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0e0f; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased;">
            <!-- Dark gradient background wrapper -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(180deg, #0a0e0f 0%, #111518 100%); min-height: 100vh;">
                <tr>
                    <td align="center" style="padding: 40px 16px 60px 16px;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 500px;">
                            
                            <!-- Header with Logo -->
                            <tr>
                                <td align="center" style="padding-bottom: 28px;">
                                    <table cellpadding="0" cellspacing="0" border="0">
                                        <tr>
                                            <td style="vertical-align: middle;">
                                                {logo_svg}
                                            </td>
                                            <td style="padding-left: 8px; vertical-align: middle;">
                                                <span style="font-size: 20px; font-weight: 700; color: #e5e7eb; letter-spacing: -0.5px;">Kolvex</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- Main Card -->
                            <tr>
                                <td style="background-color: #1a1d1f; border-radius: 16px; border: 1px solid #2a2d2f; overflow: hidden;">
                                    
                                    <!-- Top accent gradient line -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                        <tr>
                                            <td style="height: 2px; background: linear-gradient(90deg, #00C805 0%, #00C80540 100%);"></td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Card Content -->
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 24px;">
                                        <tr>
                                            <td>
                                                <!-- Header -->
                                                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;">
                                                    <tr>
                                                        <td>
                                                            <h1 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 700; color: #e5e7eb; letter-spacing: -0.3px;">
                                                                Hi {username or 'there'} 👋
                                                            </h1>
                                                            <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                                                                You have <strong style="color: #00C805;">{len(notifications)}</strong> new notifications
                                                            </p>
                                                        </td>
                                                    </tr>
                                                </table>
                                                
                                                <!-- Notifications List -->
                                                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                    {notification_items}
                                                </table>
                                                
                                                <!-- CTA Button -->
                                                <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
                                                    <tr>
                                                        <td style="background-color: #00C805; border-radius: 8px;">
                                                            <a href="https://kolvex.app/dashboard/notifications" 
                                                               style="display: inline-block; color: #ffffff; font-size: 13px; font-weight: 600; padding: 12px 24px; text-decoration: none; letter-spacing: 0.2px;">
                                                                View All Notifications →
                                                            </a>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="padding-top: 28px; text-align: center;">
                                    <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                                        You're receiving this because you enabled email notifications.
                                    </p>
                                    <p style="margin: 10px 0 0 0;">
                                        <a href="https://kolvex.app/dashboard/config" style="font-size: 12px; color: #9ca3af; text-decoration: none; border-bottom: 1px solid #4b5563;">Manage settings</a>
                                    </p>
                                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 20px;">
                                        <tr>
                                            <td style="text-align: center;">
                                                <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                                                    <tr>
                                                        <td style="border-top: 1px solid #2a2d2f; padding-top: 16px;">
                                                            <span style="font-size: 11px; color: #4b5563;">© 2026 Kolvex · All rights reserved</span>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        return html

    def generate_digest_email_text(
        self,
        username: str,
        notifications: List[Dict[str, Any]],
    ) -> str:
        """
        Generate plain text content for digest email

        Args:
            username: Recipient username
            notifications: List of notification data dictionaries

        Returns:
            Plain text content
        """
        items = []
        for notif in notifications:
            title = notif.get("title", "Notification")
            message = notif.get("message", "")
            symbol = notif.get("related_symbol", "")
            symbol_str = f" [{symbol}]" if symbol else ""
            items.append(f"• {title}{symbol_str}\n  {message}")

        notifications_text = "\n\n".join(items)

        text = f"""
Hi {username or 'there'},

You have {len(notifications)} new notifications:

{notifications_text}

---

View all notifications: https://kolvex.com/dashboard/notifications

---
You're receiving this email because you enabled email notifications.
Manage your notification settings: https://kolvex.com/dashboard/config

© 2026 Kolvex. All rights reserved.
"""
        return text


def get_email_service() -> EmailService:
    """获取邮件服务实例（用于 FastAPI 依赖注入）"""
    return EmailService()
