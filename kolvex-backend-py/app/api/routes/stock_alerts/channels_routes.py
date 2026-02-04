"""
通知渠道配置 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.supabase import get_supabase_service
from app.api.dependencies.auth import get_current_user_id
from app.services.stock_alert import MultiChannelNotifier, NotificationChannel
from .schemas import (
    ChannelConfigCreate,
    ChannelConfigUpdate,
    ChannelConfigResponse,
    ChannelConfigsListResponse,
    TestAlertRequest,
    TestAlertResponse,
    MessageResponse,
)

router = APIRouter()


@router.get(
    "/channels",
    response_model=ChannelConfigsListResponse,
    summary="获取通知渠道配置列表",
)
async def get_notification_channels(
    current_user_id: str = Depends(get_current_user_id),
):
    """获取当前用户的所有通知渠道配置"""
    try:
        supabase = get_supabase_service()
        
        response = (
            supabase.table("user_notification_channels")
            .select("*")
            .eq("user_id", current_user_id)
            .order("created_at", desc=True)
            .execute()
        )
        
        channels = response.data or []
        
        # 隐藏敏感信息
        for channel in channels:
            if channel.get("telegram_bot_token"):
                channel["telegram_bot_token"] = "***已配置***"
        
        return ChannelConfigsListResponse(
            channels=[ChannelConfigResponse(**ch) for ch in channels],
            total=len(channels)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取通知渠道配置失败: {str(e)}"
        )


@router.post(
    "/channels",
    response_model=ChannelConfigResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建通知渠道配置",
)
async def create_notification_channel(
    channel_data: ChannelConfigCreate,
    current_user_id: str = Depends(get_current_user_id),
):
    """创建新的通知渠道配置"""
    try:
        supabase = get_supabase_service()
        
        # 检查是否已存在相同渠道的配置
        existing = (
            supabase.table("user_notification_channels")
            .select("id")
            .eq("user_id", current_user_id)
            .eq("channel_type", channel_data.channel_type.value)
            .execute()
        )
        
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"已存在 {channel_data.channel_type.value} 渠道配置，请使用更新接口"
            )
        
        # 验证必要字段
        if channel_data.channel_type == "discord" and not channel_data.discord_webhook_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Discord 渠道需要提供 Webhook URL"
            )
        
        if channel_data.channel_type == "telegram":
            if not channel_data.telegram_bot_token or not channel_data.telegram_chat_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Telegram 渠道需要提供 Bot Token 和 Chat ID"
                )
        
        if channel_data.channel_type == "wechat" and not channel_data.wechat_webhook_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="微信渠道需要提供 Webhook URL"
            )
        
        if channel_data.channel_type == "whatsapp" and not channel_data.whatsapp_phone_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="WhatsApp 渠道需要提供手机号码"
            )
        
        insert_data = {
            "user_id": current_user_id,
            "channel_type": channel_data.channel_type.value,
            "discord_webhook_url": channel_data.discord_webhook_url,
            "telegram_bot_token": channel_data.telegram_bot_token,
            "telegram_chat_id": channel_data.telegram_chat_id,
            "wechat_webhook_url": channel_data.wechat_webhook_url,
            "whatsapp_phone_number": channel_data.whatsapp_phone_number,
            "is_verified": False,  # 需要通过测试才能验证
        }
        
        response = (
            supabase.table("user_notification_channels")
            .insert(insert_data)
            .execute()
        )
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="创建通知渠道配置失败"
            )
        
        channel = response.data[0]
        
        # 隐藏敏感信息
        if channel.get("telegram_bot_token"):
            channel["telegram_bot_token"] = "***已配置***"
        
        return ChannelConfigResponse(**channel)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建通知渠道配置失败: {str(e)}"
        )


@router.patch(
    "/channels/{channel_id}",
    response_model=ChannelConfigResponse,
    summary="更新通知渠道配置",
)
async def update_notification_channel(
    channel_id: str,
    channel_update: ChannelConfigUpdate,
    current_user_id: str = Depends(get_current_user_id),
):
    """更新通知渠道配置"""
    try:
        supabase = get_supabase_service()
        
        # 验证配置存在且属于当前用户
        existing = (
            supabase.table("user_notification_channels")
            .select("*")
            .eq("id", channel_id)
            .eq("user_id", current_user_id)
            .single()
            .execute()
        )
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="通知渠道配置不存在"
            )
        
        # 构建更新数据
        update_data = {}
        
        if channel_update.discord_webhook_url is not None:
            update_data["discord_webhook_url"] = channel_update.discord_webhook_url
        if channel_update.telegram_bot_token is not None:
            update_data["telegram_bot_token"] = channel_update.telegram_bot_token
        if channel_update.telegram_chat_id is not None:
            update_data["telegram_chat_id"] = channel_update.telegram_chat_id
        if channel_update.wechat_webhook_url is not None:
            update_data["wechat_webhook_url"] = channel_update.wechat_webhook_url
        if channel_update.whatsapp_phone_number is not None:
            update_data["whatsapp_phone_number"] = channel_update.whatsapp_phone_number
        
        if update_data:
            # 更新后需要重新验证
            update_data["is_verified"] = False
            
            response = (
                supabase.table("user_notification_channels")
                .update(update_data)
                .eq("id", channel_id)
                .execute()
            )
            
            channel = response.data[0] if response.data else existing.data
        else:
            channel = existing.data
        
        # 隐藏敏感信息
        if channel.get("telegram_bot_token"):
            channel["telegram_bot_token"] = "***已配置***"
        
        return ChannelConfigResponse(**channel)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新通知渠道配置失败: {str(e)}"
        )


@router.delete(
    "/channels/{channel_id}",
    response_model=MessageResponse,
    summary="删除通知渠道配置",
)
async def delete_notification_channel(
    channel_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """删除通知渠道配置"""
    try:
        supabase = get_supabase_service()
        
        # 验证配置存在且属于当前用户
        existing = (
            supabase.table("user_notification_channels")
            .select("channel_type")
            .eq("id", channel_id)
            .eq("user_id", current_user_id)
            .single()
            .execute()
        )
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="通知渠道配置不存在"
            )
        
        channel_type = existing.data.get("channel_type")
        
        # 删除配置
        supabase.table("user_notification_channels").delete().eq("id", channel_id).execute()
        
        return MessageResponse(
            success=True,
            message=f"已删除 {channel_type} 渠道配置"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除通知渠道配置失败: {str(e)}"
        )


@router.post(
    "/channels/{channel_id}/test",
    response_model=TestAlertResponse,
    summary="测试通知渠道",
)
async def test_notification_channel(
    channel_id: str,
    current_user_id: str = Depends(get_current_user_id),
):
    """发送测试消息到指定渠道"""
    try:
        supabase = get_supabase_service()
        
        # 获取渠道配置
        response = (
            supabase.table("user_notification_channels")
            .select("*")
            .eq("id", channel_id)
            .eq("user_id", current_user_id)
            .single()
            .execute()
        )
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="通知渠道配置不存在"
            )
        
        channel_data = response.data
        channel_type = channel_data.get("channel_type")
        
        # 构造测试数据
        test_alert = {
            "symbol": "TEST",
            "price": 100.00,
            "change_percent": 5.55,
            "change_5min": 1.23,
            "session": "regular",
            "risk_level": "中",
            "summary": "这是一条测试消息，用于验证通知渠道配置是否正确。",
            "suggestion": "如果您收到此消息，说明配置成功！",
            "reason": "通知渠道测试",
        }
        
        # 构造渠道配置
        config = {
            "discord_webhook_url": channel_data.get("discord_webhook_url"),
            "telegram_bot_token": channel_data.get("telegram_bot_token"),
            "telegram_chat_id": channel_data.get("telegram_chat_id"),
            "wechat_webhook_url": channel_data.get("wechat_webhook_url"),
            "whatsapp_phone_number": channel_data.get("whatsapp_phone_number"),
        }
        
        # 获取用户邮箱
        if channel_type == "email":
            user_response = (
                supabase.table("user_profiles")
                .select("email")
                .eq("id", current_user_id)
                .single()
                .execute()
            )
            if user_response.data:
                config["user_email"] = user_response.data.get("email")
        
        # 发送测试消息
        notifier = MultiChannelNotifier()
        
        try:
            channel_enum = NotificationChannel(channel_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的渠道类型: {channel_type}"
            )
        
        result = await notifier.send_alert(
            channels=[channel_enum],
            alert_data=test_alert,
            user_channel_config=config,
        )
        
        await notifier.close()
        
        # 如果发送成功，更新验证状态
        if result.get("success"):
            from datetime import datetime
            supabase.table("user_notification_channels").update({
                "is_verified": True,
                "verified_at": datetime.utcnow().isoformat(),
            }).eq("id", channel_id).execute()
        
        return TestAlertResponse(
            success=result.get("success", False),
            channels_sent=result.get("channels_sent", []),
            channels_failed=result.get("channels_failed", []),
            message="测试消息已发送" if result.get("success") else "测试消息发送失败"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"测试通知渠道失败: {str(e)}"
        )


@router.post(
    "/test",
    response_model=TestAlertResponse,
    summary="测试预警通知",
)
async def test_alert_notification(
    test_request: TestAlertRequest,
    current_user_id: str = Depends(get_current_user_id),
):
    """发送测试预警到指定渠道"""
    try:
        supabase = get_supabase_service()
        
        # 获取用户的渠道配置
        channels_response = (
            supabase.table("user_notification_channels")
            .select("*")
            .eq("user_id", current_user_id)
            .execute()
        )
        
        channel_configs = channels_response.data or []
        
        # 构造配置
        config = {}
        for ch in channel_configs:
            ch_type = ch.get("channel_type")
            if ch_type == "discord":
                config["discord_webhook_url"] = ch.get("discord_webhook_url")
            elif ch_type == "telegram":
                config["telegram_bot_token"] = ch.get("telegram_bot_token")
                config["telegram_chat_id"] = ch.get("telegram_chat_id")
            elif ch_type == "wechat":
                config["wechat_webhook_url"] = ch.get("wechat_webhook_url")
            elif ch_type == "whatsapp":
                config["whatsapp_phone_number"] = ch.get("whatsapp_phone_number")
        
        # 获取用户邮箱
        user_response = (
            supabase.table("user_profiles")
            .select("email")
            .eq("id", current_user_id)
            .single()
            .execute()
        )
        if user_response.data:
            config["user_email"] = user_response.data.get("email")
        
        # 构造测试数据
        test_alert = {
            "symbol": test_request.symbol.upper(),
            "price": 150.00,
            "change_percent": 6.66,
            "change_5min": 2.34,
            "session": "regular",
            "risk_level": "中",
            "summary": test_request.test_message or f"测试: {test_request.symbol} 触发预警条件",
            "suggestion": "这是一条测试消息，请忽略。",
            "reason": "手动测试预警",
        }
        
        # 转换渠道类型
        channels = []
        for ch in test_request.channels:
            try:
                channels.append(NotificationChannel(ch.value))
            except ValueError:
                pass
        
        if not channels:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请指定至少一个有效的通知渠道"
            )
        
        # 发送测试消息
        notifier = MultiChannelNotifier()
        
        result = await notifier.send_alert(
            channels=channels,
            alert_data=test_alert,
            user_channel_config=config,
        )
        
        await notifier.close()
        
        return TestAlertResponse(
            success=result.get("success", False),
            channels_sent=result.get("channels_sent", []),
            channels_failed=result.get("channels_failed", []),
            message=f"测试消息已发送到 {len(result.get('channels_sent', []))} 个渠道"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"测试预警通知失败: {str(e)}"
        )
