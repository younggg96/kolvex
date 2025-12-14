"""
市场数据 API 路由
基于 yfinance 提供股票市场行情、基本面、交易持仓、分析师与新闻数据
"""

from fastapi import APIRouter, Query, HTTPException, Path
from typing import Optional, List, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

from app.services.yfinance.client import get_yfinance_service


router = APIRouter(prefix="/market", tags=["Market Data"])


# ============================================================
# 枚举类型
# ============================================================


class HistoryPeriod(str, Enum):
    """历史数据时间范围"""
    ONE_DAY = "1d"
    FIVE_DAYS = "5d"
    ONE_MONTH = "1mo"
    THREE_MONTHS = "3mo"
    SIX_MONTHS = "6mo"
    ONE_YEAR = "1y"
    TWO_YEARS = "2y"
    FIVE_YEARS = "5y"
    TEN_YEARS = "10y"
    YTD = "ytd"
    MAX = "max"


class HistoryInterval(str, Enum):
    """K线间隔"""
    ONE_MIN = "1m"
    TWO_MIN = "2m"
    FIVE_MIN = "5m"
    FIFTEEN_MIN = "15m"
    THIRTY_MIN = "30m"
    SIXTY_MIN = "60m"
    NINETY_MIN = "90m"
    ONE_HOUR = "1h"
    ONE_DAY = "1d"
    FIVE_DAYS = "5d"
    ONE_WEEK = "1wk"
    ONE_MONTH = "1mo"
    THREE_MONTHS = "3mo"


# ============================================================
# Pydantic 模型 - 市场行情
# ============================================================


class QuoteResponse(BaseModel):
    """实时报价响应"""
    symbol: str
    name: Optional[str] = None
    exchange: Optional[str] = None
    currency: Optional[str] = None
    # 价格
    current_price: Optional[float] = None
    previous_close: Optional[float] = None
    open: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    # 涨跌
    change: Optional[float] = None
    change_percent: Optional[float] = None
    # 成交量
    volume: Optional[int] = None
    avg_volume: Optional[int] = None
    avg_volume_10day: Optional[int] = None
    # 市值
    market_cap: Optional[int] = None
    # 盘前盘后
    pre_market_price: Optional[float] = None
    post_market_price: Optional[float] = None


class HistoryDataPoint(BaseModel):
    """历史数据点"""
    date: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[int] = None
    dividends: Optional[float] = None
    stock_splits: Optional[float] = None


class HistoryResponse(BaseModel):
    """历史数据响应"""
    symbol: str
    period: str
    interval: str
    data: List[HistoryDataPoint]
    count: int


# ============================================================
# Pydantic 模型 - 基本面数据
# ============================================================


class CompanyInfoResponse(BaseModel):
    """公司信息响应"""
    symbol: str
    name: Optional[str] = None
    long_name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    zip: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    employees: Optional[int] = None
    business_summary: Optional[str] = None


class FinancialsResponse(BaseModel):
    """财务指标响应"""
    symbol: str
    # 估值
    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    peg_ratio: Optional[float] = None
    price_to_book: Optional[float] = None
    price_to_sales: Optional[float] = None
    enterprise_value: Optional[int] = None
    ev_to_revenue: Optional[float] = None
    ev_to_ebitda: Optional[float] = None
    # 盈利
    profit_margins: Optional[float] = None
    operating_margins: Optional[float] = None
    gross_margins: Optional[float] = None
    return_on_assets: Optional[float] = None
    return_on_equity: Optional[float] = None
    # 收入
    total_revenue: Optional[int] = None
    revenue_per_share: Optional[float] = None
    revenue_growth: Optional[float] = None
    earnings_growth: Optional[float] = None
    # 每股数据
    eps_trailing: Optional[float] = None
    eps_forward: Optional[float] = None
    book_value: Optional[float] = None
    # 资产负债
    total_cash: Optional[int] = None
    total_debt: Optional[int] = None
    debt_to_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    # 现金流
    free_cash_flow: Optional[int] = None
    operating_cash_flow: Optional[int] = None


class DividendHistory(BaseModel):
    """股息历史"""
    date: str
    amount: float


