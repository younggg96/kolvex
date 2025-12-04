"""
KOL 批量爬虫 API 路由
提供 REST API 接口用于批量爬取 KOL 推文和 Profile 信息
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from enum import Enum
import asyncio
from datetime import datetime, timezone

# 导入爬虫模块
from app.services.batch_kol_scraper import (
    BatchKOLScraper,
    get_supabase_client,
    get_stats,
    load_cookies,
    KOL_LIST,
    get_all_kols,
    COOKIES_FILE,
)

router = APIRouter(prefix="/scraper", tags=["KOL Scraper"])


# ============================================================
# 请求/响应模型
# ============================================================


class KOLItem(BaseModel):
    """单个 KOL 信息"""

    username: str = Field(..., description="KOL 用户名，如 elonmusk")
    description: Optional[str] = Field(None, description="KOL 描述")
    category: Optional[str] = Field(None, description="KOL 类别")


class BatchScrapeRequest(BaseModel):
    """批量爬取请求"""

    usernames: List[str] = Field(
        ..., description="要爬取的用户名列表", min_length=1, max_length=50
    )
    max_posts_per_user: int = Field(
        10, ge=1, le=50, description="每个用户最多爬取的推文数量"
    )
    category: Optional[str] = Field(None, description="统一分类（可选）")


class BatchScrapeWithDetailsRequest(BaseModel):
    """带详细信息的批量爬取请求"""

    kols: List[KOLItem] = Field(
        ..., description="KOL 列表，包含用户名和描述", min_length=1, max_length=50
    )
    max_posts_per_user: int = Field(
        10, ge=1, le=50, description="每个用户最多爬取的推文数量"
    )


class ScrapeResponse(BaseModel):
    """爬取响应"""

    success: bool
    message: str
    task_id: Optional[str] = None
    stats: Optional[Dict] = None


class ScraperStats(BaseModel):
    """爬虫统计信息"""

    total_tweets: int
    total_profiles: int
    by_user: Dict[str, int]
    by_category: Dict[str, int]


class TaskStatus(str, Enum):
    """任务状态枚举"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================================
# 任务管理（简单内存存储，生产环境建议用 Redis）
# ============================================================

_scrape_tasks: Dict[str, Dict] = {}


def generate_task_id() -> str:
    """生成任务 ID"""
    return f"scrape_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{id(datetime.now(timezone.utc)) % 10000}"


# ============================================================
# API 端点
# ============================================================


@router.get("/status", response_model=Dict)
def get_scraper_status():
    """
    获取爬虫状态

    检查：
    - Cookies 是否存在
    - Supabase 连接状态
    - 预定义 KOL 列表
    """
    cookies = load_cookies()
    supabase = get_supabase_client()

    return {
        "cookies_available": cookies is not None,
        "cookies_file": str(COOKIES_FILE),
        "supabase_connected": supabase is not None,
        "predefined_kol_count": len(get_all_kols()),
        "predefined_categories": list(KOL_LIST.keys()),
    }


