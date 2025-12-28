"""
分析服务基类
提供通用的数据库连接和辅助方法
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from app.core.supabase import get_supabase_service


class BaseAnalyticsService:
    """分析服务基类"""

    def __init__(self):
        self.supabase = get_supabase_service()

    def get_date_range(self, days: Optional[int]) -> Optional[datetime]:
        """计算开始日期"""
        if days:
            return datetime.utcnow() - timedelta(days=days)
        return None

    def safe_get(self, data: Dict, key: str, default: Any = 0) -> Any:
        """安全获取字典值"""
        value = data.get(key, default)
        return value if value is not None else default

    def calc_avg(self, data: List) -> float:
        """计算平均值"""
        return round(sum(data) / len(data), 2) if data else 0

    def calc_stats(self, data: List[int]) -> Dict:
        """计算统计摘要"""
        if not data:
            return {}
        sorted_data = sorted(data)
        n = len(sorted_data)
        return {
            "mean": round(sum(data) / n, 2),
            "median": sorted_data[n // 2],
            "min": min(data),
            "max": max(data),
            "total": sum(data),
            "count": n,
            "p25": sorted_data[n // 4],
            "p75": sorted_data[3 * n // 4],
        }

