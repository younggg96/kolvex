"""
爬取 API 路由
提供 KOL 推文爬取相关的 REST API 端点
支持多平台：Twitter、小红书等
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Optional

from app.services.scraper import (
    BatchKOLScraper,
    get_supabase_client,
    load_cookies,
)
from app.services.xiaohongshu.scraper import load_cookies as load_xhs_cookies

from .schemas import (
    BatchScrapeRequest,
    ScrapeResponse,
)
from .task_manager import (
    generate_task_id,
    create_task,
    get_task,
    list_tasks,
)
from .background_tasks import (
    run_scrape_task,
    run_all_profiles_scrape_task,
    run_multi_platform_scrape_task,
)

router = APIRouter()


# ============================================================
# 爬取 API 端点
# ============================================================


@router.post("/scrape", response_model=ScrapeResponse)
def scrape_kols(
    request: BatchScrapeRequest,
    background_tasks: BackgroundTasks,
):
    """
    批量爬取 KOL 推文

    请求示例:
    ```json
    {
        "usernames": ["elonmusk", "unusual_whales", "zerohedge"],
        "max_posts_per_user": 10
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

    # 初始化任务状态
    create_task(task_id, usernames=request.usernames)

    # 在后台执行爬取
    background_tasks.add_task(
        run_scrape_task,
        task_id,
        request.usernames,
        request.max_posts_per_user,
    )

    return ScrapeResponse(
        success=True,
        message=f"爬取任务已启动，共 {len(request.usernames)} 个用户",
        task_id=task_id,
    )


@router.post("/scrape-all-profiles", response_model=ScrapeResponse)
def scrape_all_kol_profiles(
    max_posts_per_user: int = 10,
    platform: Optional[str] = None,
    background_tasks: BackgroundTasks = None,
):
    """
    🔄 爬取数据库中所有 KOL 的最新推文/帖子

    从 Supabase 的 kol_profiles 表获取所有 KOL，
    根据不同平台调用不同的爬虫服务：
    - Twitter: 使用 BatchKOLScraper
    - 小红书: 使用 XiaohongshuScraper

    - 已存在的推文会自动跳过
    - 新推文会添加到 kol_tweets 表

    参数：
    - max_posts_per_user: 每个用户最多爬取的推文数量 (默认: 10)
    - platform: 可选，指定只爬取某个平台 (twitter, xiaohongshu)
    """
    # 获取 Supabase 客户端
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase 未连接")

    # 从 kol_profiles 表获取所有 KOL（包含 platform 信息）
    try:
        query = (
            supabase.table("kol_profiles")
            .select("username, platform, platform_user_id")
            .eq("is_active", True)
        )

        # 如果指定了平台，只获取该平台的 KOL
        if platform:
            query = query.eq("platform", platform)

        profiles_result = query.execute()
        kol_profiles = profiles_result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 KOL 列表失败: {str(e)}")

    if not kol_profiles:
        msg = "kol_profiles 表中没有活跃的 KOL"
        if platform:
            msg = f"kol_profiles 表中没有活跃的 {platform} 平台 KOL"
        raise HTTPException(status_code=404, detail=msg)

    # 按平台分组 KOL
    kols_by_platform: Dict[str, List[Dict]] = {}
    for profile in kol_profiles:
        plat = profile.get("platform", "twitter")  # 默认 twitter
        if plat not in kols_by_platform:
            kols_by_platform[plat] = []
        kols_by_platform[plat].append(
            {
                "username": profile["username"],
                "platform_user_id": profile.get("platform_user_id"),
            }
        )

    # 检查各平台的 cookies
    available_platforms = []
    missing_cookies = []

    for plat in kols_by_platform.keys():
        if plat == "twitter":
            if load_cookies():
                available_platforms.append(plat)
            else:
                missing_cookies.append(
                    f"Twitter (运行: python -m app.services.scraper --setup)"
                )
        elif plat == "xiaohongshu":
            if load_xhs_cookies():
                available_platforms.append(plat)
            else:
                missing_cookies.append(
                    f"小红书 (运行: python -m app.services.xiaohongshu --login)"
                )
        else:
            # 其他平台暂不支持
            missing_cookies.append(f"{plat} (暂不支持)")

    if not available_platforms:
        raise HTTPException(
            status_code=400,
            detail=f"没有可用的爬虫。缺少 cookies: {', '.join(missing_cookies)}",
        )

    # 生成任务 ID
    task_id = generate_task_id()

    # 统计信息
    total_kols = sum(len(kols) for kols in kols_by_platform.values())
    platform_summary = {plat: len(kols) for plat, kols in kols_by_platform.items()}

    # 初始化任务状态
    create_task(
        task_id,
        source="kol_profiles",
        total_kols=total_kols,
        platforms=platform_summary,
        kols_by_platform=kols_by_platform,
    )

    # 在后台执行多平台爬取
    background_tasks.add_task(
        run_multi_platform_scrape_task,
        task_id,
        kols_by_platform,
        max_posts_per_user,
    )

    # 构建响应消息
    platform_msgs = [f"{plat}: {count} 个" for plat, count in platform_summary.items()]

    return ScrapeResponse(
        success=True,
        message=f"🚀 开始多平台爬取，共 {total_kols} 个 KOL ({', '.join(platform_msgs)})",
        task_id=task_id,
    )


@router.post("/scrape-single/{username}", response_model=Dict)
def scrape_single_user(
    username: str,
    max_posts: int = 10,
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

        # 这里使用同步方式执行
        stats = scraper.batch_scrape(usernames=[username])

        return {
            "success": True,
            "username": username,
            "stats": stats,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"爬取失败: {str(e)}")


# ============================================================
# 任务查询端点
# ============================================================


@router.get("/task/{task_id}", response_model=Dict)
def get_task_status(task_id: str):
    """
    获取爬取任务状态

    返回任务的当前状态、统计信息和错误（如果有）
    """
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    return task


@router.get("/tasks", response_model=List[Dict])
def list_recent_tasks(limit: int = 10):
    """
    列出最近的爬取任务
    """
    return list_tasks(limit)
