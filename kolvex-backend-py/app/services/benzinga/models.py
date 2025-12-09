"""
Benzinga API 数据模型
使用 Pydantic 进行数据验证和结构化
"""

from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field, field_validator


class BenzingaStock(BaseModel):
    """股票标识模型"""
    name: str = ""
    
    
class BenzingaTag(BaseModel):
    """标签模型"""
    name: str = ""


class BenzingaRawArticle(BaseModel):
    """Benzinga API 原始文章响应模型"""
    id: int
    author: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None
    title: Optional[str] = None
    teaser: Optional[str] = None
    body: Optional[str] = None
    url: Optional[str] = None
    image: Optional[List[Any]] = None
    channels: Optional[List[Any]] = None
    stocks: Optional[List[BenzingaStock]] = None
    tags: Optional[List[BenzingaTag]] = None
    
    class Config:
        extra = "ignore"


class NewsArticle(BaseModel):
    """
    清洗后的新闻文章模型
    适用于 LLM 分析管道
    """
    published_at: str = Field(..., description="发布时间 (ISO 格式)")
    title: str = Field(..., description="文章标题")
    summary: str = Field(..., description="清洗后的文章摘要/正文")
    url: str = Field(..., description="文章 URL")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    tickers: List[str] = Field(default_factory=list, description="相关股票代码列表")
    
    @field_validator("published_at", mode="before")
    @classmethod
    def parse_datetime(cls, v: Any) -> str:
        """将各种日期格式转换为 ISO 格式字符串"""
        if isinstance(v, datetime):
            return v.isoformat()
        if isinstance(v, str):
            # 尝试解析常见格式并标准化
            try:
                # Benzinga 格式: "Wed, 04 Dec 2024 15:30:00 -0500"
                dt = datetime.strptime(v, "%a, %d %b %Y %H:%M:%S %z")
                return dt.isoformat()
            except ValueError:
                pass
            try:
                # ISO 格式
                dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
                return dt.isoformat()
            except ValueError:
                pass
            # 无法解析，返回原始值
            return v
        return str(v)

    def to_llm_context(self) -> str:
        """
        将文章转换为 LLM 友好的文本格式
        
        Returns:
            str: 格式化的文本，适合输入 LLM
        """
        tickers_str = ", ".join(self.tickers) if self.tickers else "N/A"
        tags_str = ", ".join(self.tags) if self.tags else "N/A"
        
        return f"""### {self.title}

**Published:** {self.published_at}
**Tickers:** {tickers_str}
**Tags:** {tags_str}

{self.summary}

**Source:** {self.url}
---"""


class BenzingaNewsResponse(BaseModel):
    """Benzinga 新闻 API 响应模型"""
    articles: List[NewsArticle] = Field(default_factory=list)
    total_count: int = 0
    success: bool = True
    error_message: Optional[str] = None
    
    def to_llm_batch(self, separator: str = "\n\n") -> str:
        """
        将所有文章转换为 LLM 批量处理格式
        
        Args:
            separator: 文章之间的分隔符
            
        Returns:
            str: 所有文章的组合文本
        """
        return separator.join(
            article.to_llm_context() for article in self.articles
        )

