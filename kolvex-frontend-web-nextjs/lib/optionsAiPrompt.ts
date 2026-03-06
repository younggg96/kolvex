import type { UnusualActivityItem } from "./optionsFlowApi";
import type { RiskProfile } from "./optionsAiTypes";

const MAX_ITEMS = 20;

const PROFILE_INSTRUCTIONS: Record<RiskProfile, string> = {
  conservative: `Strategy: Follow institutional/whale money (稳健型 - 跟庄策略).
Focus on:
- Trades with "whale_trade" or "large_premium" signals showing institutional accumulation
- Higher open interest contracts (established positions with liquidity)
- At-the-money (ATM) or slightly in-the-money (ITM) contracts for higher delta
- Longer expirations (>30 DTE) to allow the thesis to play out
- Lower implied volatility for cost-efficient entries
Risk approach: Conservative position sizing (1-2% of portfolio), tight stop losses, favor liquid contracts with narrow bid-ask spreads.`,

  aggressive: `Strategy: Maximize leverage on high-conviction signals (激进型 - 投机策略).
Focus on:
- Extreme Vol/OI ratios (>10x) indicating aggressive new positioning
- Out-of-the-money (OTM) contracts for maximum leverage potential
- High volume spikes indicating urgent accumulation or capitulation
- Shorter expirations for explosive gamma exposure
- Deep OTM strikes where Vol/OI is extraordinarily high
Risk approach: Smaller position sizes (max 1% risk per trade) but wider stops. Accept higher per-trade loss potential for outsized returns.`,

  hedging: `Strategy: Use options for portfolio protection and risk hedging (对冲型 - 风险对冲).
Focus on:
- Put options for downside protection when heavy call flow is detected (contrarian hedge)
- Signals showing institutional hedging activity (large put premiums)
- ATM or slightly OTM puts for capital-efficient portfolio insurance
- Spread strategies when IV is elevated to reduce cost
- Balanced approach: consider the opposite side of dominant flow as a hedge
Risk approach: Size hedges relative to portfolio exposure. Focus on cost-efficient protection with longer DTE for sustained coverage. Target 3-5% of portfolio value in hedge positions.`,
};

function formatDataRow(item: UnusualActivityItem, idx: number): string {
  const volOi =
    item.vol_oi_ratio > 0 ? `${item.vol_oi_ratio.toFixed(1)}x` : "N/A";
  const iv = (item.implied_volatility * 100).toFixed(1);
  const premium =
    item.premium >= 1_000_000
      ? `$${(item.premium / 1_000_000).toFixed(2)}M`
      : item.premium >= 1_000
        ? `$${(item.premium / 1_000).toFixed(1)}K`
        : `$${item.premium.toFixed(0)}`;

  return `| ${idx + 1} | ${item.symbol} | ${item.option_type.toUpperCase()} | $${item.strike.toFixed(2)} | ${item.expiration} | ${item.volume.toLocaleString()} | ${item.open_interest.toLocaleString()} | ${volOi} | $${item.last_price.toFixed(2)} | ${premium} | ${iv}% | $${item.stock_price.toFixed(2)} | ${item.in_the_money ? "Yes" : "No"} | ${item.signal_types.join(", ")} | ${item.signal_strength}/5 |`;
}

function computeAggregateStats(data: UnusualActivityItem[]) {
  const totalPremium = data.reduce((sum, d) => sum + d.premium, 0);
  const callCount = data.filter((d) => d.option_type === "call").length;
  const putCount = data.filter((d) => d.option_type === "put").length;
  const avgVolOi =
    data.reduce((sum, d) => sum + d.vol_oi_ratio, 0) / (data.length || 1);
  const whaleCount = data.filter((d) =>
    d.signal_types.includes("whale_trade")
  ).length;
  const extremeCount = data.filter((d) =>
    d.signal_types.includes("extreme_vol_oi")
  ).length;
  const uniqueSymbols = new Set(data.map((d) => d.symbol)).size;

  const premiumFormatted =
    totalPremium >= 1_000_000
      ? `$${(totalPremium / 1_000_000).toFixed(2)}M`
      : `$${(totalPremium / 1_000).toFixed(1)}K`;

  return {
    totalPremium: premiumFormatted,
    callCount,
    putCount,
    callPutRatio:
      putCount > 0 ? (callCount / putCount).toFixed(2) : "N/A (no puts)",
    avgVolOi: avgVolOi.toFixed(1),
    whaleCount,
    extremeCount,
    uniqueSymbols,
  };
}

