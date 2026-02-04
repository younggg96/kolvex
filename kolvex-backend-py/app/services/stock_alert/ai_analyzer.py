"""
股票 AI 分析服务
使用 LLM 对股票价格异动进行智能分析
"""

import os
import json
import logging
from typing import Dict, Optional, Any
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)


class StockAIAnalyzer:
    """
    股票 AI 分析服务
    
    支持多种 LLM 后端:
    - OpenAI (GPT-4, GPT-3.5)
    - Claude (Anthropic)
    - Ollama (本地模型)
    """
    
    def __init__(
        self,
        provider: str = "openai",
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        """
        初始化 AI 分析器
        
        Args:
            provider: LLM 提供商 ("openai", "anthropic", "ollama")
            api_key: API Key
            model: 模型名称
            base_url: API 基础 URL (用于 Ollama 或自定义端点)
        """
        self.provider = provider.lower()
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.base_url = base_url
        
        # 默认模型配置
        default_models = {
            "openai": "gpt-4o-mini",
            "anthropic": "claude-3-haiku-20240307",
            "ollama": "llama3.2",
        }
        self.model = model or default_models.get(self.provider, "gpt-4o-mini")
        
        # HTTP 客户端
        self._client = httpx.AsyncClient(timeout=60.0)
    
    async def close(self):
        """关闭客户端"""
        await self._client.aclose()
    
    async def analyze_price_movement(
        self,
        price_data: Dict[str, Any],
        historical_context: Optional[str] = None,
        recent_news: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        分析股票价格异动
        
        Args:
            price_data: 价格数据
                - symbol: 股票代码
                - price: 当前价格
                - change_percent: 日内涨跌幅
                - change_5min: 5分钟涨跌幅
                - volume: 成交量
                - session: 交易时段
            historical_context: 历史背景信息 (可选)
            recent_news: 近期新闻 (可选)
            
        Returns:
            {
                "is_abnormal": bool,      # 是否异常
                "reason": str,            # 可能原因
                "risk_level": str,        # 风险等级 (低/中/高)
                "suggestion": str,        # 建议
                "summary": str,           # 简要总结
                "confidence": float,      # 置信度 (0-1)
            }
        """
        symbol = price_data.get("symbol", "UNKNOWN")
        
        # 构建提示词
        prompt = self._build_analysis_prompt(price_data, historical_context, recent_news)
        
        try:
            # 调用 LLM
            if self.provider == "openai":
                result = await self._call_openai(prompt)
            elif self.provider == "anthropic":
                result = await self._call_anthropic(prompt)
            elif self.provider == "ollama":
                result = await self._call_ollama(prompt)
            else:
                raise ValueError(f"不支持的 LLM 提供商: {self.provider}")
            
            # 解析结果
            analysis = self._parse_analysis_result(result, price_data)
            
            logger.info(f"AI 分析完成: {symbol} - {analysis.get('risk_level', 'N/A')}")
            return analysis
            
        except Exception as e:
            logger.error(f"AI 分析失败 ({symbol}): {e}")
            
            # 返回基于规则的简单分析
            return self._fallback_analysis(price_data)
    
    def _build_analysis_prompt(
        self,
        price_data: Dict,
        historical_context: Optional[str] = None,
        recent_news: Optional[str] = None,
    ) -> str:
        """构建分析提示词"""
        
        symbol = price_data.get("symbol", "UNKNOWN")
        price = price_data.get("price", 0)
        change_percent = price_data.get("change_percent", 0)
        change_5min = price_data.get("change_5min", 0)
        volume = price_data.get("volume", 0)
        session = price_data.get("session", "regular")
        
        session_names = {
            "pre_market": "盘前交易",
            "regular": "常规交易时段",
            "after_hours": "盘后交易",
            "closed": "闭市",
        }
        session_cn = session_names.get(session, session)
        
        prompt = f"""你是一位专业的股票分析师。请分析以下股票的价格异动，并给出简洁的分析报告。

## 实时数据
- 股票代码: {symbol}
- 当前价格: ${price:.2f}
- 日内涨跌幅: {change_percent:+.2f}%
- 5分钟涨跌幅: {change_5min:+.2f}%
- 成交量: {volume:,}
- 交易时段: {session_cn}
"""
        
        if historical_context:
            prompt += f"\n## 历史背景\n{historical_context}\n"
        
        if recent_news:
            prompt += f"\n## 近期新闻\n{recent_news}\n"
        
        prompt += """
## 请分析以下内容（总共不超过100个中文字）:
1. 这是否是异常波动？
2. 可能的原因（基于常见市场情况推测）
3. 风险等级（低/中/高）
4. 简短建议

请严格以下面的 JSON 格式返回，不要包含其他内容:
```json
{
    "is_abnormal": true或false,
    "reason": "可能原因的简短描述",
    "risk_level": "低"或"中"或"高",
    "suggestion": "简短建议",
    "summary": "一句话总结",
    "confidence": 0.0到1.0之间的数字
}
```
"""
        return prompt
    
    async def _call_openai(self, prompt: str) -> str:
        """调用 OpenAI API"""
        url = "https://api.openai.com/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500,
            "temperature": 0.3,
        }
        
        response = await self._client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        data = response.json()
        return data["choices"][0]["message"]["content"]
    
    async def _call_anthropic(self, prompt: str) -> str:
        """调用 Anthropic Claude API"""
        url = "https://api.anthropic.com/v1/messages"
        
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": self.model,
            "max_tokens": 500,
            "messages": [{"role": "user", "content": prompt}],
        }
        
        response = await self._client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        data = response.json()
        return data["content"][0]["text"]
    
    async def _call_ollama(self, prompt: str) -> str:
        """调用 Ollama 本地模型"""
        base_url = self.base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        url = f"{base_url}/api/generate"
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 500,
            },
        }
        
        response = await self._client.post(url, json=payload)
        response.raise_for_status()
        
        data = response.json()
        return data.get("response", "")
    
    def _parse_analysis_result(self, result: str, price_data: Dict) -> Dict[str, Any]:
        """解析 LLM 返回的分析结果"""
        try:
            # 尝试提取 JSON
            json_start = result.find("{")
            json_end = result.rfind("}") + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = result[json_start:json_end]
                analysis = json.loads(json_str)
                
                # 确保所有必要字段存在
                analysis.setdefault("is_abnormal", abs(price_data.get("change_percent", 0)) >= 5)
                analysis.setdefault("reason", "市场正常波动")
                analysis.setdefault("risk_level", "中")
                analysis.setdefault("suggestion", "建议持续关注")
                analysis.setdefault("summary", f"{price_data.get('symbol', '')} 价格变动 {price_data.get('change_percent', 0):+.2f}%")
                analysis.setdefault("confidence", 0.7)
                
                # 添加原始价格数据
                analysis["symbol"] = price_data.get("symbol")
                analysis["price"] = price_data.get("price")
                analysis["change_percent"] = price_data.get("change_percent")
                analysis["session"] = price_data.get("session")
                
                return analysis
            
            raise ValueError("无法从返回结果中提取 JSON")
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"解析 AI 结果失败: {e}")
            return self._fallback_analysis(price_data)
    
    def _fallback_analysis(self, price_data: Dict) -> Dict[str, Any]:
        """基于规则的备用分析 (当 AI 分析失败时使用)"""
        symbol = price_data.get("symbol", "UNKNOWN")
        change_percent = price_data.get("change_percent", 0)
        change_5min = price_data.get("change_5min", 0)
        session = price_data.get("session", "regular")
        
        abs_change = abs(change_percent)
        abs_5min = abs(change_5min)
        
        # 判断是否异常
        is_abnormal = abs_change >= 5 or abs_5min >= 3
        
        # 确定风险等级
        if abs_change >= 10 or abs_5min >= 5:
            risk_level = "高"
        elif abs_change >= 5 or abs_5min >= 3:
            risk_level = "中"
        else:
            risk_level = "低"
        
        # 生成原因
        direction = "上涨" if change_percent > 0 else "下跌"
        if session == "pre_market":
            reason = f"盘前{direction}，可能受隔夜消息影响"
        elif session == "after_hours":
            reason = f"盘后{direction}，可能有财报或重大消息"
        else:
            reason = f"盘中{direction}，需关注市场动态"
        
        # 生成建议
        if risk_level == "高":
            suggestion = "风险较高，建议谨慎操作，设置止损"
        elif risk_level == "中":
            suggestion = "保持关注，等待更多信息确认"
        else:
            suggestion = "正常波动范围，可继续持有观察"
        
        return {
            "symbol": symbol,
            "price": price_data.get("price"),
            "change_percent": change_percent,
            "session": session,
            "is_abnormal": is_abnormal,
            "reason": reason,
            "risk_level": risk_level,
            "suggestion": suggestion,
            "summary": f"{symbol} {direction}{abs_change:.1f}%，风险{risk_level}",
            "confidence": 0.5,  # 规则分析置信度较低
        }


# 单例
_analyzer_instance: Optional[StockAIAnalyzer] = None


def get_stock_ai_analyzer() -> StockAIAnalyzer:
    """获取 AI 分析器单例"""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = StockAIAnalyzer()
    return _analyzer_instance
