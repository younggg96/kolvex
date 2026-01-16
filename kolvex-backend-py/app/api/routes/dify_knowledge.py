"""
Dify 外部知识库 API
提供符合 Dify External Knowledge API 规范的检索接口
"""

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import logging

from app.core.config import settings
from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dify", tags=["Dify Knowledge"])


# ============================================================
# Pydantic 模型 - Dify External Knowledge API 规范
# ============================================================


class RetrievalRequest(BaseModel):
    """Dify 检索请求"""

    knowledge_id: str = Field(..., description="知识库 ID")
    query: str = Field(..., description="用户查询")
    retrieval_setting: dict = Field(default_factory=dict, description="检索设置")


class RecordMetadata(BaseModel):
    """记录元数据"""

    path: Optional[str] = None
    description: Optional[str] = None


class Record(BaseModel):
    """检索结果记录"""

    content: str = Field(..., description="文本内容")
    score: float = Field(..., description="相关性分数 0-1")
    title: Optional[str] = Field(None, description="标题")
    metadata: Optional[RecordMetadata] = None


class RetrievalResponse(BaseModel):
    """Dify 检索响应"""

    records: List[Record] = Field(default_factory=list)


# ============================================================
# API 端点
# ============================================================


def verify_dify_api_key(authorization: Optional[str] = Header(None)) -> bool:
    """验证 Dify API Key"""
    if not settings.DIFY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DIFY_API_KEY not configured",
        )

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
        )

    # 支持 "Bearer xxx" 或直接 "xxx" 格式
    token = authorization
    if authorization.lower().startswith("bearer "):
        token = authorization[7:]

    if token != settings.DIFY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )

    return True


