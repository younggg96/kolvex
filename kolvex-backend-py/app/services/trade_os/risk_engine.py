"""
Trade OS Risk Assessment Engine

The authoritative gatekeeper for trading decisions. Pure domain calculation.
Evaluates account drawdown, single trade risk, position notional, portfolio risk budget,
theme concentration, and market regime constraints.
"""

import hashlib
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.services.trade_os.decimal_utils import ZERO, d
from app.services.trade_os.market_regime import normalize_regime, regime_limits
from app.services.trade_os.position_sizing import PositionSizingError, calculate_position_size

RULE_VERSION = "2.0.0"  # Swing V3.0 risk rules (PRD §12)

# PRD §12.5–12.7 defaults
WEEKLY_LOSS_LIMIT = Decimal("0.02")
MONTHLY_LOSS_LIMIT = Decimal("0.05")
CONSECUTIVE_LOSS_LIMIT = 3
LEVEL1_OPEN_RISK_CAP = Decimal("0.0100")
MIN_STOP_DISTANCE = Decimal("0.025")
MAX_STOP_DISTANCE = Decimal("0.10")


def drawdown_level(drawdown: Any, config: Optional[Dict[str, Any]] = None) -> int:
    """PRD §12.4: 0 Normal (<6%), 1 Reduce Risk, 2 Pause New Entries, 3 Circuit Breaker (>=10%)."""
    cfg = config or {}
    dd = d(drawdown)
    if dd >= d(cfg.get("drawdown_critical_pct", "0.1000")):
        return 3
    if dd >= d(cfg.get("drawdown_freeze_pct", "0.0800")):
        return 2
    if dd >= d(cfg.get("drawdown_warning_pct", "0.0600")):
        return 1
    return 0


def compute_period_returns(
    snapshots: List[Dict[str, Any]], now: Optional[datetime] = None
) -> Dict[str, Optional[Decimal]]:
    """
    Equity change since the first snapshot of the current week and month (PRD §12.5–12.6).
    Returns None for a period with fewer than two snapshots. Deposits and withdrawals
    inside the period are not yet netted out.
    """
    now = now or datetime.now(timezone.utc)
    rows = []
    for snap in snapshots:
        raw = snap.get("snapshot_at")
        try:
            at = (
                raw
                if isinstance(raw, datetime)
                else datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            )
        except ValueError:
            continue
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        rows.append((at, d(snap.get("net_liquidation_value", ZERO))))
    rows.sort(key=lambda r: r[0])
    week_start = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def change(start: datetime) -> Optional[Decimal]:
        inside = [v for at, v in rows if at >= start]
        if len(inside) < 2 or inside[0] <= ZERO:
            return None
        return inside[-1] / inside[0] - 1

    return {"week": change(week_start), "month": change(month_start)}


def count_consecutive_losses(closed_trades: List[Dict[str, Any]]) -> int:
    """Net losses in a row, newest first. Not reset by week or month boundaries (PRD §12.7)."""
    ordered = sorted(
        (t for t in closed_trades if t.get("closed_at")),
        key=lambda t: str(t["closed_at"]),
        reverse=True,
    )
    streak = 0
    for t in ordered:
        if d(t.get("realized_pnl", ZERO)) < ZERO:
            streak += 1
        else:
            break
    return streak


