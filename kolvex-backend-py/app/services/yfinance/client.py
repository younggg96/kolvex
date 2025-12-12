"""
YFinance 客户端服务
封装 yfinance 库的各种功能
"""

import yfinance as yf
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from functools import lru_cache
import json


class YFinanceService:
    """YFinance 数据服务"""

    def __init__(self):
        pass

    def get_ticker(self, symbol: str) -> yf.Ticker:
        """获取股票 Ticker 对象"""
        return yf.Ticker(symbol.upper())

    # ============================================================
    # 市场行情数据
    # ============================================================

    def get_quote(self, symbol: str) -> Dict[str, Any]:
        """
        获取实时报价信息
        包含: 当前价格、涨跌幅、成交量、市值等
        """
        ticker = self.get_ticker(symbol)
        info = ticker.info

        return {
            "symbol": symbol.upper(),
            "name": info.get("shortName") or info.get("longName"),
            "exchange": info.get("exchange"),
            "currency": info.get("currency"),
            # 价格信息
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "previous_close": info.get("previousClose") or info.get("regularMarketPreviousClose"),
            "open": info.get("open") or info.get("regularMarketOpen"),
            "day_high": info.get("dayHigh") or info.get("regularMarketDayHigh"),
            "day_low": info.get("dayLow") or info.get("regularMarketDayLow"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            # 涨跌
            "change": info.get("regularMarketChange"),
            "change_percent": info.get("regularMarketChangePercent"),
            # 成交量
            "volume": info.get("volume") or info.get("regularMarketVolume"),
            "avg_volume": info.get("averageVolume"),
            "avg_volume_10day": info.get("averageVolume10days"),
            # 市值
            "market_cap": info.get("marketCap"),
            # 时间
            "market_time": info.get("regularMarketTime"),
            "pre_market_price": info.get("preMarketPrice"),
            "post_market_price": info.get("postMarketPrice"),
        }

    def get_history(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        获取历史行情数据

        Args:
            symbol: 股票代码
            period: 时间范围 (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            interval: K线间隔 (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
            start: 开始日期 (YYYY-MM-DD)
            end: 结束日期 (YYYY-MM-DD)

        Returns:
            历史价格数据列表
        """
        ticker = self.get_ticker(symbol)

        if start and end:
            df = ticker.history(start=start, end=end, interval=interval)
        else:
            df = ticker.history(period=period, interval=interval)

        if df.empty:
            return []

        df = df.reset_index()
        result = []

        for _, row in df.iterrows():
            date_val = row.get("Date") or row.get("Datetime")
            result.append({
                "date": date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val),
                "open": round(row["Open"], 2) if row["Open"] else None,
                "high": round(row["High"], 2) if row["High"] else None,
                "low": round(row["Low"], 2) if row["Low"] else None,
                "close": round(row["Close"], 2) if row["Close"] else None,
                "volume": int(row["Volume"]) if row["Volume"] else None,
                "dividends": round(row.get("Dividends", 0), 4),
                "stock_splits": round(row.get("Stock Splits", 0), 4),
            })

        return result

    def get_intraday(self, symbol: str, interval: str = "5m") -> List[Dict[str, Any]]:
        """
        获取日内行情数据

        Args:
            symbol: 股票代码
            interval: K线间隔 (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h)

        Returns:
            日内价格数据列表
        """
        return self.get_history(symbol, period="1d", interval=interval)

    # ============================================================
    # 基本面数据
    # ============================================================

    def get_company_info(self, symbol: str) -> Dict[str, Any]:
        """
        获取公司基本信息
        """
        ticker = self.get_ticker(symbol)
        info = ticker.info

        return {
            "symbol": symbol.upper(),
            "name": info.get("shortName") or info.get("longName"),
            "long_name": info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "city": info.get("city"),
            "state": info.get("state"),
            "address": info.get("address1"),
            "zip": info.get("zip"),
            "phone": info.get("phone"),
            "website": info.get("website"),
            "employees": info.get("fullTimeEmployees"),
            "business_summary": info.get("longBusinessSummary"),
            "logo_url": info.get("logo_url"),
        }

    def get_financials(self, symbol: str) -> Dict[str, Any]:
        """
        获取财务数据概览
        包含: 收入、利润、资产负债等关键指标
        """
        ticker = self.get_ticker(symbol)
        info = ticker.info

        return {
            "symbol": symbol.upper(),
            # 估值指标
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "price_to_book": info.get("priceToBook"),
            "price_to_sales": info.get("priceToSalesTrailing12Months"),
            "enterprise_value": info.get("enterpriseValue"),
            "ev_to_revenue": info.get("enterpriseToRevenue"),
            "ev_to_ebitda": info.get("enterpriseToEbitda"),
            # 盈利指标
            "profit_margins": info.get("profitMargins"),
            "operating_margins": info.get("operatingMargins"),
            "gross_margins": info.get("grossMargins"),
            "ebitda_margins": info.get("ebitdaMargins"),
            "return_on_assets": info.get("returnOnAssets"),
            "return_on_equity": info.get("returnOnEquity"),
            # 收入与利润
            "total_revenue": info.get("totalRevenue"),
            "revenue_per_share": info.get("revenuePerShare"),
            "revenue_growth": info.get("revenueGrowth"),
            "earnings_growth": info.get("earningsGrowth"),
            "quarterly_earnings_growth": info.get("earningsQuarterlyGrowth"),
            "quarterly_revenue_growth": info.get("revenueQuarterlyGrowth"),
            "gross_profits": info.get("grossProfits"),
            "ebitda": info.get("ebitda"),
            "net_income": info.get("netIncomeToCommon"),
            # 每股数据
            "eps_trailing": info.get("trailingEps"),
            "eps_forward": info.get("forwardEps"),
            "book_value": info.get("bookValue"),
            # 资产负债
            "total_cash": info.get("totalCash"),
            "total_cash_per_share": info.get("totalCashPerShare"),
            "total_debt": info.get("totalDebt"),
            "debt_to_equity": info.get("debtToEquity"),
            "current_ratio": info.get("currentRatio"),
            "quick_ratio": info.get("quickRatio"),
            # 现金流
            "free_cash_flow": info.get("freeCashflow"),
            "operating_cash_flow": info.get("operatingCashflow"),
        }

    def get_income_statement(self, symbol: str, quarterly: bool = False) -> List[Dict[str, Any]]:
        """
        获取利润表
        """
        ticker = self.get_ticker(symbol)

        if quarterly:
            df = ticker.quarterly_income_stmt
        else:
            df = ticker.income_stmt

        if df.empty:
            return []

        result = []
        for col in df.columns:
            period_data = {
                "period": col.isoformat() if hasattr(col, "isoformat") else str(col),
            }
            for idx in df.index:
                value = df.loc[idx, col]
                # 转换为 Python 原生类型
                if hasattr(value, "item"):
                    value = value.item()
                period_data[str(idx)] = value
            result.append(period_data)

        return result

    def get_balance_sheet(self, symbol: str, quarterly: bool = False) -> List[Dict[str, Any]]:
        """
        获取资产负债表
        """
        ticker = self.get_ticker(symbol)

        if quarterly:
            df = ticker.quarterly_balance_sheet
        else:
            df = ticker.balance_sheet

        if df.empty:
            return []

        result = []
        for col in df.columns:
            period_data = {
                "period": col.isoformat() if hasattr(col, "isoformat") else str(col),
            }
            for idx in df.index:
                value = df.loc[idx, col]
                if hasattr(value, "item"):
                    value = value.item()
                period_data[str(idx)] = value
            result.append(period_data)

        return result

    def get_cash_flow(self, symbol: str, quarterly: bool = False) -> List[Dict[str, Any]]:
        """
        获取现金流量表
        """
        ticker = self.get_ticker(symbol)

        if quarterly:
            df = ticker.quarterly_cashflow
        else:
            df = ticker.cashflow

        if df.empty:
            return []

        result = []
        for col in df.columns:
            period_data = {
                "period": col.isoformat() if hasattr(col, "isoformat") else str(col),
            }
            for idx in df.index:
                value = df.loc[idx, col]
                if hasattr(value, "item"):
                    value = value.item()
                period_data[str(idx)] = value
            result.append(period_data)

        return result

    def get_dividends(self, symbol: str) -> Dict[str, Any]:
        """
        获取股息信息
        """
        ticker = self.get_ticker(symbol)
        info = ticker.info

        # 获取历史股息
        dividends = ticker.dividends
        dividend_history = []
        if not dividends.empty:
            for date, amount in dividends.items():
                dividend_history.append({
                    "date": date.isoformat() if hasattr(date, "isoformat") else str(date),
                    "amount": round(float(amount), 4),
                })

        return {
            "symbol": symbol.upper(),
            "dividend_rate": info.get("dividendRate"),
            "dividend_yield": info.get("dividendYield"),
            "trailing_annual_dividend_rate": info.get("trailingAnnualDividendRate"),
            "trailing_annual_dividend_yield": info.get("trailingAnnualDividendYield"),
            "five_year_avg_dividend_yield": info.get("fiveYearAvgDividendYield"),
            "payout_ratio": info.get("payoutRatio"),
            "ex_dividend_date": info.get("exDividendDate"),
            "last_dividend_date": info.get("lastDividendDate"),
            "last_dividend_value": info.get("lastDividendValue"),
            "history": dividend_history[-20:],  # 最近20次股息
        }

    # ============================================================
    # 交易与持仓数据
    # ============================================================

    def get_options(self, symbol: str) -> Dict[str, Any]:
        """
        获取期权数据
        """
        ticker = self.get_ticker(symbol)

        # 获取到期日列表
        try:
            expirations = ticker.options
        except Exception:
            return {
                "symbol": symbol.upper(),
                "expirations": [],
                "options_chain": None,
                "error": "No options data available"
            }

        if not expirations:
            return {
                "symbol": symbol.upper(),
                "expirations": [],
                "options_chain": None,
            }

        # 获取最近到期日的期权链
        nearest_exp = expirations[0]
        opt = ticker.option_chain(nearest_exp)

        calls = []
        if not opt.calls.empty:
            calls_df = opt.calls.head(20)  # 限制数量
            for _, row in calls_df.iterrows():
                calls.append({
                    "contract_symbol": row.get("contractSymbol"),
                    "strike": row.get("strike"),
                    "last_price": row.get("lastPrice"),
                    "bid": row.get("bid"),
                    "ask": row.get("ask"),
                    "change": row.get("change"),
                    "percent_change": row.get("percentChange"),
                    "volume": row.get("volume"),
                    "open_interest": row.get("openInterest"),
                    "implied_volatility": row.get("impliedVolatility"),
                    "in_the_money": row.get("inTheMoney"),
                })

        puts = []
        if not opt.puts.empty:
            puts_df = opt.puts.head(20)
            for _, row in puts_df.iterrows():
                puts.append({
                    "contract_symbol": row.get("contractSymbol"),
                    "strike": row.get("strike"),
                    "last_price": row.get("lastPrice"),
                    "bid": row.get("bid"),
                    "ask": row.get("ask"),
                    "change": row.get("change"),
                    "percent_change": row.get("percentChange"),
                    "volume": row.get("volume"),
                    "open_interest": row.get("openInterest"),
                    "implied_volatility": row.get("impliedVolatility"),
                    "in_the_money": row.get("inTheMoney"),
                })

        return {
            "symbol": symbol.upper(),
            "expirations": list(expirations),
            "options_chain": {
                "expiration": nearest_exp,
                "calls": calls,
                "puts": puts,
            }
        }

    def get_options_chain(self, symbol: str, expiration: str) -> Dict[str, Any]:
        """
        获取指定到期日的期权链
        """
        ticker = self.get_ticker(symbol)

        try:
            opt = ticker.option_chain(expiration)
        except Exception as e:
            return {
                "symbol": symbol.upper(),
                "expiration": expiration,
                "error": str(e),
            }

        calls = []
        if not opt.calls.empty:
            for _, row in opt.calls.iterrows():
                calls.append({
                    "contract_symbol": row.get("contractSymbol"),
                    "strike": row.get("strike"),
                    "last_price": row.get("lastPrice"),
                    "bid": row.get("bid"),
                    "ask": row.get("ask"),
                    "change": row.get("change"),
                    "percent_change": row.get("percentChange"),
                    "volume": row.get("volume"),
                    "open_interest": row.get("openInterest"),
                    "implied_volatility": row.get("impliedVolatility"),
                    "in_the_money": row.get("inTheMoney"),
                })

        puts = []
        if not opt.puts.empty:
            for _, row in opt.puts.iterrows():
                puts.append({
                    "contract_symbol": row.get("contractSymbol"),
                    "strike": row.get("strike"),
                    "last_price": row.get("lastPrice"),
                    "bid": row.get("bid"),
                    "ask": row.get("ask"),
                    "change": row.get("change"),
                    "percent_change": row.get("percentChange"),
                    "volume": row.get("volume"),
                    "open_interest": row.get("openInterest"),
                    "implied_volatility": row.get("impliedVolatility"),
                    "in_the_money": row.get("inTheMoney"),
                })

        return {
            "symbol": symbol.upper(),
            "expiration": expiration,
            "calls": calls,
            "puts": puts,
        }

    def get_holders(self, symbol: str) -> Dict[str, Any]:
        """
        获取持仓数据
        包含: 机构持仓、主要持有人、内部人持仓
        """
        ticker = self.get_ticker(symbol)
        info = ticker.info

        # 机构持仓
        institutional_holders = []
        try:
            inst_df = ticker.institutional_holders
            if inst_df is not None and not inst_df.empty:
                for _, row in inst_df.iterrows():
                    date_held = row.get("Date Reported")
                    institutional_holders.append({
                        "holder": row.get("Holder"),
                        "shares": row.get("Shares"),
                        "date_reported": date_held.isoformat() if hasattr(date_held, "isoformat") else str(date_held) if date_held else None,
                        "percent_out": row.get("% Out"),
                        "value": row.get("Value"),
                    })
        except Exception:
            pass

        # 主要持有人
        major_holders = []
        try:
            major_df = ticker.major_holders
            if major_df is not None and not major_df.empty:
                for idx, row in major_df.iterrows():
                    major_holders.append({
                        "value": row[0] if len(row) > 0 else None,
                        "description": row[1] if len(row) > 1 else str(idx),
                    })
        except Exception:
            pass

        # 内部人持仓
        insider_holders = []
        try:
            insider_df = ticker.insider_transactions
            if insider_df is not None and not insider_df.empty:
                for _, row in insider_df.head(20).iterrows():
                    start_date = row.get("Start Date")
                    insider_holders.append({
                        "insider": row.get("Insider"),
                        "relation": row.get("Relation"),
                        "shares": row.get("Shares"),
                        "transaction": row.get("Transaction"),
                        "start_date": start_date.isoformat() if hasattr(start_date, "isoformat") else str(start_date) if start_date else None,
                        "value": row.get("Value"),
                    })
        except Exception:
            pass

        return {
            "symbol": symbol.upper(),
            "held_percent_insiders": info.get("heldPercentInsiders"),
            "held_percent_institutions": info.get("heldPercentInstitutions"),
            "float_shares": info.get("floatShares"),
            "shares_outstanding": info.get("sharesOutstanding"),
            "shares_short": info.get("sharesShort"),
            "short_ratio": info.get("shortRatio"),
            "short_percent_of_float": info.get("shortPercentOfFloat"),
            "shares_short_prior_month": info.get("sharesShortPriorMonth"),
            "institutional_holders": institutional_holders,
            "major_holders": major_holders,
            "insider_transactions": insider_holders,
        }

    def get_insider_transactions(self, symbol: str) -> List[Dict[str, Any]]:
        """
        获取内部人交易记录
        """
        ticker = self.get_ticker(symbol)

        try:
            df = ticker.insider_transactions
            if df is None or df.empty:
                return []
        except Exception:
            return []

        result = []
        for _, row in df.iterrows():
            start_date = row.get("Start Date")
            result.append({
                "insider": row.get("Insider"),
                "relation": row.get("Relation"),
                "shares": row.get("Shares"),
                "transaction": row.get("Transaction"),
                "start_date": start_date.isoformat() if hasattr(start_date, "isoformat") else str(start_date) if start_date else None,
                "value": row.get("Value"),
                "url": row.get("URL"),
            })

        return result

    # ============================================================
    # 分析师与新闻
    # ============================================================

    def get_analyst_recommendations(self, symbol: str) -> Dict[str, Any]:
        """
        获取分析师评级和目标价格
        """
        ticker = self.get_ticker(symbol)
        info = ticker.info

        # 获取推荐历史
        recommendations = []
        try:
            rec_df = ticker.recommendations
            if rec_df is not None and not rec_df.empty:
                rec_df = rec_df.tail(30)  # 最近30条
                for idx, row in rec_df.iterrows():
                    recommendations.append({
                        "date": idx.isoformat() if hasattr(idx, "isoformat") else str(idx),
                        "firm": row.get("Firm"),
                        "to_grade": row.get("To Grade"),
                        "from_grade": row.get("From Grade"),
                        "action": row.get("Action"),
                    })
        except Exception:
            pass

        # 获取评级摘要
        recommendations_summary = []
        try:
            sum_df = ticker.recommendations_summary
            if sum_df is not None and not sum_df.empty:
                for idx, row in sum_df.iterrows():
                    recommendations_summary.append({
                        "period": row.get("period") or str(idx),
                        "strong_buy": row.get("strongBuy"),
                        "buy": row.get("buy"),
                        "hold": row.get("hold"),
                        "sell": row.get("sell"),
                        "strong_sell": row.get("strongSell"),
                    })
        except Exception:
            pass

        return {
            "symbol": symbol.upper(),
            "recommendation_key": info.get("recommendationKey"),
            "recommendation_mean": info.get("recommendationMean"),
            "number_of_analyst_opinions": info.get("numberOfAnalystOpinions"),
            "target_mean_price": info.get("targetMeanPrice"),
            "target_high_price": info.get("targetHighPrice"),
            "target_low_price": info.get("targetLowPrice"),
            "target_median_price": info.get("targetMedianPrice"),
            "current_price": info.get("currentPrice"),
            "recommendations": recommendations,
            "recommendations_summary": recommendations_summary,
        }

    def get_earnings(self, symbol: str) -> Dict[str, Any]:
        """
        获取盈利信息和预期
        """
        ticker = self.get_ticker(symbol)
        info = ticker.info

        # 历史盈利
        earnings_history = []
        try:
            earnings_df = ticker.earnings_history
            if earnings_df is not None and not earnings_df.empty:
                for _, row in earnings_df.iterrows():
                    eps_actual = row.get("epsActual")
                    eps_estimate = row.get("epsEstimate")
                    earnings_history.append({
                        "quarter": row.get("quarter"),
                        "eps_actual": float(eps_actual) if eps_actual else None,
                        "eps_estimate": float(eps_estimate) if eps_estimate else None,
                        "surprise_percent": row.get("surprisePercent"),
                    })
        except Exception:
            pass

        # 盈利预期
        earnings_dates = []
        try:
            dates_df = ticker.earnings_dates
            if dates_df is not None and not dates_df.empty:
                for idx, row in dates_df.head(8).iterrows():
                    earnings_dates.append({
                        "date": idx.isoformat() if hasattr(idx, "isoformat") else str(idx),
                        "eps_estimate": row.get("EPS Estimate"),
                        "reported_eps": row.get("Reported EPS"),
                        "surprise_percent": row.get("Surprise(%)"),
                    })
        except Exception:
            pass

        return {
            "symbol": symbol.upper(),
            "earnings_date": info.get("earningsDate"),
            "earnings_quarterly_growth": info.get("earningsQuarterlyGrowth"),
            "revenue_quarterly_growth": info.get("revenueQuarterlyGrowth"),
            "earnings_history": earnings_history,
            "earnings_dates": earnings_dates,
        }

    def get_news(self, symbol: str) -> List[Dict[str, Any]]:
        """
        获取相关新闻
        """
        ticker = self.get_ticker(symbol)

        try:
            news = ticker.news
        except Exception:
            return []

        if not news:
            return []

        result = []
        for item in news[:20]:  # 限制数量
            result.append({
                "uuid": item.get("uuid"),
                "title": item.get("title"),
                "publisher": item.get("publisher"),
                "link": item.get("link"),
                "publish_time": item.get("providerPublishTime"),
                "type": item.get("type"),
                "thumbnail": item.get("thumbnail", {}).get("resolutions", [{}])[0].get("url") if item.get("thumbnail") else None,
                "related_tickers": item.get("relatedTickers", []),
            })

        return result

    # ============================================================
    # 批量操作
    # ============================================================

    def get_multiple_quotes(self, symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        批量获取多个股票的报价
        """
        result = {}
        for symbol in symbols:
            try:
                result[symbol.upper()] = self.get_quote(symbol)
            except Exception as e:
                result[symbol.upper()] = {"error": str(e)}
        return result

    def download_data(
        self,
        symbols: List[str],
        period: str = "1mo",
        interval: str = "1d",
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        批量下载多个股票的历史数据
        """
        result = {}
        for symbol in symbols:
            try:
                result[symbol.upper()] = self.get_history(symbol, period=period, interval=interval)
            except Exception as e:
                result[symbol.upper()] = []
        return result


# 创建全局服务实例
_yfinance_service: Optional[YFinanceService] = None


def get_yfinance_service() -> YFinanceService:
    """获取 YFinance 服务单例"""
    global _yfinance_service
    if _yfinance_service is None:
        _yfinance_service = YFinanceService()
    return _yfinance_service








