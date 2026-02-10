"""
应用配置
"""

import os
from pydantic_settings import BaseSettings
from typing import List, Union
from pydantic import field_validator
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()


class Settings(BaseSettings):
    """应用配置"""

    # 基础配置
    APP_NAME: str = os.getenv("APP_NAME", "Kolvex API")
    APP_VERSION: str = os.getenv("APP_VERSION", "1.0.0")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    API_VERSION: str = os.getenv("API_VERSION", "v1")

    # 数据库配置
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql://user:password@localhost:5432/kolvex"
    )

    # Supabase 配置
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # JWT 配置
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY", "your-secret-key-change-this-in-production"
    )
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    )

    # MCP Server 配置
    MCP_HOST: str = os.getenv("MCP_HOST", "0.0.0.0")
    MCP_PORT: int = int(os.getenv("MCP_PORT", "8001"))
    MCP_TRANSPORT: str = os.getenv("MCP_TRANSPORT", "streamable-http")

    # Benzinga API 配置
    BENZINGA_API_KEY: str = os.getenv("BENZINGA_API_KEY", "")

    # SnapTrade API 配置
    SNAPTRADE_CLIENT_ID: str = os.getenv("SNAPTRADE_CLIENT_ID", "")
    SNAPTRADE_CONSUMER_KEY: str = os.getenv("SNAPTRADE_CONSUMER_KEY", "")
    SNAPTRADE_WEBHOOK_SECRET: str = os.getenv("SNAPTRADE_WEBHOOK_SECRET", "")

    # CORS 配置
    ALLOWED_ORIGINS: Union[List[str], str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001"
    )

    # API Key 配置 (用于 Dify 等外部服务，不过期)
    DIFY_API_KEY: str = os.getenv("DIFY_API_KEY", "")

    # Email Service (Resend) 配置
    RESEND_API_KEY: str = os.getenv(
        "RESEND_API_KEY", "re_UNTp1c6M_NiZAo74CjZoGXL7T1uZ2Jswy"
    )
    EMAIL_FROM_ADDRESS: str = os.getenv(
        "EMAIL_FROM_ADDRESS", "Kolvex <support@kolvex.app>"
    )
    EMAIL_ENABLED: bool = os.getenv("EMAIL_ENABLED", "True").lower() == "true"

    # Ollama AI 配置
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "")
    OLLAMA_TIMEOUT: float = float(os.getenv("OLLAMA_TIMEOUT", "60.0"))

    # ==================== 股票预警系统配置 ====================
    
    # Finnhub API (实时股票数据)
    FINNHUB_API_KEY: str = os.getenv("FINNHUB_API_KEY", "")
    
    # OpenAI API (AI 分析，可选)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Twilio (WhatsApp 通知，可选)
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_WHATSAPP_FROM: str = os.getenv("TWILIO_WHATSAPP_FROM", "")

    # ==================== LangGraph AI Agent 配置 ====================
    # 支持: openai | anthropic | ollama | deepseek | qwen | gemini | kimi | grok
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.7"))
    LLM_FALLBACK_PROVIDER: str = os.getenv("LLM_FALLBACK_PROVIDER", "")
    LLM_FALLBACK_MODEL: str = os.getenv("LLM_FALLBACK_MODEL", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    QWEN_API_KEY: str = os.getenv("QWEN_API_KEY", "")  # 阿里云 DashScope API Key
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")  # Google Gemini API Key
    KIMI_API_KEY: str = os.getenv("KIMI_API_KEY", "")  # Moonshot/Kimi API Key
    GROK_API_KEY: str = os.getenv("GROK_API_KEY", "")  # xAI Grok API Key

    # ==================== 网络搜索工具配置 ====================
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

    # ==================== Redis 缓存配置 ====================
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_MAX_CONNECTIONS: int = int(os.getenv("REDIS_MAX_CONNECTIONS", "10"))
    REDIS_CACHE_TTL: int = int(os.getenv("REDIS_CACHE_TTL", "3600"))  # 默认缓存 1 小时
    REDIS_KEY_PREFIX: str = os.getenv("REDIS_KEY_PREFIX", "kolvex:")

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
