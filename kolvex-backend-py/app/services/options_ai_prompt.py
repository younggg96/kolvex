"""
Options AI Prompt Generation
Ported from kolvex-frontend-web-nextjs/lib/optionsAiPrompt.ts
"""

from typing import Any

MAX_ITEMS = 20

PROFILE_INSTRUCTIONS = {
    "conservative": """Strategy: Follow institutional/whale money (稳健型 - 跟庄策略).
Focus on:
- Trades with "whale_trade" or "large_premium" signals showing institutional accumulation
- Higher open interest contracts (established positions with liquidity)
- At-the-money (ATM) or slightly in-the-money (ITM) contracts for higher delta
- Longer expirations (>30 DTE) to allow the thesis to play out
- Lower implied volatility for cost-efficient entries
Risk approach: Conservative position sizing (1-2% of portfolio), tight stop losses, favor liquid contracts with narrow bid-ask spreads.""",
    "aggressive": """Strategy: Maximize leverage on high-conviction signals (激进型 - 投机策略).
Focus on:
- Extreme Vol/OI ratios (>10x) indicating aggressive new positioning
- Out-of-the-money (OTM) contracts for maximum leverage potential
- High volume spikes indicating urgent accumulation or capitulation
- Shorter expirations for explosive gamma exposure
- Deep OTM strikes where Vol/OI is extraordinarily high
Risk approach: Smaller position sizes (max 1% risk per trade) but wider stops. Accept higher per-trade loss potential for outsized returns.""",
    "hedging": """Strategy: Use options for portfolio protection and risk hedging (对冲型 - 风险对冲).
Focus on:
- Put options for downside protection when heavy call flow is detected (contrarian hedge)
- Signals showing institutional hedging activity (large put premiums)
- ATM or slightly OTM puts for capital-efficient portfolio insurance
- Spread strategies when IV is elevated to reduce cost
- Balanced approach: consider the opposite side of dominant flow as a hedge
Risk approach: Size hedges relative to portfolio exposure. Focus on cost-efficient protection with longer DTE for sustained coverage. Target 3-5% of portfolio value in hedge positions.""",
}

JSON_SCHEMA = """{
  "risk_profile": "conservative|aggressive|hedging",
  "market_context": {
    "overall_sentiment": "bullish|bearish|neutral",
    "key_observations": ["string - 2-4 key observations about the flow data"]
  },
  "recommendation": {
    "contract_symbol": "string - exact contract_symbol from the data",
    "symbol": "string - underlying ticker",
    "option_type": "call|put",
    "strike": 0.00,
    "expiration": "YYYY-MM-DD",
    "last_price": 0.00,
    "implied_volatility": 0.00,
    "signal_explanation": "string - 2-3 sentences explaining why this contract",
    "confidence": "high|medium|low"
  },
  "risk_management": {
    "stop_loss": {
      "price_based": {"type":"price","trigger_price":0.00,"description":"string"},
      "premium_based": {"type":"premium","drawdown_percent":20,"description":"string"},
      "time_based": {"type":"time","days_to_expiry_warning":7,"description":"string"}
    },
    "take_profit": [
      {"target_percent":50,"description":"string"},
      {"target_percent":100,"description":"string"}
    ],
    "position_size_suggestion": "string"
  },
  "disclaimer": "string"
}"""


def _format_premium(value: float) -> str:
    if value >= 1_000_000:
        return f"${value / 1_000_000:.2f}M"
    if value >= 1_000:
        return f"${value / 1_000:.1f}K"
    return f"${value:.0f}"


def _format_row(item: dict[str, Any], idx: int) -> str:
    vol_oi = f"{item.get('vol_oi_ratio', 0):.1f}x" if item.get("vol_oi_ratio", 0) > 0 else "N/A"
    iv = f"{item.get('implied_volatility', 0) * 100:.1f}"
    premium = _format_premium(item.get("premium", 0))
    signals = ", ".join(item.get("signal_types", []))

    return (
        f"| {idx + 1} | {item['symbol']} | {item.get('option_type', '').upper()} "
        f"| ${item.get('strike', 0):.2f} | {item.get('expiration', '')} "
        f"| {item.get('volume', 0):,} | {item.get('open_interest', 0):,} | {vol_oi} "
        f"| ${item.get('last_price', 0):.2f} | {premium} | {iv}% "
        f"| ${item.get('stock_price', 0):.2f} | {'Yes' if item.get('in_the_money') else 'No'} "
        f"| {signals} | {item.get('signal_strength', 0)}/5 |"
    )