class DividendsResponse(BaseModel):
    """股息信息响应"""
    symbol: str
    dividend_rate: Optional[float] = None
    dividend_yield: Optional[float] = None
    trailing_annual_dividend_rate: Optional[float] = None
    trailing_annual_dividend_yield: Optional[float] = None
    five_year_avg_dividend_yield: Optional[float] = None
    payout_ratio: Optional[float] = None
    ex_dividend_date: Optional[int] = None
    last_dividend_date: Optional[int] = None
    last_dividend_value: Optional[float] = None
    history: List[DividendHistory] = []


# ============================================================
# Pydantic 模型 - 交易与持仓
# ============================================================


class OptionContract(BaseModel):
    """期权合约"""
    contract_symbol: Optional[str] = None
    strike: Optional[float] = None
    last_price: Optional[float] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    change: Optional[float] = None
    percent_change: Optional[float] = None
    volume: Optional[int] = None
    open_interest: Optional[int] = None
    implied_volatility: Optional[float] = None
    in_the_money: Optional[bool] = None


class OptionsChain(BaseModel):
    """期权链"""
    expiration: str
    calls: List[OptionContract] = []
    puts: List[OptionContract] = []


class OptionsResponse(BaseModel):
    """期权数据响应"""
    symbol: str
    expirations: List[str] = []
    options_chain: Optional[OptionsChain] = None
    error: Optional[str] = None


class InstitutionalHolder(BaseModel):
    """机构持有人"""
    holder: Optional[str] = None
    shares: Optional[int] = None
    date_reported: Optional[str] = None
    percent_out: Optional[float] = None
    value: Optional[int] = None


class MajorHolder(BaseModel):
    """主要持有人"""
    value: Optional[str] = None
    description: Optional[str] = None


class InsiderTransaction(BaseModel):
    """内部人交易"""
    insider: Optional[str] = None
    relation: Optional[str] = None
    shares: Optional[int] = None
    transaction: Optional[str] = None
    start_date: Optional[str] = None
    value: Optional[int] = None


class HoldersResponse(BaseModel):
    """持仓数据响应"""
    symbol: str
    held_percent_insiders: Optional[float] = None
    held_percent_institutions: Optional[float] = None
    float_shares: Optional[int] = None
    shares_outstanding: Optional[int] = None
    shares_short: Optional[int] = None
    short_ratio: Optional[float] = None
    short_percent_of_float: Optional[float] = None
    shares_short_prior_month: Optional[int] = None
    institutional_holders: List[InstitutionalHolder] = []
    major_holders: List[MajorHolder] = []
    insider_transactions: List[InsiderTransaction] = []


# ============================================================
# Pydantic 模型 - 分析师与新闻
# ============================================================


class AnalystRecommendation(BaseModel):
    """分析师评级"""
    date: Optional[str] = None
    firm: Optional[str] = None
    to_grade: Optional[str] = None
    from_grade: Optional[str] = None
    action: Optional[str] = None


class RecommendationSummary(BaseModel):
    """评级摘要"""
    period: Optional[str] = None
    strong_buy: Optional[int] = None
    buy: Optional[int] = None
    hold: Optional[int] = None
    sell: Optional[int] = None
    strong_sell: Optional[int] = None


class AnalystResponse(BaseModel):
    """分析师数据响应"""
    symbol: str
    recommendation_key: Optional[str] = None
    recommendation_mean: Optional[float] = None
    number_of_analyst_opinions: Optional[int] = None
    target_mean_price: Optional[float] = None
    target_high_price: Optional[float] = None
    target_low_price: Optional[float] = None
    target_median_price: Optional[float] = None
    current_price: Optional[float] = None
    recommendations: List[AnalystRecommendation] = []
    recommendations_summary: List[RecommendationSummary] = []


class EarningsHistory(BaseModel):
    """盈利历史"""
    quarter: Optional[str] = None
    eps_actual: Optional[float] = None
    eps_estimate: Optional[float] = None
    surprise_percent: Optional[float] = None


class EarningsDate(BaseModel):
    """盈利日期"""
    date: Optional[str] = None
    eps_estimate: Optional[float] = None
    reported_eps: Optional[float] = None
    surprise_percent: Optional[float] = None


class EarningsResponse(BaseModel):
    """盈利数据响应"""
    symbol: str
    earnings_date: Optional[Any] = None
    earnings_quarterly_growth: Optional[float] = None
    revenue_quarterly_growth: Optional[float] = None
    earnings_history: List[EarningsHistory] = []
    earnings_dates: List[EarningsDate] = []


