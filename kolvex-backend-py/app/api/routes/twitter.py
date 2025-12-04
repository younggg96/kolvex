"""
Twitter/X 内容追踪 API 路由
提供 REST API 接口用于调试和直接访问

支持两种爬取方式：
1. Apify Tweet Scraper (默认) - 稳定可靠，需要 APIFY_TOKEN
2. Playwright 浏览器自动化 - 免费但需要手动登录，适合本地开发
"""

from fastapi import APIRouter, Query, HTTPException, BackgroundTasks
from typing import List, Dict, Optional
from enum import Enum

from app.services.twitter_tracker import (
    fetch_profile_tweets,
    search_tweets,
    fetch_user_info,
    get_raw_tweets,
)

from app.services.twitter_playwright_scraper import (
    scrape_x_user,
    scrape_x_search,
    playwright_scrape_user_sync,
    playwright_scrape_search_sync,
    check_playwright_available,
)

router = APIRouter(prefix="/x", tags=["Twitter/X"])


class ScrapeMethod(str, Enum):
    """爬取方式枚举"""

    APIFY = "apify"
    PLAYWRIGHT = "playwright"


@router.get("/profile-tweets", response_model=List[Dict])
def get_profile_tweets(
    handle: str = Query(..., description="Twitter 账号名，如 @elonmusk 或 elonmusk"),
    since: str = Query(..., description="起始日期，格式 YYYY-MM-DD"),
    until: str = Query(..., description="结束日期，格式 YYYY-MM-DD"),
    max_items: int = Query(50, le=500, description="最多抓取条数"),
    tweet_language: Optional[str] = Query("en", description="推文语言，如 en、zh"),
    sort: str = Query("Latest", description="排序方式: Latest 或 Top"),
) -> List[Dict]:
    """
    按账号 + 时间范围抓取推文

    示例请求:
        GET /api/v1/x/profile-tweets?handle=@elonmusk&since=2025-11-20&until=2025-11-27
    """
    try:
        return fetch_profile_tweets(
            handle=handle,
            since=since,
            until=until,
            max_items=max_items,
            tweet_language=tweet_language,
            sort=sort,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"抓取推文失败: {str(e)}")


@router.get("/search", response_model=List[Dict])
def get_search_tweets(
    query: str = Query(..., description="Twitter 高级搜索语句"),
    max_items: int = Query(50, le=500, description="最多抓取条数"),
    tweet_language: Optional[str] = Query("en", description="推文语言，如 en、zh"),
    sort: str = Query("Latest", description="排序方式: Latest 或 Top"),
) -> List[Dict]:
    """
    按 Twitter 高级搜索语句抓取推文

    查询语法示例:
        - TSLA (bullish OR bearish) min_faves:10
        - (NVDA OR AMD) (AI OR GPU) -filter:nativeretweets
        - from:elonmusk TSLA
        - $AAPL stock price

    示例请求:
        GET /api/v1/x/search?query=TSLA%20stock&max_items=50
    """
    try:
        return search_tweets(
            query=query,
            max_items=max_items,
            tweet_language=tweet_language,
            sort=sort,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索推文失败: {str(e)}")


@router.get("/user/{handle}", response_model=Optional[Dict])
def get_user_info(
    handle: str,
) -> Optional[Dict]:
    """
    获取 Twitter 用户基本信息

    示例请求:
        GET /api/v1/x/user/elonmusk
    """
    try:
        user_info = fetch_user_info(handle=handle)
        if user_info is None:
            raise HTTPException(
                status_code=404, detail=f"用户 @{handle.lstrip('@')} 未找到"
            )
        return user_info
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取用户信息失败: {str(e)}")


@router.get("/debug/raw", response_model=List[Dict])
def get_raw_data(
    query: str = Query(..., description="搜索语句，如 from:elonmusk"),
    max_items: int = Query(1, le=10, description="最多抓取条数"),
) -> List[Dict]:
    """
    调试用：返回 Apify 原始数据，不做任何处理

    示例请求:
        GET /api/v1/x/debug/raw?query=from:MentoviaX&max_items=1
    """
    try:
        return get_raw_tweets(query=query, max_items=max_items)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"调试请求失败: {str(e)}")


# ============================================================
# Playwright 爬虫 API 端点
# ============================================================


@router.get("/playwright/status")
def get_playwright_status() -> Dict:
    """
    检查 Playwright 爬虫是否可用

    示例请求:
        GET /api/v1/x/playwright/status
    """
    is_available = check_playwright_available()
    return {
        "available": is_available,
        "message": (
            "Playwright 已安装并可用"
            if is_available
            else "Playwright 未安装，请运行: pip install playwright && playwright install chromium"
        ),
    }


@router.get("/playwright/user/{handle}", response_model=List[Dict])
def scrape_user_with_playwright(
    handle: str,
    max_posts: int = Query(20, le=100, description="最多抓取条数"),
    headless: bool = Query(
        True, description="是否使用无头模式（建议先在有头模式下登录保存 cookies）"
    ),
) -> List[Dict]:
    """
    使用 Playwright 爬取指定用户的推文

    ⚠️ 注意事项：
    1. 首次使用需要在有头模式下手动登录 X 账户
    2. 登录后 cookies 会被保存，后续可使用无头模式
    3. 无头模式可能被 X 检测，导致爬取失败

    推荐流程：
    1. 先在本地运行命令行工具登录：
       python -m app.services.twitter_playwright_scraper <username> -n 5
    2. 登录成功后，cookies 会保存到本地
    3. 然后通过 API 使用无头模式爬取

    示例请求:
        GET /api/v1/x/playwright/user/elonmusk?max_posts=10
    """
    if not check_playwright_available():
        raise HTTPException(
            status_code=503,
            detail="Playwright 未安装。请运行: pip install playwright && playwright install chromium",
        )

    try:
        tweets = playwright_scrape_user_sync(
            username=handle,
            max_posts=max_posts,
            headless=headless,
        )
        return tweets
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Playwright 爬取失败: {str(e)}")


