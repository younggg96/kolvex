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


DEFAULT_STRATEGY_TREND_BREAKOUT_20D = {
    "strategy_key": "TREND_BREAKOUT_20D",
    "version": "1.0.0",
    "display_name": "Trend Breakout 20D",
    "description": "Momentum trend breakout for US liquid equities. Entry on 20-day high with volume confirmation.",
    "parameters": {
        "holding_period_days": 20,
        "atr_period": 14,
        "atr_stop_multiplier": 2.0,
        "target_r_multiple": 2.0,
        "volume_surge_multiplier": 1.2,
        "min_avg_dollar_volume": 20000000,  # $20M
    },
    "entry_rules": [
        {"indicator": "close_vs_sma50", "operator": ">", "value": "SMA50"},
        {"indicator": "sma50_vs_sma200", "operator": ">", "value": "SMA200"},
        {"indicator": "close_vs_highest20", "operator": ">", "value": "HighestHigh(20)"},
        {"indicator": "volume_vs_avg20", "operator": ">=", "value": "1.2 * AvgVolume(20)"},
    ],
    "exit_rules": [
        {"type": "stop_loss", "distance": "2 * ATR(14)"},
        {"type": "take_profit", "target": "2R"},
        {"type": "time_expiry", "max_holding_sessions": 20},
    ],
    "risk_rules": {
        "max_risk_pct": 0.005,
        "max_notional_pct": 0.10,
    },
}


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
        # If user has no strategies, auto-seed the default TREND_BREAKOUT_20D v1.0.0
        if not data:
            default_strat = self.create_strategy_version(
                user_id=user_id,
                strategy_key=DEFAULT_STRATEGY_TREND_BREAKOUT_20D["strategy_key"],
                version=DEFAULT_STRATEGY_TREND_BREAKOUT_20D["version"],
                display_name=DEFAULT_STRATEGY_TREND_BREAKOUT_20D["display_name"],
                description=DEFAULT_STRATEGY_TREND_BREAKOUT_20D["description"],
                parameters=DEFAULT_STRATEGY_TREND_BREAKOUT_20D["parameters"],
                entry_rules=DEFAULT_STRATEGY_TREND_BREAKOUT_20D["entry_rules"],
                exit_rules=DEFAULT_STRATEGY_TREND_BREAKOUT_20D["exit_rules"],
                risk_rules=DEFAULT_STRATEGY_TREND_BREAKOUT_20D["risk_rules"],
                status="live_eligible",
            )
            data = [default_strat]
        return data

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
