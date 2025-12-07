"""
AI 服务配置模块
配置 Ollama API 和默认模型参数
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# Ollama 配置
# ============================================================

# Ollama API Base URL (本地部署)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# 金融专用模型
DEFAULT_MODEL = os.getenv(
    "OLLAMA_MODEL", "QuantFactory/Llama-3-8B-Instruct-Finance-RAG-GGUF:Q4_K_M"
)

# 请求超时 (秒) - 本地模型更快
REQUEST_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "60.0"))