def compute_input_summary(data: list[dict[str, Any]]) -> dict[str, Any]:
    total_premium = sum(d.get("premium", 0) for d in data)
    call_count = sum(1 for d in data if d.get("option_type") == "call")
    put_count = sum(1 for d in data if d.get("option_type") == "put")
    symbols = list({d["symbol"] for d in data if "symbol" in d})

    return {
        "signal_count": len(data),
        "top_symbols": symbols[:10],
        "total_premium": total_premium,
        "call_count": call_count,
        "put_count": put_count,
    }


def generate_trading_prompt(
    options_data: list[dict[str, Any]],
    risk_profile: str,
    locale: str = "en",
) -> tuple[str, str]:
    """
    Returns (system_prompt, user_prompt) for LLM-based options flow analysis.
    """
    sorted_data = sorted(
        options_data,
        key=lambda d: (-d.get("signal_strength", 0), -d.get("premium", 0)),
    )[:MAX_ITEMS]

    total_premium = sum(d.get("premium", 0) for d in sorted_data)
    call_count = sum(1 for d in sorted_data if d.get("option_type") == "call")
    put_count = sum(1 for d in sorted_data if d.get("option_type") == "put")
    avg_vol_oi = (
        sum(d.get("vol_oi_ratio", 0) for d in sorted_data) / max(len(sorted_data), 1)
    )
    whale_count = sum(1 for d in sorted_data if "whale_trade" in d.get("signal_types", []))
    extreme_count = sum(1 for d in sorted_data if "extreme_vol_oi" in d.get("signal_types", []))
    unique_symbols = len({d["symbol"] for d in sorted_data if "symbol" in d})
    cp_ratio = f"{call_count / put_count:.2f}" if put_count > 0 else "N/A"

    header = "| # | Symbol | Type | Strike | Exp | Vol | OI | Vol/OI | Price | Premium | IV | Stock | ITM | Signals | Strength |"
    divider = "|---|--------|------|--------|-----|-----|----|---------|----|---------|-----|-------|-----|---------|----------|"
    rows = "\n".join(_format_row(item, idx) for idx, item in enumerate(sorted_data))

    lang = (
        "You MUST respond entirely in Chinese (简体中文). All descriptions, explanations, and the disclaimer must be in Chinese."
        if locale == "zh"
        else "Respond entirely in English."
    )

    system = (
        "You are Kolvex AI Trading Strategist, an expert in analyzing unusual options flow data "
        "to generate actionable trading strategies. You specialize in interpreting Volume/Open Interest "
        "ratios, premium flows, institutional whale trades, and signal patterns to identify high-probability setups.\n\n"
        "Signal types reference:\n"
        "- high_vol_oi: Volume/OI ratio >2x, unusual buying relative to existing positions\n"
        "- large_premium: Total premium >$50K, significant capital commitment\n"
        "- high_volume: Volume >5,000 contracts, heavy trading activity\n"
        "- extreme_vol_oi: Volume/OI ratio >10x, extremely abnormal activity\n"
        "- whale_trade: Premium >$500K, likely institutional or \"smart money\"\n\n"
        "Your analysis must be data-driven, risk-aware, and actionable. Always reference specific numbers from the data."
    )

    user = f"""# Options Flow Analysis Request

## Aggregate Summary
- Unique symbols: {unique_symbols}
- Total premium: {_format_premium(total_premium)}
- Call/Put split: {call_count} calls / {put_count} puts (ratio: {cp_ratio})
- Average Vol/OI: {avg_vol_oi:.1f}x
- Whale trades: {whale_count}
- Extreme signals: {extreme_count}

## Top {len(sorted_data)} Signals (sorted by strength + premium)
{header}
{divider}
{rows}

## Risk Profile: {risk_profile.upper()}
{PROFILE_INSTRUCTIONS.get(risk_profile, PROFILE_INSTRUCTIONS["conservative"])}

## Output Requirements
Return ONLY a valid JSON object matching this exact schema. No markdown, no code fences, no extra text.
{JSON_SCHEMA}

## Language
{lang}

IMPORTANT: Pick the BEST single contract from the data above for the {risk_profile} profile. Use actual values from the data (contract_symbol, strike, price, etc). The trigger_price for price-based stop loss should be a realistic support level below the current stock price."""

    return system, user
