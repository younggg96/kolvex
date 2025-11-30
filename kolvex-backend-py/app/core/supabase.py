"""
Supabase 配置和客户端
"""
from supabase import create_client, Client
from app.core.config import settings
from typing import Optional


class SupabaseClient:
    """Supabase 客户端单例"""
    
    _instance: Optional[Client] = None
    _service_instance: Optional[Client] = None
    
    @classmethod
    def get_client(cls) -> Client:
        """获取 Supabase 客户端实例（使用 anon key，用于验证 JWT）"""
        if cls._instance is None:
            if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
                raise ValueError("Supabase URL 和 Key 未配置")
            
            cls._instance = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_KEY
            )
        
        return cls._instance
    
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
                key
            )
        
        return cls._service_instance
    
    @classmethod
    def reset_client(cls):
        """重置客户端（用于测试）"""
        cls._instance = None
        cls._service_instance = None


def get_supabase() -> Client:
    """获取 Supabase 客户端的依赖函数（用于验证 JWT）"""
    return SupabaseClient.get_client()


def get_supabase_service() -> Client:
    """获取 Supabase Service 客户端的依赖函数（用于数据库操作，绕过 RLS）"""
    return SupabaseClient.get_service_client()

