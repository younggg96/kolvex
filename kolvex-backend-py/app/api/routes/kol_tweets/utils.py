"""
KOL Tweets API 辅助函数
"""

import json
from typing import Any

from .schemas import (
    KOLTweet,
    MediaItem,
    SentimentAnalysis,
    TradingSignal,
    StockRelatedInfo,
)


def parse_json_field(value: Any, default: Any = None) -> Any:
    """解析可能是 JSON 字符串或已解析对象的字段"""
    if value is None:
        return default
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return value


def convert_row_to_tweet(row: dict, profile: dict = None) -> KOLTweet:
    """
    将数据库行转换为 KOLTweet 对象

    Args:
        row: 数据库查询返回的行
        profile: 可选的 profile 信息字典

    Returns:
        KOLTweet 对象
    """
    profile = profile or {}

    # 解析 media_urls
    media_urls = parse_json_field(row.get("media_urls"))

    # 优先使用推文中的 avatar_url，如果没有则使用 profile 中的
    avatar_url = row.get("avatar_url") or profile.get("avatar_url")

    # 解析 AI 分析字段
    sentiment = None
    if row.get("ai_sentiment"):
        sentiment = SentimentAnalysis(
            value=row.get("ai_sentiment"),
            confidence=row.get("ai_sentiment_confidence"),
            reasoning=row.get("ai_sentiment_reasoning"),
        )

    # 解析交易信号
    signal_data = parse_json_field(row.get("ai_trading_signal"))
    trading_signal = TradingSignal(**signal_data) if signal_data else None

    # 解析 tickers 和 tags
    ai_tickers = parse_json_field(row.get("ai_tickers"), [])
    ai_tags = parse_json_field(row.get("ai_tags"), [])

    # 解析股市相关性字段
    stock_related = None
    if row.get("ai_is_stock_related") is not None:
        stock_related = StockRelatedInfo(
            is_related=row.get("ai_is_stock_related", False),
            confidence=row.get("ai_stock_related_confidence"),
            reason=row.get("ai_stock_related_reason"),
        )

    return KOLTweet(
        id=row["id"],
        username=row["username"],
        display_name=profile.get("display_name"),
        avatar_url=avatar_url,
        tweet_text=row["tweet_text"],
        created_at=row.get("created_at"),
        permalink=row.get("permalink"),
        media_urls=[MediaItem(**m) for m in media_urls] if media_urls else None,
        is_repost=row.get("is_repost", False) or False,
        original_author=row.get("original_author"),
        like_count=row.get("like_count", 0) or 0,
        retweet_count=row.get("retweet_count", 0) or 0,
        reply_count=row.get("reply_count", 0) or 0,
        bookmark_count=row.get("bookmark_count", 0) or 0,
        views_count=row.get("views_count", 0) or 0,
        scraped_at=row.get("scraped_at"),
        # AI 分析字段
        sentiment=sentiment,
        tickers=ai_tickers,
        tags=ai_tags,
        trading_signal=trading_signal,
        summary=row.get("ai_summary"),
        is_stock_related=stock_related,
        ai_analyzed_at=row.get("ai_analyzed_at"),
        ai_model=row.get("ai_model"),
    )


# 推文查询的标准字段列表
TWEET_SELECT_FIELDS = (
    "id, username, tweet_text, created_at, permalink, "
    "avatar_url, media_urls, is_repost, original_author, "
    "like_count, retweet_count, reply_count, bookmark_count, views_count, "
    "scraped_at, "
    "ai_sentiment, ai_sentiment_confidence, ai_sentiment_reasoning, "
    "ai_tickers, ai_tags, ai_trading_signal, "
    "ai_summary, "
    "ai_is_stock_related, ai_stock_related_confidence, ai_stock_related_reason, "
    "ai_analyzed_at, ai_model"
)