@router.get("/stats", response_model=Dict)
def get_database_stats():
    """
    获取数据库统计信息

    返回：
    - 总推文数
    - 按用户统计
    - 按类别统计
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    stats = get_stats(supabase)

    # 获取 KOL profiles 统计
    try:
        profiles_result = (
            supabase.table("kol_profiles")
            .select("username, verification_type", count="exact")
            .execute()
        )
        total_profiles = profiles_result.count or 0

        # 按认证类型统计
        verified_counts = {}
        for profile in profiles_result.data:
            v_type = profile.get("verification_type") or "None"
            verified_counts[v_type] = verified_counts.get(v_type, 0) + 1

        stats["total_profiles"] = total_profiles
        stats["by_verification"] = verified_counts
    except Exception:
        stats["total_profiles"] = 0
        stats["by_verification"] = {}

    return stats


@router.get("/kols", response_model=Dict)
def get_predefined_kols():
    """
    获取预定义的 KOL 列表

    返回按类别组织的 KOL 列表
    """
    return {
        "categories": KOL_LIST,
        "total": len(get_all_kols()),
    }


@router.delete("/tweets/old", response_model=Dict)
def delete_old_tweets(days: int = 7, include_null_dates: bool = True):
    """
    🗑️ 删除指定天数之前的旧推文

    参数：
    - days: 保留最近 N 天的推文，删除更早的数据（默认: 7 天）
    - include_null_dates: 是否也删除没有日期的推文（默认: True）

    示例：
    - DELETE /api/scraper/tweets/old?days=7  → 删除 7 天前的推文
    - DELETE /api/scraper/tweets/old?days=30 → 删除 30 天前的推文
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    from datetime import timedelta

    # 计算截止日期（使用简单的日期格式）
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime(
        "%Y-%m-%d"
    )

    try:
        deleted_old = 0
        deleted_null = 0

        # 1. 删除日期早于截止日期的推文
        count_old = (
            supabase.table("kol_tweets")
            .select("id", count="exact")
            .lt("created_at", cutoff_date)
            .execute()
        )
        deleted_old = count_old.count or 0

        if deleted_old > 0:
            supabase.table("kol_tweets").delete().lt(
                "created_at", cutoff_date
            ).execute()

        # 2. 删除 created_at 为 NULL 的推文
        if include_null_dates:
            count_null = (
                supabase.table("kol_tweets")
                .select("id", count="exact")
                .is_("created_at", "null")
                .execute()
            )
            deleted_null = count_null.count or 0

            if deleted_null > 0:
                supabase.table("kol_tweets").delete().is_(
                    "created_at", "null"
                ).execute()

        total_deleted = deleted_old + deleted_null

        if total_deleted == 0:
            return {
                "success": True,
                "message": f"没有找到需要删除的推文",
                "deleted_count": 0,
                "cutoff_date": cutoff_date,
            }

        return {
            "success": True,
            "message": f"✅ 已删除 {total_deleted} 条旧推文（{deleted_old} 条早于 {cutoff_date}，{deleted_null} 条无日期）",
            "deleted_count": total_deleted,
            "deleted_before_cutoff": deleted_old,
            "deleted_null_dates": deleted_null,
            "cutoff_date": cutoff_date,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.get("/tweets/date-stats", response_model=Dict)
def get_tweets_date_stats():
    """
    📊 查看推文日期分布统计

    用于诊断数据库中推文的时间分布
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 获取所有推文的 created_at
        result = supabase.table("kol_tweets").select("created_at").execute()
        tweets = result.data or []

        # 统计
        total = len(tweets)
        null_dates = 0
        by_year = {}
        recent_7_days = 0
        recent_30_days = 0

        from datetime import timedelta

        now = datetime.now(timezone.utc)
        cutoff_7 = now - timedelta(days=7)
        cutoff_30 = now - timedelta(days=30)

        for tweet in tweets:
            created_at = tweet.get("created_at")
            if not created_at:
                null_dates += 1
                continue

            try:
                # 解析时间
                if isinstance(created_at, str):
                    tweet_time = datetime.fromisoformat(
                        created_at.replace("Z", "+00:00")
                    )
                else:
                    tweet_time = created_at

                year = tweet_time.year
                by_year[year] = by_year.get(year, 0) + 1

                if tweet_time.tzinfo is None:
                    tweet_time = tweet_time.replace(tzinfo=timezone.utc)

                if tweet_time >= cutoff_7:
                    recent_7_days += 1
                if tweet_time >= cutoff_30:
                    recent_30_days += 1
            except:
                null_dates += 1

        # 按年份排序
        by_year_sorted = dict(sorted(by_year.items(), reverse=True))

        return {
            "total_tweets": total,
            "null_dates": null_dates,
            "recent_7_days": recent_7_days,
            "recent_30_days": recent_30_days,
            "older_than_7_days": total - recent_7_days - null_dates,
            "by_year": by_year_sorted,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.delete("/tweets/all", response_model=Dict)
def delete_all_tweets(confirm: bool = False):
    """
    ⚠️ 删除所有推文数据（危险操作！）

    参数：
    - confirm: 必须设为 true 才能执行删除
    """
    if not confirm:
        raise HTTPException(
            status_code=400, detail="请添加 ?confirm=true 参数确认删除所有推文"
        )

    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    try:
        # 先统计总数
        count_result = (
            supabase.table("kol_tweets").select("id", count="exact").execute()
        )
        total_count = count_result.count or 0

        if total_count == 0:
            return {
                "success": True,
                "message": "表中没有数据",
                "deleted_count": 0,
            }

        # 删除所有数据（使用 neq 条件删除所有记录）
        supabase.table("kol_tweets").delete().neq("id", -1).execute()

        return {
            "success": True,
            "message": f"⚠️ 已删除所有 {total_count} 条推文",
            "deleted_count": total_count,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.post("/scrape", response_model=ScrapeResponse)
def scrape_kols_sync(
    request: BatchScrapeRequest,
    background_tasks: BackgroundTasks,
):
    """
    同步爬取 KOL 列表（简单用户名列表）

    请求示例:
    ```json
    {
        "usernames": ["elonmusk", "unusual_whales", "zerohedge"],
        "max_posts_per_user": 10,
        "category": "custom"
    }
    ```

    注意：此端点会在后台执行爬取任务，立即返回任务 ID
    """
    # 检查 cookies
    cookies = load_cookies()
    if not cookies:
        raise HTTPException(
            status_code=400, detail="未找到 cookies 文件，请先运行 setup 模式登录"
        )

    # 生成任务 ID
    task_id = generate_task_id()

    # 准备 KOL 列表
    kol_list = [
        (username, request.category or "api_request") for username in request.usernames
    ]

    # 初始化任务状态
    _scrape_tasks[task_id] = {
        "status": TaskStatus.PENDING,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "usernames": request.usernames,
        "stats": None,
        "error": None,
    }

    # 在后台执行爬取
    background_tasks.add_task(
        _run_scrape_task,
        task_id,
        kol_list,
        request.max_posts_per_user,
    )

    return ScrapeResponse(
        success=True,
        message=f"爬取任务已启动，共 {len(request.usernames)} 个用户",
        task_id=task_id,
    )


@router.post("/scrape-detailed", response_model=ScrapeResponse)
def scrape_kols_detailed(
    request: BatchScrapeWithDetailsRequest,
    background_tasks: BackgroundTasks,
):
    """
    爬取 KOL 列表（带详细信息）

    请求示例:
    ```json
    {
        "kols": [
            {"username": "elonmusk", "description": "Tesla CEO", "category": "tech"},
            {"username": "unusual_whales", "description": "Options flow data", "category": "news_flow"}
        ],
        "max_posts_per_user": 10
    }
    ```
    """
    # 检查 cookies
    cookies = load_cookies()
    if not cookies:
        raise HTTPException(
            status_code=400, detail="未找到 cookies 文件，请先运行 setup 模式登录"
        )

    # 生成任务 ID
    task_id = generate_task_id()

    # 准备 KOL 列表
    kol_list = [
        (kol.username, kol.category or "api_request", kol.description)
        for kol in request.kols
    ]

    # 初始化任务状态
    _scrape_tasks[task_id] = {
        "status": TaskStatus.PENDING,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "usernames": [kol.username for kol in request.kols],
        "stats": None,
        "error": None,
    }

    # 在后台执行爬取
    background_tasks.add_task(
        _run_scrape_task_detailed,
        task_id,
        kol_list,
        request.max_posts_per_user,
    )

    return ScrapeResponse(
        success=True,
        message=f"爬取任务已启动，共 {len(request.kols)} 个用户",
        task_id=task_id,
    )


@router.post("/scrape-all-profiles", response_model=ScrapeResponse)
def scrape_all_kol_profiles(
    max_posts_per_user: int = 10,
    background_tasks: BackgroundTasks = None,
):
    """
    🔄 爬取数据库中所有 KOL 的最新推文

    从 Supabase 的 kol_profiles 表获取所有 KOL，
    然后爬取每个 KOL 的最新推文（按时间排序）。

    - 已存在的推文会自动跳过
    - 新推文会添加到 kol_tweets 表

    参数：
    - max_posts_per_user: 每个用户最多爬取的推文数量 (默认: 10)
    """
    # 检查 cookies
    cookies = load_cookies()
    if not cookies:
        raise HTTPException(
            status_code=400, detail="未找到 cookies 文件，请先运行 setup 模式登录"
        )

    # 获取 Supabase 客户端
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    # 从 kol_profiles 表获取所有 KOL
    try:
        profiles_result = (
            supabase.table("kol_profiles")
            .select("username, category, description")
            .eq("is_active", True)
            .execute()
        )
        kol_profiles = profiles_result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 KOL 列表失败: {str(e)}")

    if not kol_profiles:
        raise HTTPException(status_code=404, detail="kol_profiles 表中没有活跃的 KOL")

    # 生成任务 ID
    task_id = generate_task_id()

    # 准备 KOL 列表
    kol_list = [
        (
            profile["username"],
            profile.get("category") or "from_profiles",
            profile.get("description") or f"KOL from profiles table",
        )
        for profile in kol_profiles
    ]

    # 初始化任务状态
    _scrape_tasks[task_id] = {
        "status": TaskStatus.PENDING,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "kol_profiles",
        "total_kols": len(kol_list),
        "usernames": [kol[0] for kol in kol_list],
        "stats": None,
        "error": None,
    }

    # 在后台执行爬取
    background_tasks.add_task(
        _run_all_profiles_scrape_task,
        task_id,
        kol_list,
        max_posts_per_user,
    )

    return ScrapeResponse(
        success=True,
        message=f"🚀 开始爬取 kol_profiles 表中的 {len(kol_list)} 个 KOL 的最新推文",
        task_id=task_id,
    )


@router.post("/scrape-categories", response_model=ScrapeResponse)
def scrape_predefined_categories(
    categories: List[str] = None,
    max_posts_per_user: int = 10,
    background_tasks: BackgroundTasks = None,
):
    """
    爬取预定义类别的 KOL

    可选类别：
    - news_flow: 新闻与数据流
    - short_macro: 空头与宏观
    - charts_data: 图表与数据
    - institutional: 机构与主流
    - retail_meme: 散户与 Meme

    如果不指定类别，将爬取所有预定义 KOL
    """
    # 检查 cookies
    cookies = load_cookies()
    if not cookies:
        raise HTTPException(
            status_code=400, detail="未找到 cookies 文件，请先运行 setup 模式登录"
        )

    # 验证类别
    if categories:
        invalid = [c for c in categories if c not in KOL_LIST]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"无效的类别: {invalid}。可用类别: {list(KOL_LIST.keys())}",
            )

    # 生成任务 ID
    task_id = generate_task_id()

    # 初始化任务状态
    _scrape_tasks[task_id] = {
        "status": TaskStatus.PENDING,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "categories": categories or list(KOL_LIST.keys()),
        "stats": None,
        "error": None,
    }

    # 在后台执行爬取
    background_tasks.add_task(
        _run_category_scrape_task,
        task_id,
        categories,
        max_posts_per_user,
    )

    total_kols = sum(
        len(kols)
        for cat, kols in KOL_LIST.items()
        if categories is None or cat in categories
    )

    return ScrapeResponse(
        success=True,
        message=f"爬取任务已启动，共 {total_kols} 个预定义 KOL",
        task_id=task_id,
    )


@router.get("/task/{task_id}", response_model=Dict)
def get_task_status(task_id: str):
    """
    获取爬取任务状态

    返回任务的当前状态、统计信息和错误（如果有）
    """
    if task_id not in _scrape_tasks:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    return _scrape_tasks[task_id]


@router.get("/tasks", response_model=List[Dict])
def list_tasks(limit: int = 10):
    """
    列出最近的爬取任务
    """
    tasks = list(_scrape_tasks.items())
    # 按创建时间倒序
    tasks.sort(key=lambda x: x[1].get("created_at", ""), reverse=True)

    return [{"task_id": task_id, **task_data} for task_id, task_data in tasks[:limit]]


@router.post("/scrape-single/{username}", response_model=Dict)
def scrape_single_user(
    username: str,
    max_posts: int = 10,
    category: Optional[str] = None,
    description: Optional[str] = None,
):
    """
    同步爬取单个用户（阻塞式，等待完成）

    适用于测试或需要立即获取结果的场景

    注意：此端点会阻塞直到爬取完成，可能需要较长时间
    """
    # 检查 cookies
    cookies = load_cookies()
    if not cookies:
        raise HTTPException(
            status_code=400, detail="未找到 cookies 文件，请先运行 setup 模式登录"
        )

    try:
        scraper = BatchKOLScraper(
            headless=True,
            max_posts_per_user=max_posts,
        )

        kol_list = [(username, description or f"API request for @{username}")]

        # 这里使用同步方式执行
        stats = scraper.batch_scrape(kol_list=kol_list)

        return {
            "success": True,
            "username": username,
            "stats": stats,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"爬取失败: {str(e)}")


# ============================================================
# 后台任务函数
# ============================================================


def _run_scrape_task(
    task_id: str,
    kol_list: List[tuple],
    max_posts_per_user: int,
):
    """执行爬取任务（简单列表）"""
    try:
        _scrape_tasks[task_id]["status"] = TaskStatus.RUNNING
        _scrape_tasks[task_id]["started_at"] = datetime.now(timezone.utc).isoformat()

        scraper = BatchKOLScraper(
            headless=True,
            max_posts_per_user=max_posts_per_user,
        )

        stats = scraper.batch_scrape(kol_list=kol_list)

        _scrape_tasks[task_id]["status"] = TaskStatus.COMPLETED
        _scrape_tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
        _scrape_tasks[task_id]["stats"] = stats

    except Exception as e:
        _scrape_tasks[task_id]["status"] = TaskStatus.FAILED
        _scrape_tasks[task_id]["error"] = str(e)
        _scrape_tasks[task_id]["failed_at"] = datetime.now(timezone.utc).isoformat()


def _run_scrape_task_detailed(
    task_id: str,
    kol_list: List[tuple],
    max_posts_per_user: int,
):
    """执行爬取任务（带详细信息）"""
    try:
        _scrape_tasks[task_id]["status"] = TaskStatus.RUNNING
        _scrape_tasks[task_id]["started_at"] = datetime.now(timezone.utc).isoformat()

        scraper = BatchKOLScraper(
            headless=True,
            max_posts_per_user=max_posts_per_user,
        )

        # 转换为 batch_scrape 需要的格式
        # kol_list 格式: [(username, category, description), ...]
        # batch_scrape 需要: [(username, description), ...]
        simple_list = [(username, desc) for username, cat, desc in kol_list]

        stats = scraper.batch_scrape(kol_list=simple_list)

        _scrape_tasks[task_id]["status"] = TaskStatus.COMPLETED
        _scrape_tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
        _scrape_tasks[task_id]["stats"] = stats

    except Exception as e:
        _scrape_tasks[task_id]["status"] = TaskStatus.FAILED
        _scrape_tasks[task_id]["error"] = str(e)
        _scrape_tasks[task_id]["failed_at"] = datetime.now(timezone.utc).isoformat()


def _run_category_scrape_task(
    task_id: str,
    categories: Optional[List[str]],
    max_posts_per_user: int,
):
    """执行预定义类别爬取任务"""
    try:
        _scrape_tasks[task_id]["status"] = TaskStatus.RUNNING
        _scrape_tasks[task_id]["started_at"] = datetime.now(timezone.utc).isoformat()

        scraper = BatchKOLScraper(
            headless=True,
            max_posts_per_user=max_posts_per_user,
        )

        stats = scraper.batch_scrape(categories=categories)

        _scrape_tasks[task_id]["status"] = TaskStatus.COMPLETED
        _scrape_tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
        _scrape_tasks[task_id]["stats"] = stats

    except Exception as e:
        _scrape_tasks[task_id]["status"] = TaskStatus.FAILED
        _scrape_tasks[task_id]["error"] = str(e)
        _scrape_tasks[task_id]["failed_at"] = datetime.now(timezone.utc).isoformat()


def _run_all_profiles_scrape_task(
    task_id: str,
    kol_list: List[tuple],
    max_posts_per_user: int,
):
    """
    执行 kol_profiles 表中所有 KOL 的爬取任务

    kol_list 格式: [(username, category, description), ...]
    """
    try:
        _scrape_tasks[task_id]["status"] = TaskStatus.RUNNING
        _scrape_tasks[task_id]["started_at"] = datetime.now(timezone.utc).isoformat()

        scraper = BatchKOLScraper(
            headless=True,
            max_posts_per_user=max_posts_per_user,
        )

        # 转换为 batch_scrape 需要的格式
        # batch_scrape 期望: [(username, description), ...]
        # 但我们要传递 category，所以使用完整的三元组格式
        # 让 batch_scrape 内部处理

        # 使用自定义 kol_list 调用 batch_scrape
        # batch_scrape 接受 [(username, description), ...] 格式
        simple_list = [(username, desc) for username, cat, desc in kol_list]

        stats = scraper.batch_scrape(kol_list=simple_list)

        _scrape_tasks[task_id]["status"] = TaskStatus.COMPLETED
        _scrape_tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
        _scrape_tasks[task_id]["stats"] = stats

        # 计算耗时
        started = datetime.fromisoformat(_scrape_tasks[task_id]["started_at"])
        completed = datetime.fromisoformat(_scrape_tasks[task_id]["completed_at"])
        duration = (completed - started).total_seconds()
        _scrape_tasks[task_id]["duration_seconds"] = duration
        _scrape_tasks[task_id][
            "duration_human"
        ] = f"{int(duration // 60)}分{int(duration % 60)}秒"

    except Exception as e:
        _scrape_tasks[task_id]["status"] = TaskStatus.FAILED
        _scrape_tasks[task_id]["error"] = str(e)
        _scrape_tasks[task_id]["failed_at"] = datetime.now(timezone.utc).isoformat()
