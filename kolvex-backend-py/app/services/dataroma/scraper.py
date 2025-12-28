"""
Dataroma 网页爬虫
抓取超级投资者名单和持仓数据（完整版）
"""

import re
import time
import logging
from typing import List, Dict, Optional, Any, Tuple
from urllib.parse import urljoin, parse_qs, urlparse
from dataclasses import dataclass, field
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from .config import (
    MANAGERS_URL,
    HOLDINGS_URL,
    DEFAULT_HEADERS,
    REQUEST_TIMEOUT,
    REQUEST_DELAY,
    MAX_RETRIES,
    RETRY_DELAY,
)

logger = logging.getLogger(__name__)


@dataclass
class SuperInvestor:
    """超级投资者数据（完整版）"""
    name: str
    code: str
    # 投资组合统计
    portfolio_value: Optional[float] = None      # 投资组合总市值
    stock_count: Optional[int] = None            # 持有股票数量
    portfolio_date: Optional[str] = None         # 投资组合日期 (如 "30 Sep 2025")
    period: Optional[str] = None                 # 期间 (如 "Q3 2025")


@dataclass
class Holding:
    """持仓数据（完整版）"""
    ticker: str
    company_name: str
    # 持仓占比
    portfolio_percent: float
    # 活动信息
    change_type: Optional[str] = None            # new, add, reduce, sold, buy, unchanged
    change_percent: Optional[float] = None       # 变动百分比
    # 持股和市值
    shares: int = 0
    reported_price: Optional[float] = None       # 报告价格
    market_value: float = 0.0
    # 当前价格信息
    current_price: Optional[float] = None        # 当前价格
    price_change_percent: Optional[float] = None # 相对报告价格涨跌幅
    week_52_low: Optional[float] = None          # 52周低点
    week_52_high: Optional[float] = None         # 52周高点
    # 其他
    sector: Optional[str] = None
    report_date: Optional[str] = None


@dataclass
class SectorAllocation:
    """行业分配数据"""
    sector_name: str
    allocation_percent: float


@dataclass
class HoldingsResult:
    """持仓抓取结果（包含投资者信息、持仓列表、行业分配）"""
    investor: SuperInvestor
    holdings: List[Holding]
    sector_allocations: List[SectorAllocation]