class RiskRuleCheck:
    def __init__(
        self,
        rule: str,
        passed: bool,
        current_value: Any,
        threshold: Any,
        message: str,
        severity: str = "error",  # error | warning
        code: Optional[str] = None,
    ):
        self.rule = rule
        self.passed = passed
        self.current_value = current_value
        self.threshold = threshold
        self.message = message
        self.severity = severity
        self.code = code

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule": self.rule,
            "passed": self.passed,
            "current_value": str(self.current_value),
            "threshold": str(self.threshold),
            "message": self.message,
            "severity": self.severity,
            "code": self.code,
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
    available_cash: Any = None,
    period_returns: Optional[Dict[str, Any]] = None,
    consecutive_losses: Optional[int] = None,
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
        code="DRAWDOWN_LIMIT",
    )
    checks.append(chk_state)
    if not state_passed:
        violations.append(chk_state)

    # 2. Market Regime Gate (PRD §6.3)
    regime_norm = normalize_regime(market_regime)
    limits = regime_limits(regime_norm)
    regime_passed = limits["allow_new_entries"]
    effective_risk_pct = max_risk_pct
    max_positions = limits["max_positions"]
    if regime_passed:
        # When the regime blocks entries, report that once instead of also failing every sizing check.
        max_portfolio_risk_pct = min(max_portfolio_risk_pct, limits["max_open_risk_pct"])

    if regime_norm == "risk_off":
        regime_msg = (
            "Market is Risk Off (SPY at or below its 200-day SMA). New long entries are prohibited."
        )
        regime_code = "MARKET_RISK_OFF"
    elif regime_norm == "unknown":
        regime_msg = "Market state is unknown (missing or stale data). New entries are prohibited."
        regime_code = "STALE_MARKET_DATA"
    elif regime_norm == "cautious":
        effective_risk_pct = min(max_risk_pct, neutral_risk_pct)
        regime_msg = "Market is Cautious: 0.25% per trade, up to 2 positions, 0.5% total open risk."
        regime_code = None
    else:
        regime_msg = "Market is Risk On: new long entries allowed."
        regime_code = None

    chk_regime = RiskRuleCheck(
        rule="market_regime",
        passed=regime_passed,
        current_value=regime_norm,
        threshold="risk_on | cautious",
        message=regime_msg,
        code=regime_code,
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
            message=f"Account drawdown ({drawdown * Decimal(100):.1f}%) reached the circuit breaker ({dd_critical_pct * Decimal(100):.1f}%). New entries are locked until a full review.",
            code="DRAWDOWN_LIMIT",
        )
        checks.append(chk_dd)
        violations.append(chk_dd)
    elif drawdown >= dd_freeze_pct:
        chk_dd = RiskRuleCheck(
            rule="account_drawdown_freeze",
            passed=False,
            current_value=f"{drawdown * Decimal(100):.2f}%",
            threshold=f"{dd_freeze_pct * Decimal(100):.2f}%",
            message=f"Account drawdown ({drawdown * Decimal(100):.1f}%) reached {dd_freeze_pct * Decimal(100):.0f}%. New entries are paused.",
            code="DRAWDOWN_LIMIT",
        )
        checks.append(chk_dd)
        violations.append(chk_dd)
    elif drawdown >= dd_warning_pct:
        # Level 1: 0.25% per trade and at most 1% total open risk
        effective_risk_pct = min(effective_risk_pct, neutral_risk_pct)
        max_portfolio_risk_pct = min(max_portfolio_risk_pct, LEVEL1_OPEN_RISK_CAP)
        chk_dd_warn = RiskRuleCheck(
            rule="account_drawdown_warning",
            passed=True,
            current_value=f"{drawdown * Decimal(100):.2f}%",
            threshold=f"{dd_warning_pct * Decimal(100):.2f}%",
            message=f"Account drawdown ({drawdown * Decimal(100):.1f}%) is in Reduce Risk: 0.25% per trade, 1% total open risk.",
            severity="warning",
            code="DRAWDOWN_LIMIT",
        )
        checks.append(chk_dd_warn)
        warnings.append(chk_dd_warn)

    # 3b. Weekly / monthly loss limits and losing streak (PRD §12.5–12.7)
    returns = period_returns or {}
    for key, limit, code, label in (
        ("week", WEEKLY_LOSS_LIMIT, "WEEKLY_LOSS_LIMIT", "this week"),
        ("month", MONTHLY_LOSS_LIMIT, "MONTHLY_LOSS_LIMIT", "this month"),
    ):
        if returns.get(key) is None:
            continue
        ret = d(returns[key])
        passed = ret > -limit
        chk = RiskRuleCheck(
            rule=f"{key}ly_loss_limit",
            passed=passed,
            current_value=f"{ret * Decimal(100):.2f}%",
            threshold=f"-{limit * Decimal(100):.0f}%",
            message=f"Equity change {label} is within the limit."
            if passed
            else f"Equity is down {abs(ret) * Decimal(100):.2f}% {label}. No new entries until the next period.",
            code=code,
        )
        checks.append(chk)
        if not passed:
            violations.append(chk)

    if consecutive_losses is not None:
        passed = consecutive_losses < CONSECUTIVE_LOSS_LIMIT
        chk = RiskRuleCheck(
            rule="consecutive_losses",
            passed=passed,
            current_value=consecutive_losses,
            threshold=f"< {CONSECUTIVE_LOSS_LIMIT}",
            message="Losing streak is within the limit."
            if passed
            else f"{consecutive_losses} losing trades in a row. Review your recent trades before opening a new one.",
            code="CONSECUTIVE_LOSSES",
        )
        checks.append(chk)
        if not passed:
            violations.append(chk)

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
        code="INVALID_STOP",
    )
    checks.append(chk_geom)
    if not geom_passed:
        violations.append(chk_geom)

    # 4b. Stop distance must be 2.5%–10% of entry (PRD §9.2)
    if geom_passed and side.lower() == "long" and entry > ZERO:
        distance = (entry - stop) / entry
        dist_passed = MIN_STOP_DISTANCE <= distance <= MAX_STOP_DISTANCE
        chk_dist = RiskRuleCheck(
            rule="stop_distance",
            passed=dist_passed,
            current_value=f"{distance * Decimal(100):.2f}%",
            threshold="2.5% – 10%",
            message="Stop distance is within 2.5%–10% of entry."
            if dist_passed
            else f"Stop is {distance * Decimal(100):.2f}% below entry; it must be between 2.5% and 10%.",
            code="INVALID_STOP",
        )
        checks.append(chk_dist)
        if not dist_passed:
            violations.append(chk_dist)

    # 4c. Duplicate position and max concurrent positions (PRD §12.2, AC-26)
    open_symbols = {
        str(p.get("symbol", "")).upper() for p in positions if p.get("status") == "open"
    }
    dup_passed = symbol.upper() not in open_symbols
    chk_dup = RiskRuleCheck(
        rule="duplicate_position",
        passed=dup_passed,
        current_value=symbol.upper(),
        threshold="one open position or pending plan per symbol",
        message="No open position or pending plan in this symbol."
        if dup_passed
        else f"{symbol.upper()} already has an open position or approved plan.",
        code="DUPLICATE_POSITION",
    )
    checks.append(chk_dup)
    if not dup_passed:
        violations.append(chk_dup)

    if regime_passed:
        count_passed = len(open_symbols) < max_positions
        chk_count = RiskRuleCheck(
            rule="max_positions",
            passed=count_passed,
            current_value=len(open_symbols),
            threshold=f"< {max_positions} ({regime_norm})",
            message="Open positions are below the limit for this market state."
            if count_passed
            else f"{len(open_symbols)} positions or pending plans already open; {regime_norm} allows {max_positions}.",
            code="TOTAL_OPEN_RISK_LIMIT",
        )
        checks.append(chk_count)
        if not count_passed:
            violations.append(chk_count)

    # Compute allowed sizing
    try:
        sizing = calculate_position_size(
            account_equity=eq,
            entry_price=entry,
            stop_price=stop,
            allowed_risk_pct=effective_risk_pct,
            max_position_notional_pct=max_pos_pct,
            side=side,
            available_cash=available_cash,
            remaining_risk_budget=max(ZERO, eq * max_portfolio_risk_pct - _open_risk(positions)),
        )
    except PositionSizingError as pe:
        chk_size = RiskRuleCheck(
            rule="sizing_calculation",
            passed=False,
            current_value=str(pe),
            threshold="valid_sizing",
            message=str(pe),
            code="INVALID_STOP",
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
        else f"{qty} shares is more than the {sizing['max_allowed_quantity']} allowed (risk budget ${risk_budget:.2f}, limited by {sizing.get('binding_limit', 'risk')}).",
        code="INSUFFICIENT_CASH"
        if sizing.get("binding_limit") == "cash"
        else "TOTAL_OPEN_RISK_LIMIT"
        if sizing.get("binding_limit") == "portfolio_risk"
        else "SINGLE_POSITION_LIMIT",
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
        code="SINGLE_POSITION_LIMIT",
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
            code="SECTOR_EXPOSURE_LIMIT",
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
            code="SECTOR_EXPOSURE_LIMIT",
        )
        checks.append(chk_theme_risk)
        if not theme_risk_passed:
            violations.append(chk_theme_risk)

    # 7. Portfolio Risk Budget Check (open positions + approved plans + this trade)
    existing_portfolio_risk = _open_risk(positions)

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
        else f"Total open risk (${total_portfolio_risk:.2f}) would exceed the {max_portfolio_risk_pct * Decimal(100):.2f}% limit (${portfolio_risk_budget:.2f}).",
        code="TOTAL_OPEN_RISK_LIMIT",
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
        code="DAILY_LOSS_LIMIT",
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
            "portfolio_risk_budget": str(portfolio_risk_budget),
            "binding_limit": sizing.get("binding_limit"),
            "effective_risk_pct": str(effective_risk_pct),
            "max_positions": max_positions,
            "drawdown_level": drawdown_level(drawdown, risk_config),
        },
        "reject_codes": sorted({v.code for v in violations if v.code}),
        "input_hash": input_hash,
    }


def _open_risk(positions: List[Dict[str, Any]]) -> Decimal:
    """Planned stop risk of open positions and approved-but-unfilled plans."""
    total = ZERO
    for p in positions:
        if p.get("status") != "open":
            continue
        qty = d(p.get("quantity", ZERO))
        cost = d(p.get("average_cost", ZERO))
        stop = d(p.get("current_stop", ZERO), default=cost * Decimal("0.90"))
        if cost > stop:
            total += qty * (cost - stop)
    return total
