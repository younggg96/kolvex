"""
Portfolio AI Analyzer Service
Provides AI-powered analysis for user portfolio holdings
"""

import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

from app.services.ai.client import OllamaClient
from app.services.ai.utils import extract_json_object


class PortfolioAnalyzer:
    """Portfolio analyzer using AI to provide investment insights"""

    def __init__(self, client: OllamaClient = None):
        self.client = client or OllamaClient()

    async def analyze_portfolio(
        self, 
        holdings_data: Dict[str, Any],
        user_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze the entire portfolio and provide AI insights

        Args:
            holdings_data: Portfolio holdings data with accounts and positions
            user_context: Optional additional context from user

        Returns:
            {
                "overall_analysis": {
                    "summary": "Overall portfolio health summary",
                    "risk_level": "low/medium/high",
                    "diversification_score": 0-100,
                    "strengths": ["strength1", "strength2"],
                    "weaknesses": ["weakness1", "weakness2"],
                    "recommendations": ["rec1", "rec2"]
                },
                "stock_analyses": [
                    {
                        "symbol": "AAPL",
                        "name": "Apple Inc.",
                        "current_weight": 15.5,
                        "sentiment": "bullish/bearish/neutral",
                        "analysis": "Detailed analysis...",
                        "recommendation": "hold/buy_more/reduce/sell",
                        "confidence": 0.85,
                        "key_points": ["point1", "point2"]
                    }
                ],
                "portfolio_suggestions": {
                    "rebalancing": ["suggestion1"],
                    "risk_management": ["suggestion1"],
                    "opportunities": ["opportunity1"]
                },
                "analyzed_at": "2024-01-15T10:30:00Z",
                "model": "llama3-8b-finance"
            }
        """
        # Extract positions from holdings
        positions = self._extract_positions(holdings_data)
        
        if not positions:
            return self._empty_analysis_result()

        # Build portfolio summary for AI
        portfolio_summary = self._build_portfolio_summary(positions, holdings_data)
        
        # Generate AI analysis
        prompt = self._build_analysis_prompt(portfolio_summary, user_context)
        
        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.3,
                max_tokens=3000,
            )

            result = extract_json_object(response)
            
            if result:
                return {
                    "overall_analysis": result.get("overall_analysis", {}),
                    "stock_analyses": result.get("stock_analyses", []),
                    "portfolio_suggestions": result.get("portfolio_suggestions", {}),
                    "analyzed_at": datetime.now(timezone.utc).isoformat(),
                    "model": self.client.model,
                    "positions_analyzed": len(positions),
                }
            
            return self._empty_analysis_result()

        except Exception as e:
            print(f"⚠️ Portfolio analysis failed: {e}")
            return self._empty_analysis_result()

    async def analyze_single_stock(
        self,
        symbol: str,
        position_data: Dict[str, Any],
        portfolio_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze a single stock position in detail

        Args:
            symbol: Stock ticker symbol
            position_data: Position data including price, units, cost, etc.
            portfolio_context: Optional overall portfolio context

        Returns:
            Detailed stock analysis
        """
        prompt = f"""Analyze this stock position in detail.

Stock: {symbol}
Position Data:
- Current Price: ${position_data.get('price', 'N/A')}
- Shares: {position_data.get('units', 'N/A')}
- Average Cost: ${position_data.get('average_purchase_price', 'N/A')}
- Current Value: ${position_data.get('market_value', 'N/A')}
- Unrealized P&L: ${position_data.get('open_pnl', 'N/A')}
- Portfolio Weight: {position_data.get('weight_percent', 'N/A')}%
- Position Type: {position_data.get('position_type', 'equity')}

{f"Portfolio Context: Total Value ${portfolio_context.get('total_value', 'N/A')}" if portfolio_context else ""}

Provide a comprehensive analysis. Respond with ONLY this JSON object:
{{
  "symbol": "{symbol}",
  "sentiment": "bullish/bearish/neutral",
  "sentiment_confidence": 0.0-1.0,
  "short_term_outlook": "positive/negative/neutral",
  "long_term_outlook": "positive/negative/neutral",
  "analysis_summary": "2-3 sentence summary",
  "key_factors": ["factor1", "factor2", "factor3"],
  "risk_factors": ["risk1", "risk2"],
  "recommendation": "strong_buy/buy/hold/reduce/sell",
  "target_weight": 0-100,
  "rationale": "Brief rationale for recommendation"
}}"""

        try:
            response = await self.client.generate(
                prompt=prompt,
                temperature=0.2,
                max_tokens=800,
            )

            result = extract_json_object(response)
            
            if result:
                return {
                    **result,
                    "analyzed_at": datetime.now(timezone.utc).isoformat(),
                    "model": self.client.model,
                }
            
            return self._default_stock_analysis(symbol)

        except Exception as e:
            print(f"⚠️ Single stock analysis failed for {symbol}: {e}")
            return self._default_stock_analysis(symbol)

    def _extract_positions(self, holdings_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract all positions from holdings data"""
        positions = []
        accounts = holdings_data.get("accounts", [])
        
        for account in accounts:
            for position in account.get("snaptrade_positions", []):
                # Skip hidden positions
                if position.get("is_hidden"):
                    continue
                positions.append({
                    **position,
                    "account_name": account.get("account_name", "Unknown"),
                    "brokerage": account.get("brokerage_name", "Unknown"),
                })
        
        return positions

    def _build_portfolio_summary(
        self, 
        positions: List[Dict[str, Any]], 
        holdings_data: Dict[str, Any]
    ) -> str:
        """Build a text summary of the portfolio for AI analysis"""
        
        # Calculate totals
        total_value = 0
        total_pnl = 0
        equity_positions = []
        option_positions = []
        
        for pos in positions:
            price = pos.get("price", 0) or 0
            units = pos.get("units", 0) or 0
            is_option = pos.get("position_type") == "option"
            
            multiplier = 100 if is_option else 1
            value = price * units * multiplier
            total_value += value
            
            pnl = pos.get("open_pnl", 0) or 0
            total_pnl += pnl
            
            if is_option:
                option_positions.append(pos)
            else:
                equity_positions.append(pos)

        # Build position strings
        position_lines = []
        for pos in equity_positions[:20]:  # Limit to top 20 equity positions
            symbol = pos.get("symbol", "???")
            name = pos.get("security_name", symbol)
            price = pos.get("price", 0) or 0
            units = pos.get("units", 0) or 0
            value = price * units
            weight = (value / total_value * 100) if total_value > 0 else 0
            pnl = pos.get("open_pnl", 0) or 0
            avg_cost = pos.get("average_purchase_price", 0) or 0
            
            position_lines.append(
                f"- {symbol} ({name[:30]}): {units:.2f} shares @ ${price:.2f}, "
                f"Value: ${value:,.2f} ({weight:.1f}%), P&L: ${pnl:,.2f}, Avg Cost: ${avg_cost:.2f}"
            )

        option_summary = ""
        if option_positions:
            option_count = len(option_positions)
            option_value = sum(
                (p.get("price", 0) or 0) * (p.get("units", 0) or 0) * 100 
                for p in option_positions
            )
            option_summary = f"\nOptions Positions: {option_count} contracts, Total Value: ${option_value:,.2f}"

        summary = f"""Portfolio Overview:
- Total Value: ${total_value:,.2f}
- Total Unrealized P&L: ${total_pnl:,.2f} ({(total_pnl/total_value*100) if total_value > 0 else 0:.2f}%)
- Equity Positions: {len(equity_positions)}
- Option Positions: {len(option_positions)}
{option_summary}

Equity Holdings (Top {min(20, len(equity_positions))}):
{chr(10).join(position_lines)}
"""
        return summary

    def _build_analysis_prompt(
        self, 
        portfolio_summary: str, 
        user_context: Optional[str] = None
    ) -> str:
        """Build the AI analysis prompt"""
        
        context_section = ""
        if user_context:
            context_section = f"\nUser's Investment Context: {user_context}\n"
        
        return f"""You are an expert financial analyst. Analyze this portfolio and provide comprehensive investment insights.

{portfolio_summary}
{context_section}

Provide your analysis in ONLY this JSON format, no other text before or after:
{{
  "overall_analysis": {{
    "summary": "2-3 sentence overall portfolio health summary",
    "risk_level": "low/medium/high",
    "diversification_score": 0-100,
    "portfolio_style": "growth/value/balanced/aggressive/conservative",
    "strengths": ["strength1", "strength2", "strength3"],
    "weaknesses": ["weakness1", "weakness2"],
    "key_metrics": {{
      "concentration_risk": "low/medium/high",
      "sector_balance": "poor/fair/good/excellent",
      "growth_potential": "low/medium/high"
    }}
  }},
  "stock_analyses": [
    {{
      "symbol": "TICKER",
      "name": "Company Name",
      "current_weight": 0.0,
      "sentiment": "bullish/bearish/neutral",
      "analysis": "1-2 sentence analysis",
      "recommendation": "hold/buy_more/reduce/sell",
      "confidence": 0.0-1.0,
      "key_points": ["point1", "point2"]
    }}
  ],
  "portfolio_suggestions": {{
    "rebalancing": ["suggestion1", "suggestion2"],
    "risk_management": ["suggestion1"],
    "opportunities": ["opportunity1", "opportunity2"],
    "tax_considerations": ["consideration1"]
  }}
}}

IMPORTANT:
- Analyze ALL stocks in the portfolio individually in stock_analyses
- Be specific and actionable in recommendations
- Consider both short-term and long-term perspectives
- Factor in diversification and risk management"""

    def _empty_analysis_result(self) -> Dict[str, Any]:
        """Return empty analysis result"""
        return {
            "overall_analysis": {
                "summary": "Unable to analyze portfolio. Please ensure you have positions to analyze.",
                "risk_level": "unknown",
                "diversification_score": 0,
                "strengths": [],
                "weaknesses": [],
                "key_metrics": {}
            },
            "stock_analyses": [],
            "portfolio_suggestions": {
                "rebalancing": [],
                "risk_management": [],
                "opportunities": []
            },
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "model": self.client.model if self.client else "unknown",
            "positions_analyzed": 0,
        }

    def _default_stock_analysis(self, symbol: str) -> Dict[str, Any]:
        """Return default stock analysis on failure"""
        return {
            "symbol": symbol,
            "sentiment": "neutral",
            "sentiment_confidence": 0.0,
            "analysis_summary": "Analysis unavailable",
            "key_factors": [],
            "risk_factors": [],
            "recommendation": "hold",
            "rationale": "Unable to perform analysis",
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "model": self.client.model if self.client else "unknown",
        }


# Singleton instance for easy import
async def analyze_portfolio(
    holdings_data: Dict[str, Any],
    user_context: Optional[str] = None
) -> Dict[str, Any]:
    """Convenience function to analyze portfolio"""
    async with OllamaClient() as client:
        analyzer = PortfolioAnalyzer(client)
        return await analyzer.analyze_portfolio(holdings_data, user_context)


async def analyze_stock(
    symbol: str,
    position_data: Dict[str, Any],
    portfolio_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Convenience function to analyze a single stock"""
    async with OllamaClient() as client:
        analyzer = PortfolioAnalyzer(client)
        return await analyzer.analyze_single_stock(symbol, position_data, portfolio_context)
