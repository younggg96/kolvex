"""
YFinance 股票数据服务
提供市场行情、基本面、交易持仓、分析师评级和新闻数据
"""

from app.services.yfinance.client import YFinanceService, get_yfinance_service

__all__ = ["YFinanceService", "get_yfinance_service"]