class NewsItem(BaseModel):
    """新闻条目"""
    uuid: Optional[str] = None
    title: Optional[str] = None
    publisher: Optional[str] = None
    link: Optional[str] = None
    publish_time: Optional[int] = None
    type: Optional[str] = None
    thumbnail: Optional[str] = None
    related_tickers: List[str] = []


class NewsResponse(BaseModel):
    """新闻响应"""
    symbol: str
    news: List[NewsItem]
    count: int


# ============================================================
# API 路由 - 市场行情
# ============================================================


@router.get(
    "/quote/{symbol}",
    response_model=QuoteResponse,
    summary="获取实时报价",
    description="获取股票的实时报价信息，包含当前价格、涨跌幅、成交量、市值等"
)
async def get_quote(
    symbol: str = Path(..., description="股票代码 (如 AAPL, NVDA, TSLA)")
):
    """获取股票实时报价"""
    try:
        service = get_yfinance_service()
        data = service.get_quote(symbol)
        return QuoteResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取报价失败: {str(e)}")


@router.post(
    "/quotes",
    summary="批量获取报价",
    description="批量获取多个股票的实时报价"
)
async def get_multiple_quotes(
    symbols: List[str] = Query(..., description="股票代码列表")
):
    """批量获取股票报价"""
    try:
        service = get_yfinance_service()
        return service.get_multiple_quotes(symbols)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量获取报价失败: {str(e)}")


