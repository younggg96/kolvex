"""
Twitter/X 内容追踪服务 - 通过 Apify Tweet Scraper 抓取推文
"""

import os
from typing import List, Dict, Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

# Apify 配置
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
ACTOR_ID = os.getenv("APIFY_TWEET_SCRAPER_ACTOR_ID", "apidojo~tweet-scraper")

if not APIFY_TOKEN:
    import warnings

    warnings.warn(
        "请在环境变量或 .env 中配置 APIFY_TOKEN，否则 Twitter 追踪功能将不可用"
    )

APIFY_ACTOR_URL = f"https://api.apify.com/v2/acts/{ACTOR_ID}/run-sync-get-dataset-items"


def _call_apify(input_payload: Dict) -> List[Dict]:
    """
    调用 Tweet Scraper V2，并返回 items 列表

    Args:
        input_payload: Apify Actor 的输入参数

    Returns:
        List[Dict]: 返回的推文列表

    Raises:
        RuntimeError: 如果 APIFY_TOKEN 未配置
        httpx.HTTPStatusError: 如果 API 调用失败
    """
    if not APIFY_TOKEN:
        raise RuntimeError("APIFY_TOKEN 未配置，无法调用 Twitter 追踪功能")

    params = {"token": APIFY_TOKEN}

    with httpx.Client(timeout=120) as client:
        resp = client.post(APIFY_ACTOR_URL, params=params, json=input_payload)
        resp.raise_for_status()
        data = resp.json()

    if isinstance(data, list):
        return data
    return data.get("items", [])


def get_raw_tweets(query: str, max_items: int = 5) -> List[Dict]:
    """
    调试用：直接返回 Apify 原始数据，不做任何处理
    """
    payload: Dict = {
        "searchTerms": [query],
        "maxItems": max_items,
        "sort": "Latest",
    }
    return _call_apify(payload)


def _normalize_items(raw: List[Dict]) -> List[Dict]:
    """
    将 Tweet Scraper 原始字段标准化为统一结构

    Args:
        raw: 原始推文数据列表

    Returns:
        List[Dict]: 标准化后的推文列表
    """
    out: List[Dict] = []

    for it in raw:
        # 处理用户信息（可能在不同字段中）
        user = it.get("user", {}) if isinstance(it.get("user"), dict) else {}

        out.append(
            {
                "id": it.get("id_str") or it.get("id"),
                "tweet_id": it.get("id_str") or it.get("id"),
                "created_at": it.get("createdAt") or it.get("created_at"),
                "text": it.get("full_text") or it.get("fullText") or it.get("text"),
                "user_name": (
                    user.get("screen_name")
                    if user
                    else it.get("author_username") or it.get("userScreenName")
                ),
                "user_display_name": (
                    user.get("name")
                    if user
                    else it.get("author_name") or it.get("userName")
                ),
                "like_count": it.get("favorite_count")
                or it.get("likeCount")
                or it.get("likes")
                or 0,
                "retweet_count": it.get("retweet_count")
                or it.get("retweetCount")
                or it.get("retweets")
                or 0,
                "reply_count": it.get("reply_count")
                or it.get("replyCount")
                or it.get("replies")
                or 0,
                "quote_count": it.get("quote_count")
                or it.get("quoteCount")
                or it.get("quotes")
                or 0,
                "view_count": it.get("viewCount") or it.get("views") or 0,
                "lang": it.get("lang") or it.get("tweetLanguage"),
                "permalink": it.get("url") or it.get("tweetUrl") or it.get("permalink"),
                "is_retweet": it.get("isRetweet", False),
                "is_quote": it.get("isQuote", False),
                "is_reply": it.get("isReply", False),
                "media": it.get("media") or it.get("entities", {}).get("media", []),
                "hashtags": it.get("hashtags")
                or it.get("entities", {}).get("hashtags", []),
                "mentions": it.get("mentions")
                or it.get("entities", {}).get("user_mentions", []),
            }
        )

    return out


