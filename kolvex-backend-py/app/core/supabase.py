"""
Supabase 配置和客户端
"""
from supabase import create_client, Client
from supabase.client import ClientOptions
from app.core.config import settings
from typing import Optional


class SupabaseClient:
    """独立的请求认证客户端和共享的服务客户端。"""
    
    _service_instance: Optional[Client] = None
    
    @classmethod
    def get_client(cls) -> Client:
        """每次创建独立客户端；用户会话只由浏览器持久化和自动续期。"""
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("Supabase URL 和 Key 未配置")

        # 登录会修改客户端的会话及 Authorization header，不能跨用户共享。
        # 后台续期会轮换浏览器仍在使用的 refresh token，导致意外掉线。
        return create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY,
            options=ClientOptions(auto_refresh_token=False, persist_session=False),
        )
    
    @classmethod
    def get_service_client(cls) -> Client:
        """获取 Supabase Service 客户端实例（使用 service_role key，绕过 RLS）"""
        if cls._service_instance is None:
            if not settings.SUPABASE_URL:
                raise ValueError("Supabase URL 未配置")
            
            # 优先使用 service_role key，如果没有则回退到 anon key
            key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY
            if not key:
                raise ValueError("Supabase Key 未配置")
            
            cls._service_instance = create_client(
                settings.SUPABASE_URL,
                key,
                options=ClientOptions(auto_refresh_token=False, persist_session=False),
            )
        
        return cls._service_instance
    
    @classmethod
    def reset_client(cls):
        """重置客户端（用于测试）"""
        cls._service_instance = None


def get_supabase() -> Client:
    """获取 Supabase 客户端的依赖函数（用于验证 JWT）"""
    return SupabaseClient.get_client()


def get_supabase_service() -> Client:
    """获取 Supabase Service 客户端的依赖函数（用于数据库操作，绕过 RLS）"""
    return SupabaseClient.get_service_client()

