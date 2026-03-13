"""
Pre-built screening strategy templates.
Each strategy defines a set of filters, a default sort, and metadata for the frontend.
"""

from typing import Any, Dict, List, Optional


STRATEGIES: Dict[str, Dict[str, Any]] = {
    "value": {
        "id": "value",
        "name": "Value Investing",
        "name_zh": "价值投资",
        "description": "Find undervalued stocks with strong fundamentals, inspired by Warren Buffett.",
        "description_zh": "寻找基本面扎实的低估值股票，灵感来自巴菲特。",
        "icon": "gem",
        "filters": {
            "pe_ratio": {"min": 1, "max": 20},
            "price_to_book": {"max": 3},
            "debt_to_equity": {"max": 100},
            "return_on_equity": {"min": 0.10},
            "dividend_yield": {"min": 0.01},
        },
        "sort_by": "pe_ratio",
        "sort_direction": "asc",
    },
    "growth": {
        "id": "growth",
        "name": "Growth Stocks",
        "name_zh": "成长股",
        "description": "High-growth companies with strong revenue and earnings expansion.",
        "description_zh": "收入和利润高速增长的公司。",
        "icon": "trending-up",
        "filters": {
            "revenue_growth": {"min": 0.15},
            "earnings_growth": {"min": 0.10},
            "market_cap": {"min": 2_000_000_000},
        },
        "sort_by": "revenue_growth",
        "sort_direction": "desc",
    },
    "momentum": {
        "id": "momentum",
        "name": "Momentum",
        "name_zh": "动量策略",
        "description": "Stocks with strong recent price performance and high trading volume.",
        "description_zh": "近期价格表现强劲、成交量活跃的股票。",
        "icon": "zap",
        "filters": {
            "change_percent_5d": {"min": 3},
            "market_cap": {"min": 1_000_000_000},
        },
        "sort_by": "change_percent_5d",
        "sort_direction": "desc",
    },
    "dividend": {
        "id": "dividend",
        "name": "Dividend Income",
        "name_zh": "红利策略",
        "description": "High-yield dividend stocks with sustainable payout ratios.",
        "description_zh": "高股息率、分红可持续的优质股票。",
        "icon": "wallet",
        "filters": {
            "dividend_yield": {"min": 0.025},
            "profit_margins": {"min": 0.05},
            "market_cap": {"min": 5_000_000_000},
        },
        "sort_by": "dividend_yield",
        "sort_direction": "desc",
    },
    "oversold": {
        "id": "oversold",
        "name": "Oversold Bounce",
        "name_zh": "超跌反弹",
        "description": "Stocks near 52-week lows that may be poised for a rebound.",
        "description_zh": "接近52周低点、可能即将反弹的股票。",
        "icon": "arrow-down-up",
        "filters": {
            "pct_from_52w_low": {"max": 15},
            "market_cap": {"min": 1_000_000_000},
            "profit_margins": {"min": 0},
        },
        "sort_by": "pct_from_52w_low",
        "sort_direction": "asc",
    },
    "quality": {
        "id": "quality",
        "name": "Quality GARP",
        "name_zh": "优质成长",
        "description": "Growth at a reasonable price — balancing quality, growth and valuation.",
        "description_zh": "合理估值下的优质成长——兼顾质量、增长与价格。",
        "icon": "award",
        "filters": {
            "peg_ratio": {"min": 0.1, "max": 2},
            "return_on_equity": {"min": 0.12},
            "revenue_growth": {"min": 0.05},
            "debt_to_equity": {"max": 150},
        },
        "sort_by": "peg_ratio",
        "sort_direction": "asc",
    },
}


def get_strategy(strategy_id: str) -> Optional[Dict[str, Any]]:
    return STRATEGIES.get(strategy_id)


def list_strategies() -> List[Dict[str, Any]]:
    return list(STRATEGIES.values())
