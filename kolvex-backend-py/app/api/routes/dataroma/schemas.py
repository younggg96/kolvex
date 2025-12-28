"""
Dataroma API Pydantic 模型
定义超级投资者和持仓数据的请求/响应结构
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime, date
from enum import Enum


# ============================================================
# 枚举类型
# ============================================================


class ChangeType(str, Enum):
    """持仓变动类型"""
    NEW = "new"
    ADD = "add"
    REDUCE = "reduce"
    SOLD = "sold"
    UNCHANGED = "unchanged"


class SortField(str, Enum):
    """排序字段"""
    NAME = "name"
    CODE = "code"
    LAST_SCRAPED = "last_scraped_at"
    CREATED = "created_at"


class HoldingSortField(str, Enum):
    """持仓排序字段"""
    PORTFOLIO_PERCENT = "portfolio_percent"
    MARKET_VALUE = "market_value"
    SHARES = "shares"
    CHANGE_PERCENT = "change_percent"
    TICKER = "ticker"
    REPORT_DATE = "report_date"


# ============================================================
# 超级投资者模型
# ============================================================


class SuperInvestorBase(BaseModel):
    """超级投资者基础模型"""
    name: str = Field(..., description="投资经理或机构名称")
    code: str = Field(..., description="Dataroma 唯一标识符")


class SuperInvestorCreate(SuperInvestorBase):
    """创建超级投资者请求"""
    description: Optional[str] = Field(None, description="简介")
    website: Optional[str] = Field(None, description="官网")


class SuperInvestorUpdate(BaseModel):
    """更新超级投资者请求"""
    name: Optional[str] = Field(None, description="投资经理或机构名称")
    description: Optional[str] = Field(None, description="简介")
    website: Optional[str] = Field(None, description="官网")
    is_active: Optional[bool] = Field(None, description="是否活跃")


class SuperInvestorResponse(SuperInvestorBase):
    """超级投资者响应（完整版）"""
    id: str
    description: Optional[str] = None
    website: Optional[str] = None
    # 投资组合统计
    portfolio_value: Optional[float] = Field(None, description="投资组合总市值")
    stock_count: Optional[int] = Field(None, description="持有股票数量")
    portfolio_date: Optional[str] = Field(None, description="投资组合日期")
    period: Optional[str] = Field(None, description="报告期间（如 Q3 2025）")
    # 元数据
    last_scraped_at: Optional[datetime] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SuperInvestorListResponse(BaseModel):
    """超级投资者列表响应"""
    success: bool = True
    data: List[SuperInvestorResponse]
    pagination: Dict


# ============================================================
# 持仓数据模型
# ============================================================


class HoldingBase(BaseModel):
    """持仓基础模型"""
    ticker: str = Field(..., description="股票代码")
    company_name: Optional[str] = Field(None, description="公司名称")
    shares: int = Field(0, description="持股数量")
    market_value: Optional[float] = Field(None, description="市值（美元）")
    portfolio_percent: Optional[float] = Field(None, description="占投资组合百分比")


class HoldingResponse(HoldingBase):
    """持仓响应（完整版）"""
    id: str
    investor_id: Optional[str] = None
    investor_code: str
    investor_name: Optional[str] = None  # 关联查询填充
    sector: Optional[str] = None
    # 变动信息
    change_percent: Optional[float] = Field(None, description="变动百分比")
    change_type: Optional[str] = Field(None, description="变动类型")
    # 价格信息
    reported_price: Optional[float] = Field(None, description="报告价格")
    current_price: Optional[float] = Field(None, description="当前价格")
    price_change_percent: Optional[float] = Field(None, description="相对报告价格涨跌幅")
    week_52_low: Optional[float] = Field(None, description="52周低点")
    week_52_high: Optional[float] = Field(None, description="52周高点")
    # 报告信息
    report_date: Optional[date] = None
    filing_date: Optional[date] = None
    quarter: Optional[str] = None
    # AI 分析
    ai_analysis: Optional[str] = None
    ai_analysis_at: Optional[datetime] = None
    # 元数据
    scraped_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HoldingListResponse(BaseModel):
    """持仓列表响应"""
    success: bool = True
    data: List[HoldingResponse]
    pagination: Dict


class HoldingWithInvestor(HoldingResponse):
    """带投资者信息的持仓"""
    investor: Optional[SuperInvestorResponse] = None


# ============================================================
# 股票持仓聚合模型
# ============================================================


class StockHoldersResponse(BaseModel):
    """股票持有者信息"""
    ticker: str
    company_name: Optional[str] = None
    holder_count: int
    total_market_value: float
    holders: List[Dict]  # [{investor_name, investor_code, shares, portfolio_percent, change_type}]


class PopularStocksResponse(BaseModel):
    """热门股票列表响应"""
    success: bool = True
    data: List[StockHoldersResponse]


# ============================================================
# 同步相关模型
# ============================================================


class SyncInvestorsRequest(BaseModel):
    """同步投资者请求"""
    pass  # 无需参数


class SyncHoldingsRequest(BaseModel):
    """同步持仓请求"""
    investor_code: Optional[str] = Field(None, description="投资者代码（不指定则同步所有）")
    quarter: Optional[str] = Field(None, description="季度标识（如 2024-Q4），不指定则使用当前季度")
    report_date: Optional[str] = Field(None, description="报告日期（YYYY-MM-DD）")


class SyncResponse(BaseModel):
    """同步响应"""
    success: bool
    message: str
    inserted: int = 0
    updated: int = 0
    total: int = 0
    details: Optional[Dict] = None


class SyncStatusResponse(BaseModel):
    """同步状态响应"""
    success: bool = True
    last_sync_at: Optional[datetime] = None
    investor_count: int = 0
    holding_count: int = 0
    current_quarter: Optional[str] = None


# ============================================================
# 分析相关模型
# ============================================================


class InvestorActivityResponse(BaseModel):
    """投资者活动响应"""
    investor_code: str
    investor_name: str
    quarter: str
    new_positions: List[Dict]
    increased_positions: List[Dict]
    reduced_positions: List[Dict]
    sold_positions: List[Dict]


class QuarterlyChangesResponse(BaseModel):
    """季度变动响应"""
    success: bool = True
    quarter: str
    data: List[InvestorActivityResponse]


class HoldingComparisonResponse(BaseModel):
    """持仓对比响应"""
    ticker: str
    company_name: Optional[str] = None
    current_quarter: str
    previous_quarter: str
    current_holders: List[Dict]
    previous_holders: List[Dict]
    new_buyers: List[str]
    sellers: List[str]

