"""
Kolvex Twitter MCP Server
提供 Twitter/X 内容追踪工具，供 AI Agent 调用

启动方式:
    python -m app.mcp.twitter_mcp_server

或者使用 uvicorn（HTTP 模式）:
    uvicorn app.mcp.twitter_mcp_server:mcp --host 0.0.0.0 --port 8001
"""

from typing import List, Dict, Optional
from mcp.server.fastmcp import FastMCP

from app.services.twitter_tracker import (
    fetch_profile_tweets as svc_fetch_profile_tweets,
    search_tweets as svc_search_tweets,
    fetch_user_info as svc_fetch_user_info,
)

# 创建 MCP Server
mcp = FastMCP(
    "kolvex-twitter",
    json_response=True,
    instructions="""
    Kolvex Twitter MCP Server - 提供 Twitter/X 内容追踪功能
    
    可用工具:
    1. fetch_profile_tweets: 按账号 + 时间范围抓取推文
    2. search_tweets: 按 Twitter 高级搜索语句抓取推文
    3. fetch_user_info: 获取 Twitter 用户基本信息
    
    使用建议:
    - 对于追踪特定 KOL 的发言，使用 fetch_profile_tweets
    - 对于搜索特定话题/股票的讨论，使用 search_tweets
    - 时间范围建议不超过 30 天，max_items 建议不超过 200
    """,
)


@mcp.tool()
def fetch_profile_tweets(
    handle: str,
    since: str,
    until: str,
    max_items: int = 200,
    tweet_language: Optional[str] = "en",
    sort: str = "Latest",
) -> List[Dict]:
    """
    按账号 + 时间范围抓取该账号的推文

    Args:
        handle: Twitter 账号名，可以是 "@elonmusk" 或 "elonmusk"
        since: 起始日期（YYYY-MM-DD 格式）
        until: 结束日期（YYYY-MM-DD 格式，通常不含当日）
        max_items: 最多抓取条数（建议 200 以内）
        tweet_language: 推文语言（如 "en"、"zh"，默认 "en"）
        sort: 排序方式 "Latest" 或 "Top"（默认 "Latest"）

    Returns:
        推文列表，每条包含: id, text, created_at, user_name, like_count,
        retweet_count, reply_count, permalink 等字段

    Example:
        fetch_profile_tweets(
            handle="@elonmusk",
            since="2025-11-20",
            until="2025-11-27",
            max_items=100
        )
    """
    return svc_fetch_profile_tweets(
        handle=handle,
        since=since,
        until=until,
        max_items=max_items,
        tweet_language=tweet_language,
        sort=sort,
    )


@mcp.tool()
def search_tweets(
    query: str,
    max_items: int = 200,
    tweet_language: Optional[str] = "en",
    sort: str = "Latest",
) -> List[Dict]:
    """
    按 Twitter 高级搜索语句抓取推文

    Args:
        query: Twitter 高级搜索语句，例如:
            - "TSLA (bullish OR bearish) min_faves:10"
            - "(NVDA OR AMD) (AI OR GPU) -filter:nativeretweets"
            - "from:elonmusk TSLA"
            - "$AAPL stock price"
        max_items: 最多抓取条数（建议 200 以内）
        tweet_language: 推文语言（如 "en"、"zh"，默认 "en"）
        sort: 排序方式 "Latest" 或 "Top"（默认 "Latest"）

    Returns:
        推文列表，每条包含: id, text, created_at, user_name, like_count,
        retweet_count, reply_count, permalink 等字段

    Example:
        search_tweets(
            query="TSLA (stock OR shares) lang:en -filter:nativeretweets",
            max_items=100
        )
    """
    return svc_search_tweets(
        query=query,
        max_items=max_items,
        tweet_language=tweet_language,
        sort=sort,
    )


@mcp.tool()
def fetch_user_info(handle: str) -> Optional[Dict]:
    """
    获取 Twitter 用户的基本信息

    Args:
        handle: Twitter 账号名（如 "@elonmusk" 或 "elonmusk"）

    Returns:
        用户信息字典，包含: screen_name, name, description, followers_count,
        following_count, tweet_count, verified, profile_image_url
        如果用户不存在或获取失败，返回 None

    Example:
        fetch_user_info(handle="@elonmusk")
    """
    return svc_fetch_user_info(handle=handle)


if __name__ == "__main__":
    import os
    import uvicorn

    # 获取传输方式，默认使用 stdio
    transport = os.getenv("MCP_TRANSPORT", "stdio")
    host = os.getenv("MCP_HOST", "0.0.0.0")
    port = int(os.getenv("MCP_PORT", "8001"))

    print(f"🚀 Starting Kolvex Twitter MCP Server...")
    print(f"📡 Transport: {transport}")

    if transport == "stdio":
        # 标准输入输出模式（适合本地 CLI 调用和 Cursor MCP）
        mcp.run()
    else:
        # HTTP 模式（适合远程调用）
        # 使用 uvicorn 启动 SSE 服务
        print(f"🌐 Host: {host}:{port}")
        uvicorn.run(
            "app.mcp.twitter_mcp_server:mcp",
            host=host,
            port=port,
            log_level="info",
        )