def fetch_profile_tweets(
    handle: str,
    since: str,
    until: str,
    max_items: int = 200,
    tweet_language: Optional[str] = "en",
    sort: str = "Latest",
) -> List[Dict]:
    """
    按账号 + 时间范围抓取推文

    Args:
        handle: Twitter 账号名（如 "@elonmusk" 或 "elonmusk"）
        since: 起始日期（YYYY-MM-DD 格式）
        until: 结束日期（YYYY-MM-DD 格式，通常不含当日）
        max_items: 最多抓取条数（默认 200）
        tweet_language: 推文语言（如 "en"、"zh"，默认 "en"）
        sort: 排序方式（"Latest" 或 "Top"，默认 "Latest"）

    Returns:
        List[Dict]: 标准化后的推文列表

    Example:
        >>> tweets = fetch_profile_tweets(
        ...     handle="@elonmusk",
        ...     since="2025-11-20",
        ...     until="2025-11-27",
        ...     max_items=100
        ... )
    """
    # 清理 handle，去掉 @ 前缀
    clean_handle = handle.lstrip("@")

    # 构建搜索查询
    search_query = f"from:{clean_handle} since:{since} until:{until}"

    payload: Dict = {
        "searchTerms": [search_query],
        "maxItems": max_items,
        "sort": sort,
        "includeSearchTerms": False,
    }

    if tweet_language:
        payload["tweetLanguage"] = tweet_language

    raw_items = _call_apify(payload)
    return _normalize_items(raw_items)


def search_tweets(
    query: str,
    max_items: int = 200,
    tweet_language: Optional[str] = "en",
    sort: str = "Latest",
) -> List[Dict]:
    """
    按 Twitter 高级搜索语句抓取推文

    Args:
        query: Twitter 高级搜索语句，例如：
            - "TSLA (bullish OR bearish) min_faves:10"
            - "(NVDA OR AMD) (AI OR GPU) -filter:nativeretweets"
            - "from:elonmusk TSLA"
        max_items: 最多抓取条数（默认 200）
        tweet_language: 推文语言（如 "en"、"zh"，默认 "en"）
        sort: 排序方式（"Latest" 或 "Top"，默认 "Latest"）

    Returns:
        List[Dict]: 标准化后的推文列表

    Example:
        >>> tweets = search_tweets(
        ...     query="TSLA (stock OR shares) lang:en -filter:nativeretweets",
        ...     max_items=100
        ... )
    """
    payload: Dict = {
        "searchTerms": [query],
        "maxItems": max_items,
        "sort": sort,
        "includeSearchTerms": True,
    }

    if tweet_language:
        payload["tweetLanguage"] = tweet_language

    raw_items = _call_apify(payload)
    return _normalize_items(raw_items)


def fetch_user_info(handle: str) -> Optional[Dict]:
    """
    获取 Twitter 用户的基本信息

    Args:
        handle: Twitter 账号名（如 "@elonmusk" 或 "elonmusk"）

    Returns:
        Optional[Dict]: 用户信息，如果获取失败返回 None
    """
    clean_handle = handle.lstrip("@")

    # 抓取该用户最近 1 条推文，从中提取用户信息
    try:
        payload: Dict = {
            "searchTerms": [f"from:{clean_handle}"],
            "maxItems": 1,
            "sort": "Latest",
        }

        raw_items = _call_apify(payload)

        if raw_items:
            item = raw_items[0]
            user = item.get("user", {}) if isinstance(item.get("user"), dict) else {}

            return {
                "screen_name": user.get("screen_name")
                or item.get("userScreenName")
                or clean_handle,
                "name": user.get("name") or item.get("userName"),
                "description": user.get("description") or item.get("userDescription"),
                "followers_count": user.get("followers_count")
                or item.get("userFollowersCount"),
                "following_count": user.get("friends_count")
                or item.get("userFriendsCount"),
                "tweet_count": user.get("statuses_count") or item.get("userTweetCount"),
                "verified": user.get("verified") or item.get("userVerified", False),
                "profile_image_url": user.get("profile_image_url_https")
                or item.get("userProfileImageUrl"),
            }

        return None

    except Exception:
        return None