@router.get("/playwright/search", response_model=List[Dict])
def search_with_playwright(
    query: str = Query(..., description="搜索关键词或高级搜索语句"),
    max_posts: int = Query(20, le=100, description="最多抓取条数"),
    headless: bool = Query(True, description="是否使用无头模式"),
) -> List[Dict]:
    """
    使用 Playwright 搜索推文

    ⚠️ 同样需要先登录保存 cookies

    示例请求:
        GET /api/v1/x/playwright/search?query=TSLA%20stock&max_posts=10
    """
    if not check_playwright_available():
        raise HTTPException(
            status_code=503,
            detail="Playwright 未安装。请运行: pip install playwright && playwright install chromium",
        )

    try:
        tweets = playwright_scrape_search_sync(
            query=query,
            max_posts=max_posts,
            headless=headless,
        )
        return tweets
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Playwright 搜索失败: {str(e)}")


# ============================================================
# 统一接口 - 支持选择爬取方式
# ============================================================


@router.get("/unified/user/{handle}", response_model=List[Dict])
def get_user_tweets_unified(
    handle: str,
    method: ScrapeMethod = Query(
        ScrapeMethod.APIFY, description="爬取方式: apify 或 playwright"
    ),
    max_items: int = Query(20, le=200, description="最多抓取条数"),
    since: Optional[str] = Query(
        None, description="起始日期 (仅 apify)，格式 YYYY-MM-DD"
    ),
    until: Optional[str] = Query(
        None, description="结束日期 (仅 apify)，格式 YYYY-MM-DD"
    ),
    tweet_language: Optional[str] = Query(
        "en", description="推文语言 (仅 apify)，如 en、zh"
    ),
    headless: bool = Query(True, description="无头模式 (仅 playwright)"),
) -> List[Dict]:
    """
    统一的用户推文获取接口，支持选择不同的爬取方式

    **Apify 方式** (method=apify):
    - 需要配置 APIFY_TOKEN
    - 支持时间范围过滤
    - 更稳定可靠

    **Playwright 方式** (method=playwright):
    - 免费，无需 API Token
    - 需要先手动登录保存 cookies
    - 可能被检测限制

    示例请求:
        - Apify: GET /api/v1/x/unified/user/elonmusk?method=apify&since=2025-11-01&until=2025-11-30
        - Playwright: GET /api/v1/x/unified/user/elonmusk?method=playwright&max_items=10
    """
    try:
        if method == ScrapeMethod.APIFY:
            # 使用 Apify
            if not since or not until:
                # 如果没有指定日期，使用最近 7 天
                from datetime import datetime, timedelta

                until_date = datetime.now()
                since_date = until_date - timedelta(days=7)
                since = since or since_date.strftime("%Y-%m-%d")
                until = until or until_date.strftime("%Y-%m-%d")

            return fetch_profile_tweets(
                handle=handle,
                since=since,
                until=until,
                max_items=max_items,
                tweet_language=tweet_language,
            )

        elif method == ScrapeMethod.PLAYWRIGHT:
            # 使用 Playwright
            if not check_playwright_available():
                raise HTTPException(
                    status_code=503,
                    detail="Playwright 未安装。请运行: pip install playwright && playwright install chromium",
                )

            return playwright_scrape_user_sync(
                username=handle,
                max_posts=max_items,
                headless=headless,
            )

        else:
            raise HTTPException(status_code=400, detail=f"未知的爬取方式: {method}")

    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取推文失败: {str(e)}")


@router.get("/unified/search", response_model=List[Dict])
def search_tweets_unified(
    query: str = Query(..., description="搜索关键词或高级搜索语句"),
    method: ScrapeMethod = Query(
        ScrapeMethod.APIFY, description="爬取方式: apify 或 playwright"
    ),
    max_items: int = Query(20, le=200, description="最多抓取条数"),
    tweet_language: Optional[str] = Query("en", description="推文语言 (仅 apify)"),
    sort: str = Query("Latest", description="排序方式 (仅 apify): Latest 或 Top"),
    headless: bool = Query(True, description="无头模式 (仅 playwright)"),
) -> List[Dict]:
    """
    统一的推文搜索接口，支持选择不同的爬取方式

    示例请求:
        - Apify: GET /api/v1/x/unified/search?query=TSLA%20stock&method=apify
        - Playwright: GET /api/v1/x/unified/search?query=TSLA%20stock&method=playwright
    """
    try:
        if method == ScrapeMethod.APIFY:
            return search_tweets(
                query=query,
                max_items=max_items,
                tweet_language=tweet_language,
                sort=sort,
            )

        elif method == ScrapeMethod.PLAYWRIGHT:
            if not check_playwright_available():
                raise HTTPException(
                    status_code=503,
                    detail="Playwright 未安装。请运行: pip install playwright && playwright install chromium",
                )

            return playwright_scrape_search_sync(
                query=query,
                max_posts=max_items,
                headless=headless,
            )

        else:
            raise HTTPException(status_code=400, detail=f"未知的爬取方式: {method}")

    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索推文失败: {str(e)}")
