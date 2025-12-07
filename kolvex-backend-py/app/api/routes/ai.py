"""
AI API 路由
提供 AI 分析功能的 RESTful API
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.services.ai_service import OllamaClient, TweetAnalyzer

router = APIRouter(prefix="/ai", tags=["AI"])


# ============================================================
# Pydantic 模型
# ============================================================


class GenerateRequest(BaseModel):
    """文本生成请求"""

    prompt: str
    system: Optional[str] = None
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 2048


class ChatMessage(BaseModel):
    """聊天消息"""

    role: str  # "user", "assistant", "system"
    content: str


class ChatRequest(BaseModel):
    """聊天请求"""

    messages: List[ChatMessage]
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 2048


class AnalyzeTweetRequest(BaseModel):
    """推文分析请求"""

    tweet_text: str
    analysis_type: str = "full"  # "full", "sentiment", "tickers", "tags", "summary"


class GenerateResponse(BaseModel):
    """生成响应"""

    response: str
    model: str


class SentimentResult(BaseModel):
    """情感分析结果"""

    sentiment: str  # "bullish", "bearish", "neutral"
    confidence: float
    reasoning: str


class TweetAnalysisResponse(BaseModel):
    """推文分析响应"""

    sentiment: Optional[SentimentResult] = None
    tickers: Optional[List[str]] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None
    analyzed_at: Optional[str] = None


class HealthResponse(BaseModel):
    """健康检查响应"""

    status: str
    ollama_available: bool
    model: str
    base_url: str


class ModelInfo(BaseModel):
    """模型信息"""

    name: str
    size: Optional[int] = None  # Ollama 返回的是字节数 (int)
    size_gb: Optional[str] = None  # 格式化后的大小
    modified_at: Optional[str] = None


class ModelsResponse(BaseModel):
    """模型列表响应"""

    models: List[ModelInfo]


# ============================================================
# API 路由
# ============================================================


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    AI 服务健康检查
    """
    async with OllamaClient() as client:
        is_healthy = await client.health_check()
        return HealthResponse(
            status="ok" if is_healthy else "unavailable",
            ollama_available=is_healthy,
            model=client.model,
            base_url=client.base_url,
        )


def format_size(size_bytes: int) -> str:
    """格式化字节大小为人类可读格式"""
    if not size_bytes:
        return "Unknown"
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


