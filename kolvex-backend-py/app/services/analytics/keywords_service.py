"""
关键词分析服务
提取高频关键词
"""

import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import Counter
from .base_service import BaseAnalyticsService


class KeywordsService(BaseAnalyticsService):
    """关键词分析服务"""

    # 停用词列表
    STOPWORDS = {
        # 英文
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "must",
        "shall",
        "can",
        "need",
        "dare",
        "this",
        "that",
        "these",
        "those",
        "i",
        "you",
        "he",
        "she",
        "it",
        "we",
        "they",
        "what",
        "which",
        "who",
        "whom",
        "whose",
        "where",
        "when",
        "why",
        "how",
        "all",
        "each",
        "every",
        "both",
        "few",
        "more",
        "most",
        "other",
        "some",
        "such",
        "no",
        "nor",
        "not",
        "only",
        "own",
        "same",
        "so",
        "than",
        "too",
        "very",
        "just",
        "but",
        "and",
        "or",
        "if",
        "because",
        "as",
        "until",
        "while",
        "of",
        "at",
        "by",
        "for",
        "with",
        "about",
        "against",
        "between",
        "into",
        "through",
        "during",
        "before",
        "after",
        "above",
        "below",
        "to",
        "from",
        "up",
        "down",
        "in",
        "out",
        "on",
        "off",
        "over",
        "under",
        "again",
        "further",
        "then",
        "once",
        "here",
        "there",
        "when",
        "where",
        "why",
        "how",
        "any",
        "also",
        "their",
        "them",
        "his",
        "her",
        "its",
        "my",
        "your",
        "our",
        "amp",
        "rt",
        "https",
        "http",
        "com",
        "www",
        "twitter",
    }

    async def get_keyword_analysis(
        self,
        limit: int = 50,
        days: Optional[int] = None,
        exclude_tickers: bool = True,
    ) -> Dict[str, Any]:
        """
        获取关键词分析

        Args:
            limit: 返回关键词数量
            days: 分析天数
            exclude_tickers: 是否排除股票代码

        Returns:
            关键词分析数据
        """
        # 构建查询
        query = self.supabase.table("kol_tweets").select(
            "tweet_text, ai_tickers, ai_tags"
        )

        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.gte("created_at", start_date.isoformat())

        result = query.execute()
        tweets = result.data or []

        # 收集所有 tickers（用于排除）
        all_tickers = set()
        if exclude_tickers:
            for t in tweets:
                for ticker in t.get("ai_tickers") or []:
                    all_tickers.add(ticker.upper())
                    all_tickers.add(f"${ticker.upper()}")

        # 提取关键词
        word_counts: Counter = Counter()

        for t in tweets:
            text = t.get("tweet_text", "")
            # 分词
            words = re.findall(r"[a-zA-Z]{3,}|\$[a-zA-Z]+|[一-龥]{2,}", text)

            for word in words:
                word_clean = word.upper().strip("$")
                word_lower = word.lower()

                # 过滤
                if word_lower in self.STOPWORDS:
                    continue
                if exclude_tickers and (
                    word_clean in all_tickers or word in all_tickers
                ):
                    continue
                if len(word) < 3:
                    continue

                word_counts[word_lower] += 1

        # 获取 Top N
        top_keywords = [
            {"word": word, "count": count}
            for word, count in word_counts.most_common(limit)
        ]

        # AI Tags 统计
        tag_counts: Counter = Counter()
        for t in tweets:
            for tag in t.get("ai_tags") or []:
                tag_counts[tag] += 1

        top_tags = [
            {"tag": tag, "count": count} for tag, count in tag_counts.most_common(20)
        ]

        return {
            "keywords": top_keywords,
            "ai_tags": top_tags,
            "total_tweets_analyzed": len(tweets),
        }
