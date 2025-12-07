"""
Scraper API Pydantic 模型
定义请求和响应的数据结构
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from enum import Enum


# ============================================================
# 任务状态枚举
# ============================================================


class TaskStatus(str, Enum):
    """任务状态枚举"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================================
# 请求模型
# ============================================================


class BatchScrapeRequest(BaseModel):
    """批量爬取请求 - 只需用户名列表"""

    usernames: List[str] = Field(
        ..., description="要爬取的用户名列表", min_length=1, max_length=50
    )
    max_posts_per_user: int = Field(
        10, ge=1, le=50, description="每个用户最多爬取的推文数量"
    )


# ============================================================
# 响应模型
# ============================================================


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
