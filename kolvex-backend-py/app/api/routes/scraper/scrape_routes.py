"""
爬取 API 路由
提供 KOL 推文爬取相关的 REST API 端点
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict, Optional

from app.services.scraper import (
    BatchKOLScraper,
    get_supabase_client,
    load_cookies,
)

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
            .select("username")
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

    # 提取用户名列表
    usernames = [profile["username"] for profile in kol_profiles]

    # 初始化任务状态
    create_task(
        task_id,
        usernames=usernames,
        source="kol_profiles",
        total_kols=len(usernames),
    )

    # 在后台执行爬取
    background_tasks.add_task(
        run_all_profiles_scrape_task,
        task_id,
        usernames,
        max_posts_per_user,
    )

    return ScrapeResponse(
        success=True,
        message=f"🚀 开始爬取 kol_profiles 表中的 {len(usernames)} 个 KOL 的最新推文",
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
