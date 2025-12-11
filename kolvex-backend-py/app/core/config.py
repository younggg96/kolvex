"""
应用配置
"""

from pydantic_settings import BaseSettings
from typing import List, Union
from pydantic import field_validator


class Settings(BaseSettings):
    """应用配置"""

    # 基础配置
    APP_NAME: str = "Kolvex API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_VERSION: str = "v1"

    # 数据库配置
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/kolvex"

    # Supabase 配置
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # JWT 配置
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # MCP Server 配置
    MCP_HOST: str = "0.0.0.0"
    MCP_PORT: int = 8001
    MCP_TRANSPORT: str = "streamable-http"

    # Benzinga API 配置
    BENZINGA_API_KEY: str = ""
    
    # SnapTrade API 配置
    SNAPTRADE_CLIENT_ID: str = ""
    SNAPTRADE_CONSUMER_KEY: str = ""
    
    # CORS 配置
    ALLOWED_ORIGINS: Union[List[str], str] = (
        "http://localhost:3000,http://localhost:3001"
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        """解析 ALLOWED_ORIGINS，支持逗号分隔的字符串或列表"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # 忽略额外的环境变量


settings = Settings()
