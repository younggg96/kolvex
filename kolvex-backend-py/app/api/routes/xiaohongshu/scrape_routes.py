"""
小红书爬取 API 路由
提供小红书美股帖子爬取相关的 REST API 端点

注意：API 使用无界面模式爬取，需要预先登录保存 cookies。
登录命令：python -m app.services.xiaohongshu --login
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Dict

from app.services.xiaohongshu import (
    XiaohongshuScraper,
    get_supabase_client,
    DEFAULT_KEYWORDS,
)
from app.services.xiaohongshu.scraper import load_cookies

from .schemas import (
    KeywordScrapeRequest,
    SingleKeywordRequest,
    ScrapeResponse,
)
from .task_manager import (
    generate_task_id,
    create_task,
    get_task,
    list_tasks,
)
from .background_tasks import (
    run_xhs_scrape_task,
    run_xhs_default_keywords_task,
    run_xhs_single_keyword_task,
)

router = APIRouter()


def _check_login_status():
    """检查登录状态，未登录则抛出异常"""
    cookies = load_cookies()
    if not cookies or len(cookies) == 0:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "未登录",
                "message": "请先在服务器上执行登录命令",
                "login_command": "python -m app.services.xiaohongshu --login",
            }
        )
    return cookies


# ============================================================
# 爬取 API 端点
# ============================================================


@router.post("/scrape", response_model=ScrapeResponse)
def scrape_keywords(
    request: KeywordScrapeRequest,
    background_tasks: BackgroundTasks,
):
    """
    📱 批量爬取小红书美股帖子

    请求示例:
    ```json
    {
        "keywords": ["美股", "英伟达", "特斯拉"],
        "max_posts": 20,
        "fetch_details": true
    }
    ```

    注意：
    - 此端点会在后台执行爬取任务，立即返回任务 ID
    - 需要先登录：python -m app.services.xiaohongshu --login
    """
    # 检查登录状态
    _check_login_status()

    # 生成任务 ID
    task_id = generate_task_id()

    # 初始化任务状态
    create_task(
        task_id,
        keywords=request.keywords,
        total_keywords=len(request.keywords),
        fetch_details=request.fetch_details,
    )

    # 在后台执行爬取
    background_tasks.add_task(
        run_xhs_scrape_task,
        task_id,
        request.keywords,
        request.max_posts,
        request.fetch_details,
    )

    return ScrapeResponse(
        success=True,
        message=f"🚀 小红书爬取任务已启动，共 {len(request.keywords)} 个关键词",
        task_id=task_id,
    )


@router.post("/scrape-default", response_model=ScrapeResponse)
def scrape_default_keywords(
    max_posts: int = 20,
    fetch_details: bool = True,
    background_tasks: BackgroundTasks = None,
):
    """
    🔄 爬取默认美股关键词

    使用预设的美股相关关键词进行爬取:
    - 美股、美股投资、美股分析
    - NVDA、英伟达、特斯拉
    - 苹果股票、纳斯达克、标普500

    参数：
    - max_posts: 每个关键词最多爬取的帖子数量 (默认: 20)
    - fetch_details: 是否获取详情页 (默认: true)
    
    注意：需要先登录：python -m app.services.xiaohongshu --login
    """
    # 检查登录状态
    _check_login_status()
    
    # 生成任务 ID
    task_id = generate_task_id()

    # 初始化任务状态
    create_task(
        task_id,
        keywords=DEFAULT_KEYWORDS,
        total_keywords=len(DEFAULT_KEYWORDS),
        fetch_details=fetch_details,
    )

    # 在后台执行爬取
    background_tasks.add_task(
        run_xhs_default_keywords_task,
        task_id,
        max_posts,
        fetch_details,
    )

    return ScrapeResponse(
        success=True,
        message=f"🚀 开始爬取 {len(DEFAULT_KEYWORDS)} 个默认美股关键词",
        task_id=task_id,
    )


@router.post("/scrape-single", response_model=Dict)
def scrape_single_keyword_sync(
    request: SingleKeywordRequest,
):
    """
    🔍 同步爬取单个关键词（阻塞式，等待完成）

    适用于测试或需要立即获取结果的场景

    注意：
    - 此端点会阻塞直到爬取完成，可能需要较长时间
    - 需要先登录：python -m app.services.xiaohongshu --login
    """
    # 检查登录状态
    _check_login_status()
    
    try:
        scraper = XiaohongshuScraper(
            headless=True,
            max_posts=request.max_posts,
            fetch_details=request.fetch_details,
        )

        # 这里使用同步方式执行
        stats = scraper.scrape(keywords=[request.keyword])

        return {
            "success": True,
            "keyword": request.keyword,
            "stats": stats,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"爬取失败: {str(e)}")


@router.post("/scrape-single/{keyword}", response_model=ScrapeResponse)
def scrape_single_keyword_async(
    keyword: str,
    max_posts: int = 20,
    fetch_details: bool = True,
    background_tasks: BackgroundTasks = None,
):
    """
    🔍 异步爬取单个关键词

    参数：
    - keyword: 搜索关键词（URL 路径参数）
    - max_posts: 最多爬取的帖子数量 (默认: 20)
    - fetch_details: 是否获取详情页 (默认: true)
    
    注意：需要先登录：python -m app.services.xiaohongshu --login
    """
    # 检查登录状态
    _check_login_status()
    
    # 生成任务 ID
    task_id = generate_task_id()

    # 初始化任务状态
    create_task(
        task_id,
        keywords=[keyword],
        total_keywords=1,
        fetch_details=fetch_details,
    )

    # 在后台执行爬取
    background_tasks.add_task(
        run_xhs_single_keyword_task,
        task_id,
        keyword,
        max_posts,
        fetch_details,
    )

    return ScrapeResponse(
        success=True,
        message=f"🔍 开始爬取关键词: {keyword}",
        task_id=task_id,
    )


# ============================================================
# 任务查询端点
# ============================================================


@router.get("/task/{task_id}", response_model=Dict)
def get_task_status(task_id: str):
    """
    📋 获取爬取任务状态

    返回任务的当前状态、统计信息和错误（如果有）
    """
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    return task


@router.get("/tasks", response_model=List[Dict])
def list_recent_tasks(limit: int = 10):
    """
    📋 列出最近的爬取任务
    """
    return list_tasks(limit)