class DataromaScraper:
    """Dataroma 爬虫（完整版）"""
    
    def __init__(self, headers: Optional[Dict[str, str]] = None):
        self.headers = headers or DEFAULT_HEADERS
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    def _make_request(self, url: str, params: Optional[Dict] = None) -> Optional[str]:
        """
        发送 HTTP 请求，带重试逻辑
        """
        for attempt in range(MAX_RETRIES):
            try:
                response = self.session.get(
                    url,
                    params=params,
                    timeout=REQUEST_TIMEOUT
                )
                response.raise_for_status()
                return response.text
            except requests.RequestException as e:
                logger.warning(f"请求失败 (尝试 {attempt + 1}/{MAX_RETRIES}): {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
        
        logger.error(f"请求最终失败: {url}")
        return None
    
    def scrape_managers(self) -> List[SuperInvestor]:
        """
        抓取所有超级投资者名单
        """
        logger.info(f"开始抓取投资者名单: {MANAGERS_URL}")
        
        html = self._make_request(MANAGERS_URL)
        if not html:
            logger.error("获取投资者页面失败")
            return []
        
        soup = BeautifulSoup(html, "html.parser")
        investors = []
        
        # 查找所有包含 holdings.php?m= 的链接
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            
            if "holdings.php" in href and "m=" in href:
                parsed = urlparse(href)
                params = parse_qs(parsed.query)
                
                if "m" in params:
                    code = params["m"][0]
                    name = link.get_text(strip=True)
                    
                    if name and code and len(code) <= 10:
                        investors.append(SuperInvestor(name=name, code=code))
                        logger.debug(f"找到投资者: {name} ({code})")
        
        # 去重（基于 code）
        seen_codes = set()
        unique_investors = []
        for inv in investors:
            if inv.code not in seen_codes:
                seen_codes.add(inv.code)
                unique_investors.append(inv)
        
        logger.info(f"共抓取到 {len(unique_investors)} 个超级投资者")
        return unique_investors
    
    def scrape_holdings(self, manager_code: str) -> HoldingsResult:
        """
        抓取某个投资者的完整持仓数据
        
        Args:
            manager_code: 投资者代码
            
        Returns:
            HoldingsResult 包含投资者信息、持仓列表、行业分配
        """
        url = f"{HOLDINGS_URL}?m={manager_code}"
        logger.info(f"开始抓取持仓数据: {url}")
        
        html = self._make_request(url)
        if not html:
            logger.error(f"获取持仓页面失败: {manager_code}")
            return HoldingsResult(
                investor=SuperInvestor(name="", code=manager_code),
                holdings=[],
                sector_allocations=[]
            )
        
        soup = BeautifulSoup(html, "html.parser")
        
        # 1. 解析投资者信息
        investor = self._parse_investor_info(soup, manager_code)
        
        # 2. 解析持仓数据
        holdings = self._parse_holdings_table(soup)
        
        # 3. 解析行业分配
        sector_allocations = self._parse_sector_allocation(soup)
        
        logger.info(f"共抓取到 {len(holdings)} 条持仓记录, {len(sector_allocations)} 个行业 ({manager_code})")
        
        # 请求间隔
        time.sleep(REQUEST_DELAY)
        
        return HoldingsResult(
            investor=investor,
            holdings=holdings,
            sector_allocations=sector_allocations
        )
    
    def _parse_investor_info(self, soup: BeautifulSoup, code: str) -> SuperInvestor:
        """
        解析投资者信息
        
        页面结构：
        - f_name: 投资者名称
        - p2: Period, Portfolio date, No. of stocks, Portfolio value
        """
        investor = SuperInvestor(name="", code=code)
        
        # 投资者名称
        name_div = soup.find("div", {"id": "f_name"})
        if name_div:
            investor.name = name_div.get_text(strip=True)
        
        # 投资组合信息
        info_p = soup.find("p", {"id": "p2"})
        if info_p:
            info_text = info_p.get_text()
            
            # Period: Q3 2025
            period_match = re.search(r"Period:\s*([^\n]+)", info_text)
            if period_match:
                investor.period = period_match.group(1).strip()
            
            # Portfolio date: 30 Sep 2025
            date_match = re.search(r"Portfolio date:\s*([^\n]+)", info_text)
            if date_match:
                investor.portfolio_date = date_match.group(1).strip()
            
            # No. of stocks: 11
            stocks_match = re.search(r"No\. of stocks:\s*(\d+)", info_text)
            if stocks_match:
                investor.stock_count = int(stocks_match.group(1))
            
            # Portfolio value: $14,678,518,000
            value_match = re.search(r"Portfolio value:\s*\$?([\d,]+)", info_text)
            if value_match:
                investor.portfolio_value = self._parse_number(value_match.group(1))
        
        return investor
    
    def _parse_holdings_table(self, soup: BeautifulSoup) -> List[Holding]:
        """
        解析持仓表格
        
        表格结构（12列）：
        0: History (≡)
        1: Stock (AAPL - Apple Inc.)
        2: % of Portfolio
        3: Recent Activity
        4: Shares
        5: Reported Price
        6: Value
        7: gap
        8: Current Price
        9: +/- Reported Price
        10: 52 Week Low
        11: 52 Week High
        """
        holdings = []
        
        table = soup.find("table", {"id": "grid"})
        if not table:
            logger.warning("未找到持仓表格")
            return holdings
        
        tbody = table.find("tbody")
        rows = tbody.find_all("tr") if tbody else table.find_all("tr")
        
        for row in rows:
            # 跳过表头
            if row.find_parent("thead"):
                continue
            
            cols = row.find_all("td")
            if len(cols) < 7:
                continue
            
            try:
                holding = self._parse_holding_row(cols)
                if holding and holding.ticker:
                    holdings.append(holding)
            except Exception as e:
                logger.warning(f"解析持仓行失败: {e}")
                continue
        
        return holdings
    
    def _parse_holding_row(self, cols: List) -> Optional[Holding]:
        """
        解析持仓表格行（完整版）
        """
        try:
            # 列索引
            IDX_STOCK = 1
            IDX_PERCENT = 2
            IDX_ACTIVITY = 3
            IDX_SHARES = 4
            IDX_REPORTED_PRICE = 5
            IDX_VALUE = 6
            IDX_CURRENT_PRICE = 8
            IDX_PRICE_CHANGE = 9
            IDX_52_LOW = 10
            IDX_52_HIGH = 11
            
            # === 股票代码和名称 ===
            stock_cell = cols[IDX_STOCK]
            ticker_link = stock_cell.find("a")
            
            if not ticker_link:
                return None
            
            link_text = ticker_link.get_text(strip=True)
            
            # 提取公司名称
            company_name = ""
            name_span = stock_cell.find("span")
            if name_span:
                company_name = name_span.get_text(strip=True)
                if company_name.startswith("- "):
                    company_name = company_name[2:].strip()
                elif company_name.startswith("-"):
                    company_name = company_name[1:].strip()
            
            # 提取股票代码
            if "- " in link_text:
                ticker = link_text.split("- ")[0].strip().upper()
                if not company_name:
                    company_name = link_text.split("- ", 1)[1].strip()
            elif "-" in link_text:
                ticker = link_text.split("-")[0].strip().upper()
                if not company_name:
                    company_name = link_text.split("-", 1)[1].strip()
            else:
                ticker = link_text.strip().upper()
            
            # 验证股票代码
            if not ticker or len(ticker) > 10:
                return None
            if not re.match(r'^[A-Z0-9.]+$', ticker):
                return None
            
            # === 持仓百分比 ===
            portfolio_percent = self._parse_percent(
                cols[IDX_PERCENT].get_text(strip=True)
            )
            
            # === 最近活动 ===
            activity_cell = cols[IDX_ACTIVITY]
            activity_text = activity_cell.get_text(strip=True).lower()
            
            change_percent = None
            change_type = "unchanged"
            
            if "new" in activity_text:
                change_type = "new"
                change_percent = 100.0
            elif "buy" in activity_text:
                change_type = "buy"
                change_percent = self._parse_percent(activity_text) or 100.0
            elif "add" in activity_text:
                change_type = "add"
                change_percent = self._parse_percent(activity_text)
            elif "reduce" in activity_text:
                change_type = "reduce"
                change_percent = -abs(self._parse_percent(activity_text))
            elif "sold" in activity_text:
                change_type = "sold"
                change_percent = -100.0
            
            # === 股数 ===
            shares = int(self._parse_number(
                cols[IDX_SHARES].get_text(strip=True)
            ))
            
            # === 报告价格 ===
            reported_price = None
            if len(cols) > IDX_REPORTED_PRICE:
                reported_price = self._parse_number(
                    cols[IDX_REPORTED_PRICE].get_text(strip=True)
                )
                if reported_price == 0:
                    reported_price = None
            
            # === 市值 ===
            market_value = self._parse_number(
                cols[IDX_VALUE].get_text(strip=True)
            )
            
            # === 当前价格 ===
            current_price = None
            if len(cols) > IDX_CURRENT_PRICE:
                current_price = self._parse_number(
                    cols[IDX_CURRENT_PRICE].get_text(strip=True)
                )
                if current_price == 0:
                    current_price = None
            
            # === 价格变动百分比 ===
            price_change_percent = None
            if len(cols) > IDX_PRICE_CHANGE:
                price_text = cols[IDX_PRICE_CHANGE].get_text(strip=True)
                if price_text and price_text != '-':
                    price_change_percent = self._parse_percent(price_text)
                    # 检查是否为负数（红色表示下跌）
                    if 'red' in str(cols[IDX_PRICE_CHANGE].get('class', [])):
                        price_change_percent = -abs(price_change_percent)
            
            # === 52周低点 ===
            week_52_low = None
            if len(cols) > IDX_52_LOW:
                week_52_low = self._parse_number(
                    cols[IDX_52_LOW].get_text(strip=True)
                )
                if week_52_low == 0:
                    week_52_low = None
            
            # === 52周高点 ===
            week_52_high = None
            if len(cols) > IDX_52_HIGH:
                week_52_high = self._parse_number(
                    cols[IDX_52_HIGH].get_text(strip=True)
                )
                if week_52_high == 0:
                    week_52_high = None
            
            return Holding(
                ticker=ticker,
                company_name=company_name,
                portfolio_percent=portfolio_percent,
                change_type=change_type,
                change_percent=change_percent,
                shares=shares,
                reported_price=reported_price,
                market_value=market_value,
                current_price=current_price,
                price_change_percent=price_change_percent,
                week_52_low=week_52_low,
                week_52_high=week_52_high,
            )
        except Exception as e:
            logger.warning(f"解析持仓数据失败: {e}")
            return None
    
    def _parse_sector_allocation(self, soup: BeautifulSoup) -> List[SectorAllocation]:
        """
        解析行业分配数据
        
        页面中的 "Sector % analysis" 部分
        """
        allocations = []
        
        # 查找包含 "Sector % analysis" 的区域
        # 通常在 <table> 或特定的 div 中
        
        # 方法1: 查找包含 sector 数据的表格或文本
        for text in soup.stripped_strings:
            # 匹配模式: "Technology 67.82" 或 "Financials 17.78"
            match = re.match(r'^([A-Za-z\s]+)\s+([\d.]+)$', text.strip())
            if match:
                sector_name = match.group(1).strip()
                percent = float(match.group(2))
                
                # 过滤常见的行业名称
                valid_sectors = [
                    'Technology', 'Financials', 'Consumer Goods', 'Energy',
                    'Information Technology', 'Consumer Discretionary',
                    'Services', 'Consumer Cyclical', 'Industrials',
                    'Healthcare', 'Basic Materials', 'Utilities',
                    'Communication Services', 'Real Estate'
                ]
                
                if any(s.lower() in sector_name.lower() for s in valid_sectors):
                    allocations.append(SectorAllocation(
                        sector_name=sector_name,
                        allocation_percent=percent
                    ))
        
        # 去重
        seen = set()
        unique_allocations = []
        for alloc in allocations:
            if alloc.sector_name not in seen:
                seen.add(alloc.sector_name)
                unique_allocations.append(alloc)
        
        return unique_allocations
    
    def _parse_percent(self, text: str) -> float:
        """解析百分比文本"""
        cleaned = re.sub(r"[^\d.\-]", "", text)
        try:
            return float(cleaned) if cleaned else 0.0
        except ValueError:
            return 0.0
    
    def _parse_number(self, text: str) -> float:
        """解析数字文本"""
        cleaned = re.sub(r"[$,]", "", text)
        multiplier = 1
        if cleaned.endswith("K"):
            multiplier = 1_000
            cleaned = cleaned[:-1]
        elif cleaned.endswith("M"):
            multiplier = 1_000_000
            cleaned = cleaned[:-1]
        elif cleaned.endswith("B"):
            multiplier = 1_000_000_000
            cleaned = cleaned[:-1]
        
        try:
            return float(cleaned) * multiplier if cleaned else 0.0
        except ValueError:
            return 0.0
    
    def scrape_holdings_simple(self, manager_code: str) -> List[Holding]:
        """
        简化版：只返回持仓列表（兼容旧接口）
        """
        result = self.scrape_holdings(manager_code)
        return result.holdings
    
    def scrape_all_holdings(
        self,
        manager_codes: Optional[List[str]] = None,
        delay: float = REQUEST_DELAY
    ) -> Dict[str, HoldingsResult]:
        """
        批量抓取多个投资者的持仓
        """
        if manager_codes is None:
            investors = self.scrape_managers()
            manager_codes = [inv.code for inv in investors]
        
        results = {}
        total = len(manager_codes)
        
        for i, code in enumerate(manager_codes, 1):
            logger.info(f"抓取进度: {i}/{total} - {code}")
            result = self.scrape_holdings(code)
            results[code] = result
            
            if i < total:
                time.sleep(delay)
        
        return results
