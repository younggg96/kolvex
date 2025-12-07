"""
Ollama API 客户端模块
提供异步和同步两种客户端实现
"""

import httpx
from typing import Dict, List

from .config import OLLAMA_BASE_URL, DEFAULT_MODEL, REQUEST_TIMEOUT


class OllamaClient:
    """Ollama API 客户端 - 异步版本"""

    def __init__(
        self, base_url: str = None, model: str = None, timeout: float = REQUEST_TIMEOUT
    ):
        self.base_url = (base_url or OLLAMA_BASE_URL).rstrip("/")
        self.model = model or DEFAULT_MODEL
        self.timeout = timeout
        self._client = httpx.AsyncClient(timeout=timeout)

    async def close(self):
        """关闭客户端"""
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def generate(
        self,
        prompt: str,
        model: str = None,
        system: str = None,
        temperature: float = 0.1,
        max_tokens: int = 512,
        stream: bool = False,
    ) -> str:
        """
        生成文本

        Args:
            prompt: 用户提示
            model: 模型名称 (可选，默认使用实例配置)
            system: 系统提示 (可选)
            temperature: 温度 (0-1)，低温度 = 更确定性的输出
            max_tokens: 最大 token 数
            stream: 是否流式输出

        Returns:
            str: 生成的文本
        """
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": model or self.model,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        if system:
            payload["system"] = system

        response = await self._client.post(url, json=payload)
        response.raise_for_status()

        data = response.json()
        return data.get("response", "")

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.1,
        max_tokens: int = 512,
        stream: bool = False,
    ) -> str:
        """
        聊天补全

        Args:
            messages: 消息列表 [{"role": "user/assistant/system", "content": "..."}]
            model: 模型名称
            temperature: 温度 (低 = 更确定性)
            max_tokens: 最大 token 数
            stream: 是否流式

        Returns:
            str: AI 回复内容
        """
        url = f"{self.base_url}/api/chat"

        payload = {
            "model": model or self.model,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        response = await self._client.post(url, json=payload)
        response.raise_for_status()

        data = response.json()
        return data.get("message", {}).get("content", "")

    async def list_models(self) -> List[Dict]:
        """获取可用模型列表"""
        url = f"{self.base_url}/api/tags"
        response = await self._client.get(url)
        response.raise_for_status()
        data = response.json()
        return data.get("models", [])

    async def health_check(self) -> bool:
        """健康检查"""
        try:
            url = f"{self.base_url}/api/tags"
            response = await self._client.get(url, timeout=10.0)
            return response.status_code == 200
        except Exception:
            return False


class OllamaClientSync:
    """Ollama API 客户端 - 同步版本 (用于爬虫实时分析)"""

    def __init__(
        self, base_url: str = None, model: str = None, timeout: float = REQUEST_TIMEOUT
    ):
        self.base_url = (base_url or OLLAMA_BASE_URL).rstrip("/")
        self.model = model or DEFAULT_MODEL
        self.timeout = timeout

    def generate(
        self,
        prompt: str,
        model: str = None,
        temperature: float = 0.1,
        max_tokens: int = 512,
    ) -> str:
        """同步生成文本"""
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": model or self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")

    def health_check(self) -> bool:
        """健康检查"""
        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

