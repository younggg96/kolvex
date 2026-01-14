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

# Ollama API Base URL (本地部署或 Docker 容器)
# Docker 环境下会设置为 http://ollama:11434
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# AI 模型 - 使用轻量级 gemma2:2b（约 1.6GB）
# 也可以使用金融专用模型: QuantFactory/Llama-3-8B-Instruct-Finance-RAG-GGUF:Q4_K_M
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "gemma2:2b")

# 请求超时 (秒) - 本地模型更快
REQUEST_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "60.0"))

