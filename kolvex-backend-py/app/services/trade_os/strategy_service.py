"""
Trade OS Strategy Version Service

Manages immutable strategy versions, computes canonical config hashes,
and seeds initial trading strategies.
"""

import hashlib
import json
import logging
from typing import Any, Dict, List, Optional

from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)


def compute_canonical_config_hash(config_dict: Dict[str, Any]) -> str:
    """
    Computes a deterministic SHA-256 hash of a strategy configuration
    using sorted, canonical JSON formatting.
    """
    canonical_json = json.dumps(config_dict, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


# Swing Trading Strategy V3.0 (PRD). Values mirror setup_detection.DEFAULT_PARAMS and
# market_regime.REGIME_LIMITS; those modules are what actually runs.
DEFAULT_STRATEGY_SWING_V3 = {
    "strategy_key": "SWING_V3_TREND_PULLBACK",
    "version": "3.0.0",
    "display_name": "Swing V3.0 · Trend Pullback",
    "description": "Long-only swing trades: buy the first strong close after a 3–10 day, 3–10% pullback to the EMA20 inside an EMA20 > SMA50 > SMA200 uptrend.",
    "parameters": {
        "pivot_lookback": 20,
        "pullback_days": [3, 10],
        "pullback_depth": [0.03, 0.10],
        "stop_atr_buffer": 0.25,
        "target_r_multiple": 2.0,
        "stop_distance": [0.025, 0.10],
        "entry_window_days": 2,
        "max_gap_r": 0.5,
        "time_exit_day": 16,
        "min_price": 10,
        "min_avg_dollar_volume": 20000000,
        "earnings_blackout_trading_days": 5,
    },
    "entry_rules": [
        {"indicator": "ema20_vs_sma50", "operator": ">", "value": "SMA50"},
        {"indicator": "sma50_vs_sma200", "operator": ">", "value": "SMA200"},
        {"indicator": "close_vs_sma50", "operator": ">", "value": "SMA50"},
        {"indicator": "rs20_vs_spy", "operator": ">", "value": "0"},
        {"indicator": "pivot_high", "operator": ">", "value": "HighestHigh(20) prior"},
        {"indicator": "pullback_low_vs_ema20", "operator": "<=", "value": "ATR14"},
        {"indicator": "signal_close", "operator": ">", "value": "High(t-1), Open(t), EMA20(t)"},
    ],
    "exit_rules": [
        {"type": "stop_loss", "distance": "Pullback Low - 0.25 * ATR14"},
        {"type": "take_profit", "target": "2R"},
        {"type": "time_expiry", "exit": "open of holding day 16"},
        {"type": "earnings", "exit": "last session before the report"},
    ],
    "risk_rules": {
        "max_risk_pct": {"risk_on": 0.005, "cautious": 0.0025, "risk_off": 0},
        "max_positions": {"risk_on": 4, "cautious": 2},
        "max_open_risk_pct": {"risk_on": 0.02, "cautious": 0.005},
        "max_notional_pct": 0.10,
        "max_sector_pct": 0.20,
    },
}


# Swing V3.1 (adopted 2026-11-23): same entries as V3.0; stop 0.75×ATR, 3R target,
# time exit on day 60. Research: docs/trade-os/research-2026-11-23-swing-v3-params.md
DEFAULT_STRATEGY_SWING_V3_1 = {
    **DEFAULT_STRATEGY_SWING_V3,
    "version": "3.1.0",
    "display_name": "Swing V3.1 · Trend Pullback",
    "parameters": {
        **DEFAULT_STRATEGY_SWING_V3["parameters"],
        "stop_atr_buffer": 0.75,
        "target_r_multiple": 3.0,
        "time_exit_day": 60,
    },
    "exit_rules": [
        {"type": "stop_loss", "distance": "Pullback Low - 0.75 * ATR14"},
        {"type": "take_profit", "target": "3R"},
        {"type": "time_expiry", "exit": "open of holding day 60"},
        {"type": "earnings", "exit": "last session before the report"},
    ],
}

# Seeded in this order; versions are immutable, so a new one is added, never edited.
SEEDED_STRATEGY_VERSIONS = (DEFAULT_STRATEGY_SWING_V3, DEFAULT_STRATEGY_SWING_V3_1)


class StrategyService:
    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_service()

    def get_strategy_versions(self, user_id: str) -> List[Dict[str, Any]]:
        """Fetch all strategy versions available to the user."""
        res = (
            self.supabase.table("strategy_versions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        data = res.data or []
        # Seed against every row (a retired key still holds its version), then hide retired
        # ones — deleted scanner logics keep their rows only for linked trade plans.
        visible = [row for row in data if row.get("status") != "retired"]
        # Seed each Swing version once per user. Existing versions are never edited.
        have = {(row.get("strategy_key"), row.get("version")) for row in data}
        for spec in SEEDED_STRATEGY_VERSIONS:
            if (spec["strategy_key"], spec["version"]) in have:
                continue
            seeded = self.create_strategy_version(
                user_id=user_id,
                strategy_key=spec["strategy_key"],
                version=spec["version"],
                display_name=spec["display_name"],
                description=spec["description"],
                parameters=spec["parameters"],
                entry_rules=spec["entry_rules"],
                exit_rules=spec["exit_rules"],
                risk_rules=spec["risk_rules"],
                # Not live until it has passed paper trading (PRD §14.4).
                status="research",
            )
            visible = [seeded] + visible
        return visible

    def get_strategy_version(self, user_id: str, version_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a specific strategy version by UUID."""
        res = (
            self.supabase.table("strategy_versions")
            .select("*")
            .eq("id", version_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def create_strategy_version(
        self,
        user_id: str,
        strategy_key: str,
        version: str,
        display_name: str,
        parameters: Dict[str, Any],
        entry_rules: List[Dict[str, Any]],
        exit_rules: List[Dict[str, Any]],
        risk_rules: Dict[str, Any],
        description: Optional[str] = None,
        status: str = "draft",
    ) -> Dict[str, Any]:
        """Create a new versioned strategy configuration with canonical hash."""
        config_body = {
            "strategy_key": strategy_key,
            "version": version,
            "parameters": parameters,
            "entry_rules": entry_rules,
            "exit_rules": exit_rules,
            "risk_rules": risk_rules,
        }
        config_hash = compute_canonical_config_hash(config_body)

        payload = {
            "user_id": user_id,
            "strategy_key": strategy_key,
            "version": version,
            "display_name": display_name,
            "status": status,
            "parameters": parameters,
            "entry_rules": entry_rules,
            "exit_rules": exit_rules,
            "risk_rules": risk_rules,
            "description": description,
            "config_hash": config_hash,
        }

        res = self.supabase.table("strategy_versions").insert(payload).execute()
        if not res.data:
            raise RuntimeError("Failed to create strategy version")
        return res.data[0]