@router.get("/models", response_model=ModelsResponse)
async def list_models():
    """
    获取可用模型列表
    """
    try:
        async with OllamaClient() as client:
            models = await client.list_models()
            return ModelsResponse(
                models=[
                    ModelInfo(
                        name=m.get("name", "unknown"),
                        size=m.get("size"),
                        size_gb=format_size(m.get("size")) if m.get("size") else None,
                        modified_at=m.get("modified_at"),
                    )
                    for m in models
                ]
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取模型列表失败: {str(e)}")


@router.post("/generate", response_model=GenerateResponse)
async def generate_text(request: GenerateRequest):
    """
    生成文本

    - **prompt**: 用户提示
    - **system**: 系统提示 (可选)
    - **model**: 模型名称 (可选)
    - **temperature**: 温度 0-1 (默认 0.7)
    - **max_tokens**: 最大 token 数 (默认 2048)
    """
    try:
        async with OllamaClient() as client:
            response = await client.generate(
                prompt=request.prompt,
                system=request.system,
                model=request.model,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            )
            return GenerateResponse(
                response=response, model=request.model or client.model
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


@router.post("/chat", response_model=GenerateResponse)
async def chat(request: ChatRequest):
    """
    聊天补全

    - **messages**: 消息列表 [{"role": "user/assistant/system", "content": "..."}]
    - **model**: 模型名称 (可选)
    - **temperature**: 温度 0-1 (默认 0.7)
    - **max_tokens**: 最大 token 数 (默认 2048)
    """
    try:
        async with OllamaClient() as client:
            messages = [
                {"role": m.role, "content": m.content} for m in request.messages
            ]
            response = await client.chat(
                messages=messages,
                model=request.model,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            )
            return GenerateResponse(
                response=response, model=request.model or client.model
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"聊天失败: {str(e)}")


@router.post("/analyze-tweet", response_model=TweetAnalysisResponse)
async def analyze_tweet(request: AnalyzeTweetRequest):
    """
    分析推文

    - **tweet_text**: 推文文本
    - **analysis_type**: 分析类型
        - "full": 完整分析 (情感+股票代码+摘要+标签)
        - "sentiment": 仅情感分析
        - "tickers": 仅提取股票代码
        - "tags": 仅生成标签
        - "summary": 仅生成摘要
    """
    try:
        async with OllamaClient() as client:
            analyzer = TweetAnalyzer(client)

            if request.analysis_type == "full":
                result = await analyzer.full_analysis(request.tweet_text)
                return TweetAnalysisResponse(
                    sentiment=SentimentResult(**result["sentiment"]),
                    tickers=result["tickers"],
                    summary=result["summary"],
                    tags=result["tags"],
                    analyzed_at=result["analyzed_at"],
                )

            elif request.analysis_type == "sentiment":
                sentiment = await analyzer.analyze_sentiment(request.tweet_text)
                return TweetAnalysisResponse(sentiment=SentimentResult(**sentiment))

            elif request.analysis_type == "tickers":
                tickers = await analyzer.extract_tickers(request.tweet_text)
                return TweetAnalysisResponse(tickers=tickers)

            elif request.analysis_type == "tags":
                tags = await analyzer.generate_tags(request.tweet_text)
                return TweetAnalysisResponse(tags=tags)

            elif request.analysis_type == "summary":
                summary = await analyzer.summarize(request.tweet_text)
                return TweetAnalysisResponse(summary=summary)

            else:
                raise HTTPException(
                    status_code=400, detail=f"未知的分析类型: {request.analysis_type}"
                )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/batch-analyze")
async def batch_analyze_tweets_text(
    tweets: List[str], analysis_type: str = Query("sentiment", description="分析类型")
):
    """
    批量分析推文文本

    - **tweets**: 推文文本列表 (最多 10 条)
    - **analysis_type**: 分析类型 (sentiment/tickers/tags)
    """
    if len(tweets) > 10:
        raise HTTPException(status_code=400, detail="最多支持 10 条推文")

    try:
        async with OllamaClient() as client:
            analyzer = TweetAnalyzer(client)
            results = []

            for tweet in tweets:
                try:
                    if analysis_type == "sentiment":
                        result = await analyzer.analyze_sentiment(tweet)
                    elif analysis_type == "tickers":
                        result = await analyzer.extract_tickers(tweet)
                    elif analysis_type == "tags":
                        result = await analyzer.generate_tags(tweet)
                    else:
                        result = await analyzer.full_analysis(tweet)

                    results.append(
                        {
                            "tweet": tweet[:100] + "..." if len(tweet) > 100 else tweet,
                            "result": result,
                            "success": True,
                        }
                    )
                except Exception as e:
                    results.append(
                        {
                            "tweet": tweet[:100] + "..." if len(tweet) > 100 else tweet,
                            "error": str(e),
                            "success": False,
                        }
                    )

            return {"results": results, "total": len(results)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量分析失败: {str(e)}")


# ============================================================
# 数据库推文分析端点
# ============================================================


class AnalyzeTweetByIdRequest(BaseModel):
    """按 ID 分析推文请求"""

    tweet_id: int


class BatchAnalyzeDbRequest(BaseModel):
    """批量分析数据库推文请求"""

    limit: int = 10  # 每批处理数量


class AnalyzeDbResponse(BaseModel):
    """数据库分析响应"""

    processed: int
    success: int
    failed: int
    results: List[dict] = []
    message: Optional[str] = None
    error: Optional[str] = None


@router.post("/analyze-tweet-by-id")
async def analyze_tweet_by_id(request: AnalyzeTweetByIdRequest):
    """
    根据推文 ID 进行完整分析并保存结果到数据库

    - **tweet_id**: 推文 ID
    """
    try:
        from app.core.supabase import get_supabase_service
        from app.services.ai_service import analyze_and_save_tweet

        supabase = get_supabase_service()

        # 获取推文
        result = (
            supabase.table("kol_tweets")
            .select("id, tweet_text, ai_analyzed_at")
            .eq("id", request.tweet_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=404, detail=f"推文 #{request.tweet_id} 不存在"
            )

        tweet = result.data[0]

        # 分析并保存
        analysis = await analyze_and_save_tweet(tweet["id"], tweet["tweet_text"])

        return {"tweet_id": request.tweet_id, "analysis": analysis, "success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/analyze-pending-tweets", response_model=AnalyzeDbResponse)
async def analyze_pending_tweets(request: BatchAnalyzeDbRequest):
    """
    批量分析数据库中未处理的推文

    - **limit**: 每批处理的推文数量 (默认 10，最大 50)
    """
    if request.limit > 50:
        raise HTTPException(status_code=400, detail="每批最多处理 50 条推文")

    try:
        from app.services.ai_service import batch_analyze_tweets

        stats = await batch_analyze_tweets(limit=request.limit)

        return AnalyzeDbResponse(
            processed=stats.get("processed", 0),
            success=stats.get("success", 0),
            failed=stats.get("failed", 0),
            results=stats.get("results", []),
            message=stats.get("message"),
            error=stats.get("error"),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量分析失败: {str(e)}")


@router.get("/pending-count")
async def get_pending_analysis_count():
    """
    获取待分析推文数量
    """
    try:
        from app.core.supabase import get_supabase_service

        supabase = get_supabase_service()

        # 查询未分析的推文数量
        result = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .is_("ai_analyzed_at", "null")
            .execute()
        )

        pending_count = result.count or 0

        # 查询已分析的推文数量
        analyzed_result = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .not_.is_("ai_analyzed_at", "null")
            .execute()
        )

        analyzed_count = analyzed_result.count or 0

        return {
            "pending": pending_count,
            "analyzed": analyzed_count,
            "total": pending_count + analyzed_count,
            "progress_percent": (
                round(analyzed_count / (pending_count + analyzed_count) * 100, 1)
                if (pending_count + analyzed_count) > 0
                else 0
            ),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计失败: {str(e)}")