const JSON_SCHEMA = `{
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
    "signal_explanation": "string - 2-3 sentences explaining why this contract, referencing specific metrics like Vol/OI ratio, premium size, signal types",
    "confidence": "high|medium|low"
  },
  "risk_management": {
    "stop_loss": {
      "price_based": {
        "type": "price",
        "trigger_price": 0.00,
        "description": "string - e.g. 'If XOM drops below $140, close position immediately'"
      },
      "premium_based": {
        "type": "premium",
        "drawdown_percent": 20,
        "description": "string - e.g. 'Cut loss at 20% premium drawdown (from $2.85 to $2.28)'"
      },
      "time_based": {
        "type": "time",
        "days_to_expiry_warning": 7,
        "description": "string - e.g. 'Close position if within 7 DTE to avoid accelerating theta decay'"
      }
    },
    "take_profit": [
      {
        "target_percent": 50,
        "description": "string - partial profit target with price"
      },
      {
        "target_percent": 100,
        "description": "string - full profit target with price"
      }
    ],
    "position_size_suggestion": "string - position sizing advice"
  },
  "disclaimer": "string - risk disclaimer"
}`;

/**
 * Generates a structured prompt for LLM-based options flow analysis.
 * Supports multiple languages via the locale parameter.
 *
 * @param optionsData - Raw options flow data from the API
 * @param riskProfile - User-selected risk profile
 * @param locale - User's locale ("en" or "zh") for response language
 * @returns Object with `system` and `user` prompt strings
 */
export function generateTradingPrompt(
  optionsData: UnusualActivityItem[],
  riskProfile: RiskProfile,
  locale: string = "en"
): { system: string; user: string } {
  const sortedData = [...optionsData]
    .sort((a, b) => b.signal_strength - a.signal_strength || b.premium - a.premium)
    .slice(0, MAX_ITEMS);

  const stats = computeAggregateStats(sortedData);

  const tableHeader =
    "| # | Symbol | Type | Strike | Exp | Vol | OI | Vol/OI | Price | Premium | IV | Stock | ITM | Signals | Strength |";
  const tableDivider =
    "|---|--------|------|--------|-----|-----|----|---------|----|---------|-----|-------|-----|---------|----------|";
  const tableRows = sortedData.map((item, idx) => formatDataRow(item, idx));

  const languageInstruction =
    locale === "zh"
      ? "You MUST respond entirely in Chinese (简体中文). All descriptions, explanations, and the disclaimer must be in Chinese."
      : "Respond entirely in English.";

  const system = `You are Kolvex AI Trading Strategist, an expert in analyzing unusual options flow data to generate actionable trading strategies. You specialize in interpreting Volume/Open Interest ratios, premium flows, institutional whale trades, and signal patterns to identify high-probability setups.

Signal types reference:
- high_vol_oi: Volume/OI ratio >2x, unusual buying relative to existing positions
- large_premium: Total premium >$50K, significant capital commitment
- high_volume: Volume >5,000 contracts, heavy trading activity
- extreme_vol_oi: Volume/OI ratio >10x, extremely abnormal activity
- whale_trade: Premium >$500K, likely institutional or "smart money"

Your analysis must be data-driven, risk-aware, and actionable. Always reference specific numbers from the data to support your recommendations.`;

  const user = `# Options Flow Analysis Request

## Aggregate Summary
- Unique symbols: ${stats.uniqueSymbols}
- Total premium: ${stats.totalPremium}
- Call/Put split: ${stats.callCount} calls / ${stats.putCount} puts (ratio: ${stats.callPutRatio})
- Average Vol/OI: ${stats.avgVolOi}x
- Whale trades: ${stats.whaleCount}
- Extreme signals: ${stats.extremeCount}

## Top ${sortedData.length} Signals (sorted by strength + premium)
${tableHeader}
${tableDivider}
${tableRows.join("\n")}

## Risk Profile: ${riskProfile.toUpperCase()}
${PROFILE_INSTRUCTIONS[riskProfile]}

## Output Requirements
Return ONLY a valid JSON object matching this exact schema. No markdown, no code fences, no extra text.
${JSON_SCHEMA}

## Language
${languageInstruction}

IMPORTANT: Pick the BEST single contract from the data above for the ${riskProfile} profile. Use actual values from the data (contract_symbol, strike, price, etc). The trigger_price for price-based stop loss should be a realistic support level below the current stock price.`;

  return { system, user };
}
