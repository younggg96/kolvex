"""
小红书 API 模块
提供小红书帖子爬取和查询的 REST API

主要端点：

📡 爬取端点：
- POST /api/xiaohongshu/scrape              - 批量爬取关键词（后台任务）
- POST /api/xiaohongshu/scrape-default      - 爬取默认美股关键词
- POST /api/xiaohongshu/scrape-single       - 同步爬取单个关键词
- POST /api/xiaohongshu/scrape-single/{kw}  - 异步爬取单个关键词
- GET  /api/xiaohongshu/task/{task_id}      - 获取任务状态
- GET  /api/xiaohongshu/tasks               - 列出最近任务

📄 帖子端点：
- GET  /api/xiaohongshu/posts               - 获取帖子列表（支持多种筛选）
- GET  /api/xiaohongshu/posts/{note_id}     - 获取单个帖子详情

👤 KOL 端点：
- GET  /api/xiaohongshu/kols                - 获取 KOL 列表
- GET  /api/xiaohongshu/kols/{user_id}      - 获取 KOL 详情和帖子

返回数据包含：
- 基础信息（标题、内容、链接）
- 作者信息（名称、头像）
- 媒体资源（封面图、图片列表、视频）
- 互动数据（点赞、收藏、评论、分享）
- AI 分析（情感、股票代码、摘要、交易信号）

注意：爬取功能需要先登录：
  python -m app.services.xiaohongshu --login
"""

from fastapi import APIRouter

from .posts_routes import router as posts_router
from .scrape_routes import router as scrape_router
from .kols_routes import router as kols_router

# 创建主路由器
router = APIRouter(prefix="/xiaohongshu", tags=["小红书"])

# 注册子路由
router.include_router(posts_router)
router.include_router(scrape_router)
router.include_router(kols_router)

__all__ = ["router"]