@router.post("/retrieval", response_model=RetrievalResponse)
async def retrieval(
    request: RetrievalRequest,
    authorization: Optional[str] = Header(None),
):
    """
    Dify 外部知识库检索接口

    根据 knowledge_id 从不同数据源检索相关内容：
    - kol_posts: KOL 帖子/推文
    - news: 金融新闻
    - xiaohongshu: 小红书帖子
    - dataroma: 超级投资者持仓
    """
    verify_dify_api_key(authorization)

    knowledge_id = request.knowledge_id.lower()
    query = request.query
    top_k = request.retrieval_setting.get("top_k", 5)

    logger.info(f"Dify retrieval: knowledge_id={knowledge_id}, query={query[:50]}...")

    try:
        supabase = get_supabase_service()
        records: List[Record] = []

        if knowledge_id == "kol_posts":
            # 检索 KOL 帖子
            result = (
                supabase.table("kol_tweets")
                .select("id, tweet_text, ai_summary, ai_tickers, ai_sentiment, kol_username, created_at")
                .or_(f"tweet_text.ilike.%{query}%,ai_summary.ilike.%{query}%")
                .order("created_at", desc=True)
                .limit(top_k)
                .execute()
            )

            for row in result.data or []:
                content = f"[{row.get('kol_username', 'Unknown')}] {row.get('tweet_text', '')}"
                if row.get("ai_summary"):
                    content += f"\n摘要: {row['ai_summary']}"
                if row.get("ai_tickers"):
                    content += f"\n股票: {', '.join(row['ai_tickers'])}"
                if row.get("ai_sentiment"):
                    content += f"\n情感: {row['ai_sentiment']}"

                records.append(
                    Record(
                        content=content,
                        score=0.8,
                        title=f"KOL: {row.get('kol_username', 'Unknown')}",
                        metadata=RecordMetadata(
                            path=f"/kol-posts/{row.get('id')}",
                            description=f"Posted at {row.get('created_at', '')}",
                        ),
                    )
                )

        elif knowledge_id == "news":
            # 检索金融新闻
            result = (
                supabase.table("news_articles")
                .select("id, title, summary, tickers, published_at, url")
                .or_(f"title.ilike.%{query}%,summary.ilike.%{query}%")
                .order("published_at", desc=True)
                .limit(top_k)
                .execute()
            )

            for row in result.data or []:
                content = f"{row.get('title', '')}\n{row.get('summary', '')}"
                if row.get("tickers"):
                    content += f"\n相关股票: {', '.join(row['tickers'])}"

                records.append(
                    Record(
                        content=content,
                        score=0.85,
                        title=row.get("title", "News"),
                        metadata=RecordMetadata(
                            path=row.get("url", ""),
                            description=f"Published at {row.get('published_at', '')}",
                        ),
                    )
                )

        elif knowledge_id == "xiaohongshu":
            # 检索小红书帖子
            result = (
                supabase.table("xhs_posts")
                .select("note_id, title, content, ai_summary, ai_tickers, author_name, created_at")
                .or_(f"title.ilike.%{query}%,content.ilike.%{query}%,ai_summary.ilike.%{query}%")
                .order("created_at", desc=True)
                .limit(top_k)
                .execute()
            )

            for row in result.data or []:
                content = f"[{row.get('author_name', 'Unknown')}] {row.get('title', '')}\n{row.get('content', '')}"
                if row.get("ai_summary"):
                    content += f"\n摘要: {row['ai_summary']}"
                if row.get("ai_tickers"):
                    content += f"\n股票: {', '.join(row['ai_tickers'])}"

                records.append(
                    Record(
                        content=content,
                        score=0.75,
                        title=row.get("title", "小红书帖子"),
                        metadata=RecordMetadata(
                            path=f"https://www.xiaohongshu.com/explore/{row.get('note_id', '')}",
                            description=f"Author: {row.get('author_name', '')}",
                        ),
                    )
                )

        elif knowledge_id == "dataroma":
            # 检索超级投资者持仓
            result = (
                supabase.table("dataroma_holdings")
                .select("investor_code, stock_ticker, stock_name, percent_of_portfolio, shares, market_value, quarter")
                .or_(f"stock_ticker.ilike.%{query}%,stock_name.ilike.%{query}%,investor_code.ilike.%{query}%")
                .order("quarter", desc=True)
                .limit(top_k)
                .execute()
            )

            for row in result.data or []:
                content = (
                    f"投资者: {row.get('investor_code', 'Unknown')}\n"
                    f"股票: {row.get('stock_ticker', '')} - {row.get('stock_name', '')}\n"
                    f"持仓占比: {row.get('percent_of_portfolio', 0):.2f}%\n"
                    f"股数: {row.get('shares', 0):,}\n"
                    f"市值: ${row.get('market_value', 0):,.0f}\n"
                    f"季度: {row.get('quarter', '')}"
                )

                records.append(
                    Record(
                        content=content,
                        score=0.9,
                        title=f"{row.get('investor_code', '')} - {row.get('stock_ticker', '')}",
                        metadata=RecordMetadata(
                            path=f"/dataroma/holdings/{row.get('investor_code', '')}",
                            description=f"Quarter: {row.get('quarter', '')}",
                        ),
                    )
                )

        else:
            # 未知的 knowledge_id，尝试全局搜索
            logger.warning(f"Unknown knowledge_id: {knowledge_id}")

        logger.info(f"Retrieval complete: {len(records)} records found")
        return RetrievalResponse(records=records)

    except Exception as e:
        logger.error(f"Retrieval error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retrieval failed: {str(e)}",
        )


@router.get("/knowledge-bases")
async def list_knowledge_bases(
    authorization: Optional[str] = Header(None),
):
    """
    列出可用的知识库 ID
    """
    verify_dify_api_key(authorization)

    return {
        "knowledge_bases": [
            {
                "id": "kol_posts",
                "name": "KOL 帖子",
                "description": "Twitter/X 上金融 KOL 的帖子和分析",
            },
            {
                "id": "news",
                "name": "金融新闻",
                "description": "Benzinga 金融新闻文章",
            },
            {
                "id": "xiaohongshu",
                "name": "小红书",
                "description": "小红书上的投资理财帖子",
            },
            {
                "id": "dataroma",
                "name": "超级投资者",
                "description": "巴菲特等超级投资者的 13F 持仓数据",
            },
        ]
    }
