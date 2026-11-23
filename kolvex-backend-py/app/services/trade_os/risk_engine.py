"""
Trade OS Risk Assessment Engine

The authoritative gatekeeper for trading decisions. Pure domain calculation.
Evaluates account drawdown, single trade risk, position notional, portfolio risk budget,
theme concentration, and market regime constraints.
"""

import hashlib
import json
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.services.trade_os.decimal_utils import ZERO, d
from app.services.trade_os.position_sizing import PositionSizingError, calculate_position_size

RULE_VERSION = "1.0.0"


class RiskRuleCheck:
    def __init__(
        self,
        rule: str,
        passed: bool,
        current_value: Any,
        threshold: Any,
        message: str,
        severity: str = "error",  # error | warning
    ):
        self.rule = rule
        self.passed = passed
        self.current_value = current_value
        self.threshold = threshold
        self.message = message
        self.severity = severity

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule": self.rule,
            "passed": self.passed,
            "current_value": str(self.current_value),
            "threshold": str(self.threshold),
            "message": self.message,
            "severity": self.severity,
        }


def assess_trade_plan(
    symbol: str,
    side: str,
    planned_entry: Any,
    planned_stop: Any,
    planned_target: Any,
    planned_quantity: int,
    account_equity: Any,
    risk_config: Dict[str, Any],
    market_regime: str = "risk_on",
    account_risk_state: str = "normal",
    current_positions: Optional[List[Dict[str, Any]]] = None,
    current_drawdown_pct: Any = ZERO,
    daily_pnl: Any = ZERO,
    symbol_theme: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluates a proposed Trade Plan against all risk limits.
    Returns structured decision (approved | blocked | needs_review),
    complete check results, and calculated limit parameters.
    """
    eq = d(account_equity)
    entry = d(planned_entry)
    stop = d(planned_stop)
    target = d(planned_target)
    qty = int(planned_quantity)
    drawdown = d(current_drawdown_pct)
    positions = current_positions or []

    checks: List[RiskRuleCheck] = []
    violations: List[RiskRuleCheck] = []
    warnings: List[RiskRuleCheck] = []

    # Config parameters
    max_risk_pct = d(risk_config.get("max_risk_per_trade_pct", "0.0050"))
    neutral_risk_pct = d(risk_config.get("max_risk_per_trade_neutral_pct", "0.0025"))
    max_pos_pct = d(risk_config.get("max_single_position_pct", "0.1000"))
    max_portfolio_risk_pct = d(risk_config.get("max_portfolio_risk_pct", "0.0200"))
    max_sector_exp_pct = d(risk_config.get("max_sector_exposure_pct", "0.2000"))
    max_sector_risk_pct = d(risk_config.get("max_sector_risk_pct", "0.0100"))
    dd_warning_pct = d(risk_config.get("drawdown_warning_pct", "0.0600"))
    dd_freeze_pct = d(risk_config.get("drawdown_freeze_pct", "0.0800"))
    dd_critical_pct = d(risk_config.get("drawdown_critical_pct", "0.1000"))
    daily_loss_limit_pct = d(risk_config.get("daily_loss_limit_pct", "0.0150"))

    # 1. Account Risk State Lock
    frozen_states = {"new_entries_frozen", "critical_review", "data_lock"}
    state_passed = account_risk_state.lower() not in frozen_states
    chk_state = RiskRuleCheck(
        rule="account_risk_state",
        passed=state_passed,
        current_value=account_risk_state,
        threshold="normal | reduced_risk",
        message="Account is not in a frozen or data lock state"
        if state_passed
        else f"Account is locked ({account_risk_state}). New trade approvals are frozen.",
    )
    checks.append(chk_state)
    if not state_passed:
        violations.append(chk_state)

    # 2. Market Regime Gate
    regime_norm = market_regime.lower()
    regime_passed = True
    regime_msg = "Market regime allows new trade entries."
    effective_risk_pct = max_risk_pct

    if regime_norm == "risk_off":
        regime_passed = False
        regime_msg = "Market regime is Risk Off. All new long entries are prohibited."
    elif regime_norm == "neutral":
        effective_risk_pct = neutral_risk_pct
        regime_msg = "Market regime is Neutral. Risk budget reduced to 0.25%."
    elif regime_norm in ("unknown", "stale_data"):
        regime_passed = False
        regime_msg = f"Market data is unconfirmed or stale ({regime_norm}). Approvals prohibited."

    chk_regime = RiskRuleCheck(
        rule="market_regime",
        passed=regime_passed,
        current_value=regime_norm,
        threshold="risk_on | neutral",
        message=regime_msg,
    )
    checks.append(chk_regime)
    if not regime_passed:
        violations.append(chk_regime)

    # 3. Account Drawdown Gates
    # Drawdown tiers: >=10% Critical Lock, >=8% Freeze, >=6% Caution Warning
    if drawdown >= dd_critical_pct:
        chk_dd = RiskRuleCheck(
            rule="account_drawdown_critical",
            passed=False,
            current_value=f"{drawdown * Decimal(100):.2f}%",
            threshold=f"{dd_critical_pct * Decimal(100):.2f}%",
            message=f"Account drawdown ({drawdown * Decimal(100):.1f}%) reached critical review threshold ({dd_critical_pct * Decimal(100):.1f}%). New approvals locked.",
        )
        checks.append(chk_dd)
        violations.append(chk_dd)
    elif drawdown >= dd_freeze_pct:
        chk_dd = RiskRuleCheck(
            rule="account_drawdown_freeze",
            passed=False,
            current_value=f"{drawdown * Decimal(100):.2f}%",
            threshold=f"{dd_freeze_pct * Decimal(100):.2f}%",
            message=f"Account drawdown ({drawdown * Decimal(100):.1f}%) exceeds freeze threshold.",
        )
        checks.append(chk_dd)
        violations.append(chk_dd)
    elif drawdown >= dd_warning_pct:
        # Cap risk at neutral rate
        effective_risk_pct = min(effective_risk_pct, neutral_risk_pct)
        chk_dd_warn = RiskRuleCheck(
            rule="account_drawdown_warning",
            passed=True,
            current_value=f"{drawdown * Decimal(100):.2f}%",
            threshold=f"{dd_warning_pct * Decimal(100):.2f}%",
            message=f"Account drawdown ({drawdown * Decimal(100):.1f}%) triggered caution mode. Risk per trade reduced.",
            severity="warning",
        )
        checks.append(chk_dd_warn)
        warnings.append(chk_dd_warn)

    # 4. Bracket Geometry Integrity
    geom_passed = True
    geom_msg = "Valid price brackets."
    if side.lower() == "long":
        if stop >= entry:
            geom_passed = False
            geom_msg = f"Stop price (${stop}) must be below entry price (${entry}) for long trades."
        elif target <= entry:
            geom_passed = False
            geom_msg = (
                f"Target price (${target}) must be above entry price (${entry}) for long trades."
            )
    chk_geom = RiskRuleCheck(
        rule="bracket_geometry",
        passed=geom_passed,
        current_value=f"stop: {stop}, entry: {entry}, target: {target}",
        threshold="stop < entry < target",
        message=geom_msg,
    )
    checks.append(chk_geom)
    if not geom_passed:
        violations.append(chk_geom)

    # Compute allowed sizing
    try:
        sizing = calculate_position_size(
            account_equity=eq,
            entry_price=entry,
            stop_price=stop,
            allowed_risk_pct=effective_risk_pct,
            max_position_notional_pct=max_pos_pct,
            side=side,
        )
    except PositionSizingError as pe:
        chk_size = RiskRuleCheck(
            rule="sizing_calculation",
            passed=False,
            current_value=str(pe),
            threshold="valid_sizing",
            message=str(pe),
        )
        checks.append(chk_size)
        violations.append(chk_size)
        sizing = {
            "max_allowed_quantity": 0,
            "risk_per_share": ZERO,
            "planned_risk_amount": ZERO,
            "planned_notional": ZERO,
            "risk_budget": ZERO,
        }

    # 5. Quantity & Single Trade Risk Limit
    risk_per_share = sizing["risk_per_share"]
    this_trade_risk = Decimal(qty) * risk_per_share
    this_trade_notional = Decimal(qty) * entry
    risk_budget = sizing["risk_budget"]

    risk_passed = this_trade_risk <= risk_budget and qty <= sizing["max_allowed_quantity"]
    chk_trade_risk = RiskRuleCheck(
        rule="single_trade_risk",
        passed=risk_passed,
        current_value=f"${this_trade_risk:.2f} ({qty} shs)",
        threshold=f"${risk_budget:.2f} (max {sizing['max_allowed_quantity']} shs)",
        message="Planned trade risk is within the allowed budget."
        if risk_passed
        else f"Planned risk (${this_trade_risk:.2f}) exceeds budget (${risk_budget:.2f}). Maximum allowed is {sizing['max_allowed_quantity']} shares.",
    )
    checks.append(chk_trade_risk)
    if not risk_passed:
        violations.append(chk_trade_risk)

    # 6. Single Stock Exposure Limit (Current + Planned)
    existing_notional_same_symbol = ZERO
    for p in positions:
        if p.get("symbol", "").upper() == symbol.upper() and p.get("status") == "open":
            existing_notional_same_symbol += d(p.get("quantity", ZERO)) * d(
                p.get("average_cost", ZERO)
            )

    total_symbol_notional = existing_notional_same_symbol + this_trade_notional
    max_notional_budget = eq * max_pos_pct
    notional_passed = total_symbol_notional <= max_notional_budget
    chk_notional = RiskRuleCheck(
        rule="single_stock_notional_limit",
        passed=notional_passed,
        current_value=f"${total_symbol_notional:.2f}",
        threshold=f"${max_notional_budget:.2f} ({max_pos_pct * Decimal(100):.1f}% of equity)",
        message="Symbol capital exposure within 10% limit."
        if notional_passed
        else f"Total {symbol} exposure (${total_symbol_notional:.2f}) exceeds maximum capital limit (${max_notional_budget:.2f}).",
    )
    checks.append(chk_notional)
    if not notional_passed:
        violations.append(chk_notional)

    # 6b. Sector / Theme Exposure Limit (if theme provided)
    if symbol_theme:
        norm_theme = symbol_theme.strip().lower()
        existing_theme_notional = ZERO
        existing_theme_risk = ZERO
        for p in positions:
            if p.get("status") == "open" and str(p.get("theme", "")).strip().lower() == norm_theme:
                pos_q = d(p.get("quantity", ZERO))
                pos_c = d(p.get("average_cost", ZERO))
                pos_s = d(p.get("current_stop", ZERO), default=pos_c * Decimal("0.90"))
                existing_theme_notional += pos_q * pos_c
                if pos_c > pos_s:
                    existing_theme_risk += pos_q * (pos_c - pos_s)

        total_theme_notional = existing_theme_notional + this_trade_notional
        theme_limit = eq * max_sector_exp_pct
        theme_notional_passed = total_theme_notional <= theme_limit
        chk_theme_exp = RiskRuleCheck(
            rule="theme_exposure_limit",
            passed=theme_notional_passed,
            current_value=f"${total_theme_notional:.2f}",
            threshold=f"${theme_limit:.2f} ({max_sector_exp_pct * Decimal(100):.1f}% of equity)",
            message=f"Theme/Sector '{symbol_theme}' exposure is within limit."
            if theme_notional_passed
            else f"Theme/Sector '{symbol_theme}' exposure (${total_theme_notional:.2f}) exceeds limit (${theme_limit:.2f}).",
        )
        checks.append(chk_theme_exp)
        if not theme_notional_passed:
            violations.append(chk_theme_exp)

        total_theme_risk = existing_theme_risk + this_trade_risk
        theme_risk_budget = eq * max_sector_risk_pct
        theme_risk_passed = total_theme_risk <= theme_risk_budget
        chk_theme_risk = RiskRuleCheck(
            rule="theme_risk_budget",
            passed=theme_risk_passed,
            current_value=f"${total_theme_risk:.2f}",
            threshold=f"${theme_risk_budget:.2f} ({max_sector_risk_pct * Decimal(100):.1f}% of equity)",
            message=f"Theme/Sector '{symbol_theme}' risk is within budget."
            if theme_risk_passed
            else f"Theme/Sector '{symbol_theme}' risk (${total_theme_risk:.2f}) exceeds limit (${theme_risk_budget:.2f}).",
        )
        checks.append(chk_theme_risk)
        if not theme_risk_passed:
            violations.append(chk_theme_risk)

    # 7. Portfolio Risk Budget Check (Existing Open Risk + This Trade Risk <= 2%)
    existing_portfolio_risk = ZERO
    for p in positions:
        if p.get("status") == "open":
            pos_qty = d(p.get("quantity", ZERO))
            pos_cost = d(p.get("average_cost", ZERO))
            pos_stop = d(
                p.get("current_stop", ZERO), default=pos_cost * Decimal("0.90")
            )  # 10% default if missing
            if pos_cost > pos_stop:
                existing_portfolio_risk += pos_qty * (pos_cost - pos_stop)

    total_portfolio_risk = existing_portfolio_risk + this_trade_risk
    portfolio_risk_budget = eq * max_portfolio_risk_pct
    port_risk_passed = total_portfolio_risk <= portfolio_risk_budget
    chk_port_risk = RiskRuleCheck(
        rule="portfolio_risk_budget",
        passed=port_risk_passed,
        current_value=f"${total_portfolio_risk:.2f}",
        threshold=f"${portfolio_risk_budget:.2f} ({max_portfolio_risk_pct * Decimal(100):.1f}% of equity)",
        message="Total portfolio open risk is within budget."
        if port_risk_passed
        else f"Total portfolio risk (${total_portfolio_risk:.2f}) would exceed maximum 2% limit (${portfolio_risk_budget:.2f}).",
    )
    checks.append(chk_port_risk)
    if not port_risk_passed:
        violations.append(chk_port_risk)

    # 8. Daily Loss Threshold Check
    day_loss = -d(daily_pnl) if d(daily_pnl) < ZERO else ZERO
    day_limit = eq * daily_loss_limit_pct
    day_passed = day_loss < day_limit
    chk_day = RiskRuleCheck(
        rule="daily_loss_limit",
        passed=day_passed,
        current_value=f"${day_loss:.2f}",
        threshold=f"${day_limit:.2f}",
        message="Daily loss is within acceptable limit."
        if day_passed
        else f"Daily account loss (${day_loss:.2f}) triggered daily circuit breaker (${day_limit:.2f}).",
    )
    checks.append(chk_day)
    if not day_passed:
        violations.append(chk_day)

    # Decision Resolution
    if violations:
        decision = "blocked"
    elif warnings:
        decision = "needs_review"
    else:
        decision = "approved"

    # Input hash for deterministic audit
    input_payload = {
        "symbol": symbol,
        "side": side,
        "entry": str(entry),
        "stop": str(stop),
        "target": str(target),
        "quantity": qty,
        "equity": str(eq),
        "regime": regime_norm,
        "state": account_risk_state,
        "rule_version": RULE_VERSION,
    }
    input_hash = hashlib.sha256(
        json.dumps(input_payload, sort_keys=True).encode("utf-8")
    ).hexdigest()

    return {
        "decision": decision,
        "rule_version": RULE_VERSION,
        "checks": [c.to_dict() for c in checks],
        "violations": [v.to_dict() for v in violations],
        "warnings": [w.to_dict() for w in warnings],
        "calculated_limits": {
            "max_allowed_quantity": sizing["max_allowed_quantity"],
            "planned_quantity": qty,
            "risk_per_share": str(risk_per_share),
            "planned_risk_amount": str(this_trade_risk),
            "planned_notional": str(this_trade_notional),
            "allowed_risk_budget": str(risk_budget),
            "current_portfolio_risk": str(existing_portfolio_risk),
            "total_portfolio_risk": str(total_portfolio_risk),
        },
        "input_hash": input_hash,
    }