@router.get(
    "/history/{symbol}",
    response_model=HistoryResponse,
    summary="获取历史行情",
    description="获取股票的历史K线数据"
)
async def get_history(
    symbol: str = Path(..., description="股票代码"),
    period: HistoryPeriod = Query(HistoryPeriod.ONE_MONTH, description="时间范围"),
    interval: HistoryInterval = Query(HistoryInterval.ONE_DAY, description="K线间隔"),
    start: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
):
    """获取历史行情数据"""
    try:
        service = get_yfinance_service()
        data = service.get_history(
            symbol,
            period=period.value,
            interval=interval.value,
            start=start,
            end=end
        )
        return HistoryResponse(
            symbol=symbol.upper(),
            period=period.value,
            interval=interval.value,
            data=[HistoryDataPoint(**d) for d in data],
            count=len(data)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取历史数据失败: {str(e)}")


@router.get(
    "/intraday/{symbol}",
    response_model=HistoryResponse,
    summary="获取日内行情",
    description="获取股票的日内分时数据"
)
async def get_intraday(
    symbol: str = Path(..., description="股票代码"),
    interval: str = Query("5m", description="间隔: 1m, 2m, 5m, 15m, 30m, 60m"),
):
    """获取日内行情数据"""
    try:
        service = get_yfinance_service()
        data = service.get_intraday(symbol, interval=interval)
        return HistoryResponse(
            symbol=symbol.upper(),
            period="1d",
            interval=interval,
            data=[HistoryDataPoint(**d) for d in data],
            count=len(data)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取日内数据失败: {str(e)}")


# ============================================================
# API 路由 - 基本面数据
# ============================================================


@router.get(
    "/company/{symbol}",
    response_model=CompanyInfoResponse,
    summary="获取公司信息",
    description="获取公司基本信息，包含行业、地址、员工数、业务描述等"
)
async def get_company_info(
    symbol: str = Path(..., description="股票代码")
):
    """获取公司基本信息"""
    try:
        service = get_yfinance_service()
        data = service.get_company_info(symbol)
        return CompanyInfoResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取公司信息失败: {str(e)}")


@router.get(
    "/financials/{symbol}",
    response_model=FinancialsResponse,
    summary="获取财务指标",
    description="获取关键财务指标，包含估值、盈利能力、资产负债等"
)
async def get_financials(
    symbol: str = Path(..., description="股票代码")
):
    """获取财务指标"""
    try:
        service = get_yfinance_service()
        data = service.get_financials(symbol)
        return FinancialsResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取财务指标失败: {str(e)}")


@router.get(
    "/income-statement/{symbol}",
    summary="获取利润表",
    description="获取利润表详细数据"
)
async def get_income_statement(
    symbol: str = Path(..., description="股票代码"),
    quarterly: bool = Query(False, description="是否获取季度数据"),
):
    """获取利润表"""
    try:
        service = get_yfinance_service()
        data = service.get_income_statement(symbol, quarterly=quarterly)
        return {
            "symbol": symbol.upper(),
            "quarterly": quarterly,
            "data": data,
            "count": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取利润表失败: {str(e)}")


@router.get(
    "/balance-sheet/{symbol}",
    summary="获取资产负债表",
    description="获取资产负债表详细数据"
)
async def get_balance_sheet(
    symbol: str = Path(..., description="股票代码"),
    quarterly: bool = Query(False, description="是否获取季度数据"),
):
    """获取资产负债表"""
    try:
        service = get_yfinance_service()
        data = service.get_balance_sheet(symbol, quarterly=quarterly)
        return {
            "symbol": symbol.upper(),
            "quarterly": quarterly,
            "data": data,
            "count": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取资产负债表失败: {str(e)}")


@router.get(
    "/cash-flow/{symbol}",
    summary="获取现金流量表",
    description="获取现金流量表详细数据"
)
async def get_cash_flow(
    symbol: str = Path(..., description="股票代码"),
    quarterly: bool = Query(False, description="是否获取季度数据"),
):
    """获取现金流量表"""
    try:
        service = get_yfinance_service()
        data = service.get_cash_flow(symbol, quarterly=quarterly)
        return {
            "symbol": symbol.upper(),
            "quarterly": quarterly,
            "data": data,
            "count": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取现金流量表失败: {str(e)}")


@router.get(
    "/dividends/{symbol}",
    response_model=DividendsResponse,
    summary="获取股息信息",
    description="获取股息相关信息，包含股息率、派息历史等"
)
async def get_dividends(
    symbol: str = Path(..., description="股票代码")
):
    """获取股息信息"""
    try:
        service = get_yfinance_service()
        data = service.get_dividends(symbol)
        return DividendsResponse(
            symbol=data["symbol"],
            dividend_rate=data.get("dividend_rate"),
            dividend_yield=data.get("dividend_yield"),
            trailing_annual_dividend_rate=data.get("trailing_annual_dividend_rate"),
            trailing_annual_dividend_yield=data.get("trailing_annual_dividend_yield"),
            five_year_avg_dividend_yield=data.get("five_year_avg_dividend_yield"),
            payout_ratio=data.get("payout_ratio"),
            ex_dividend_date=data.get("ex_dividend_date"),
            last_dividend_date=data.get("last_dividend_date"),
            last_dividend_value=data.get("last_dividend_value"),
            history=[DividendHistory(**h) for h in data.get("history", [])]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取股息信息失败: {str(e)}")


# ============================================================
# API 路由 - 交易与持仓
# ============================================================


@router.get(
    "/options/{symbol}",
    response_model=OptionsResponse,
    summary="获取期权数据",
    description="获取期权到期日列表和最近到期日的期权链"
)
async def get_options(
    symbol: str = Path(..., description="股票代码")
):
    """获取期权数据"""
    try:
        service = get_yfinance_service()
        data = service.get_options(symbol)
        return OptionsResponse(
            symbol=data["symbol"],
            expirations=data.get("expirations", []),
            options_chain=OptionsChain(**data["options_chain"]) if data.get("options_chain") else None,
            error=data.get("error")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取期权数据失败: {str(e)}")


@router.get(
    "/options/{symbol}/{expiration}",
    summary="获取指定到期日期权链",
    description="获取指定到期日的完整期权链数据"
)
async def get_options_chain(
    symbol: str = Path(..., description="股票代码"),
    expiration: str = Path(..., description="到期日 (YYYY-MM-DD)")
):
    """获取指定到期日的期权链"""
    try:
        service = get_yfinance_service()
        data = service.get_options_chain(symbol, expiration)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取期权链失败: {str(e)}")


@router.get(
    "/holders/{symbol}",
    response_model=HoldersResponse,
    summary="获取持仓数据",
    description="获取机构持仓、主要持有人、内部人交易等信息"
)
async def get_holders(
    symbol: str = Path(..., description="股票代码")
):
    """获取持仓数据"""
    try:
        service = get_yfinance_service()
        data = service.get_holders(symbol)
        return HoldersResponse(
            symbol=data["symbol"],
            held_percent_insiders=data.get("held_percent_insiders"),
            held_percent_institutions=data.get("held_percent_institutions"),
            float_shares=data.get("float_shares"),
            shares_outstanding=data.get("shares_outstanding"),
            shares_short=data.get("shares_short"),
            short_ratio=data.get("short_ratio"),
            short_percent_of_float=data.get("short_percent_of_float"),
            shares_short_prior_month=data.get("shares_short_prior_month"),
            institutional_holders=[InstitutionalHolder(**h) for h in data.get("institutional_holders", [])],
            major_holders=[MajorHolder(**h) for h in data.get("major_holders", [])],
            insider_transactions=[InsiderTransaction(**t) for t in data.get("insider_transactions", [])]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取持仓数据失败: {str(e)}")


@router.get(
    "/insider-transactions/{symbol}",
    summary="获取内部人交易",
    description="获取内部人交易记录详情"
)
async def get_insider_transactions(
    symbol: str = Path(..., description="股票代码")
):
    """获取内部人交易记录"""
    try:
        service = get_yfinance_service()
        data = service.get_insider_transactions(symbol)
        return {
            "symbol": symbol.upper(),
            "transactions": data,
            "count": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取内部人交易失败: {str(e)}")


# ============================================================
# API 路由 - 分析师与新闻
# ============================================================


@router.get(
    "/analyst/{symbol}",
    response_model=AnalystResponse,
    summary="获取分析师评级",
    description="获取分析师评级、目标价格和评级历史"
)
async def get_analyst_recommendations(
    symbol: str = Path(..., description="股票代码")
):
    """获取分析师评级"""
    try:
        service = get_yfinance_service()
        data = service.get_analyst_recommendations(symbol)
        return AnalystResponse(
            symbol=data["symbol"],
            recommendation_key=data.get("recommendation_key"),
            recommendation_mean=data.get("recommendation_mean"),
            number_of_analyst_opinions=data.get("number_of_analyst_opinions"),
            target_mean_price=data.get("target_mean_price"),
            target_high_price=data.get("target_high_price"),
            target_low_price=data.get("target_low_price"),
            target_median_price=data.get("target_median_price"),
            current_price=data.get("current_price"),
            recommendations=[AnalystRecommendation(**r) for r in data.get("recommendations", [])],
            recommendations_summary=[RecommendationSummary(**s) for s in data.get("recommendations_summary", [])]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取分析师评级失败: {str(e)}")


@router.get(
    "/earnings/{symbol}",
    response_model=EarningsResponse,
    summary="获取盈利数据",
    description="获取盈利历史、盈利预期和盈利日期"
)
async def get_earnings(
    symbol: str = Path(..., description="股票代码")
):
    """获取盈利数据"""
    try:
        service = get_yfinance_service()
        data = service.get_earnings(symbol)
        return EarningsResponse(
            symbol=data["symbol"],
            earnings_date=data.get("earnings_date"),
            earnings_quarterly_growth=data.get("earnings_quarterly_growth"),
            revenue_quarterly_growth=data.get("revenue_quarterly_growth"),
            earnings_history=[EarningsHistory(**h) for h in data.get("earnings_history", [])],
            earnings_dates=[EarningsDate(**d) for d in data.get("earnings_dates", [])]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取盈利数据失败: {str(e)}")


@router.get(
    "/news/{symbol}",
    response_model=NewsResponse,
    summary="获取相关新闻",
    description="获取股票相关的最新新闻"
)
async def get_news(
    symbol: str = Path(..., description="股票代码")
):
    """获取相关新闻"""
    try:
        service = get_yfinance_service()
        data = service.get_news(symbol)
        return NewsResponse(
            symbol=symbol.upper(),
            news=[NewsItem(**n) for n in data],
            count=len(data)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取新闻失败: {str(e)}")


# ============================================================
# API 路由 - 综合数据
# ============================================================


@router.get(
    "/overview/{symbol}",
    summary="获取股票综合概览",
    description="一次性获取股票的报价、公司信息和关键财务指标"
)
async def get_stock_overview(
    symbol: str = Path(..., description="股票代码")
):
    """获取股票综合概览"""
    try:
        service = get_yfinance_service()

        quote = service.get_quote(symbol)
        company = service.get_company_info(symbol)
        financials = service.get_financials(symbol)

        return {
            "symbol": symbol.upper(),
            "quote": quote,
            "company": company,
            "financials": financials,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取综合概览失败: {str(e)}")










