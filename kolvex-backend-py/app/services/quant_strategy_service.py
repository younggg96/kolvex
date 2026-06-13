"""Quant strategy DSL parsing, indicator evaluation, and Supabase persistence."""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from supabase import Client

from app.core.supabase import get_supabase_service
from app.services.yfinance.client import get_yfinance_service

ALLOWED_ACTIONS = {"buy", "sell", "hold", "reduce", "stop_loss", "take_profit"}
ALLOWED_NAMES = {
    "price",
    "entry_price",
    "sma20",
    "sma50",
    "ema20",
    "ema50",
    "rsi14",
    "atr14",
    "volume",
}


class QuantStrategyStorageNotReady(Exception):
    """Raised when the quant strategy Supabase migration has not been applied."""


def _is_missing_quant_table_error(error: Exception) -> bool:
    message = str(error).lower()
    return (
        "quant_strategies" in message
        or "quant_strategy_assignments" in message
        or "quant_backtests" in message
        or "could not find the table" in message
        or ("relation" in message and "does not exist" in message)
    )


@dataclass(frozen=True)
class Rule:
    condition: str
    action: str


def _round(value: float | None) -> float | None:
    return None if value is None else round(float(value), 6)


class SafeExpressionEvaluator(ast.NodeVisitor):
    """Evaluates a tiny numeric/boolean expression subset for the DSL."""

    def __init__(self, context: Dict[str, float]):
        self.context = context

    def visit_Expression(self, node: ast.Expression) -> Any:
        return self.visit(node.body)

    def visit_Name(self, node: ast.Name) -> float:
        if node.id not in ALLOWED_NAMES:
            raise ValueError(f"Unsupported indicator: {node.id}")
        return float(self.context.get(node.id, 0.0))

    def visit_Constant(self, node: ast.Constant) -> Any:
        if isinstance(node.value, (int, float, bool)):
            return node.value
        raise ValueError("Only numeric constants are allowed")

    def visit_BinOp(self, node: ast.BinOp) -> float:
        left = float(self.visit(node.left))
        right = float(self.visit(node.right))
        operators = {
            ast.Add: lambda: left + right,
            ast.Sub: lambda: left - right,
            ast.Mult: lambda: left * right,
            ast.Div: lambda: left / right if right else 0.0,
        }
        for node_type, operation in operators.items():
            if isinstance(node.op, node_type):
                return operation()
        raise ValueError("Unsupported arithmetic operator")

    def visit_UnaryOp(self, node: ast.UnaryOp) -> Any:
        if isinstance(node.op, ast.Not):
            return not bool(self.visit(node.operand))
        if isinstance(node.op, ast.USub):
            return -float(self.visit(node.operand))
        raise ValueError("Unsupported unary operator")

    def visit_BoolOp(self, node: ast.BoolOp) -> bool:
        values = [bool(self.visit(value)) for value in node.values]
        if isinstance(node.op, ast.And):
            return all(values)
        if isinstance(node.op, ast.Or):
            return any(values)
        raise ValueError("Unsupported boolean operator")

    def visit_Compare(self, node: ast.Compare) -> bool:
        left = self.visit(node.left)
        for operator, comparator in zip(node.ops, node.comparators):
            right = self.visit(comparator)
            comparisons = {
                ast.Lt: left < right,
                ast.LtE: left <= right,
                ast.Gt: left > right,
                ast.GtE: left >= right,
                ast.Eq: left == right,
                ast.NotEq: left != right,
            }
            matched = False
            for node_type, result in comparisons.items():
                if isinstance(operator, node_type):
                    if not result:
                        return False
                    matched = True
                    break
            if not matched:
                raise ValueError("Unsupported comparison operator")
            left = right
        return True

    def generic_visit(self, node: ast.AST) -> Any:
        raise ValueError(f"Unsupported syntax: {type(node).__name__}")


def parse_dsl(dsl: str) -> List[Rule]:
    rules: List[Rule] = []
    for raw_line in dsl.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.fullmatch(r"WHEN\s+(.+?)\s+THEN\s+([a-z_]+)", line, re.I)
        if not match:
            raise ValueError(f"Invalid DSL line: {line}")
        condition, action = match.group(1), match.group(2).lower()
        if action not in ALLOWED_ACTIONS:
            raise ValueError(f"Unsupported action: {action}")
        normalized = re.sub(r"\bAND\b", "and", condition, flags=re.I)
        normalized = re.sub(r"\bOR\b", "or", normalized, flags=re.I)
        tree = ast.parse(normalized, mode="eval")
        SafeExpressionEvaluator({name: 1.0 for name in ALLOWED_NAMES}).visit(tree)
        rules.append(Rule(condition=normalized, action=action))
    if not rules:
        raise ValueError("Strategy DSL must contain at least one rule")
    return rules


def _sma(values: List[float], period: int) -> float | None:
    return sum(values[-period:]) / period if len(values) >= period else None


def _ema(values: List[float], period: int) -> float | None:
    if len(values) < period:
        return None
    multiplier = 2 / (period + 1)
    ema = sum(values[:period]) / period
    for value in values[period:]:
        ema = (value - ema) * multiplier + ema
    return ema


def _rsi(values: List[float], period: int = 14) -> float | None:
    if len(values) <= period:
        return None
    gains: List[float] = []
    losses: List[float] = []
    for previous, current in zip(values[-(period + 1):-1], values[-period:]):
        delta = current - previous
        gains.append(max(delta, 0))
        losses.append(abs(min(delta, 0)))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _atr(candles: List[Dict[str, Any]], period: int = 14) -> float | None:
    if len(candles) <= period:
        return None
    ranges = []
    subset = candles[-(period + 1):]
    for previous, current in zip(subset[:-1], subset[1:]):
        high = float(current.get("high") or 0)
        low = float(current.get("low") or 0)
        previous_close = float(previous.get("close") or 0)
        ranges.append(max(high - low, abs(high - previous_close), abs(low - previous_close)))
    return sum(ranges) / period


def build_indicator_context(candles: List[Dict[str, Any]], entry_price: float) -> Dict[str, float]:
    closes = [float(row["close"]) for row in candles if row.get("close") is not None]
    latest = candles[-1]
    return {
        "price": closes[-1],
        "entry_price": entry_price,
        "sma20": _sma(closes, 20) or 0.0,
        "sma50": _sma(closes, 50) or 0.0,
        "ema20": _ema(closes, 20) or 0.0,
        "ema50": _ema(closes, 50) or 0.0,
        "rsi14": _rsi(closes, 14) or 0.0,
        "atr14": _atr(candles, 14) or 0.0,
        "volume": float(latest.get("volume") or 0.0),
    }


def evaluate_rules(rules: Iterable[Rule], context: Dict[str, float]) -> Dict[str, Any]:
    evaluations = []
    signal = "hold"
    for rule in rules:
        matched = bool(
            SafeExpressionEvaluator(context).visit(ast.parse(rule.condition, mode="eval"))
        )
        evaluations.append(
            {"condition": rule.condition, "action": rule.action, "matched": matched}
        )
        if matched and signal == "hold":
            signal = rule.action
    return {"signal": signal, "rules": evaluations}


class QuantStrategyService:
    def __init__(self, supabase: Optional[Client] = None):
        self.supabase = supabase or get_supabase_service()
        self.market = get_yfinance_service()

    async def list_strategies(self, user_id: str) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table("quant_strategies")
                .select("*")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .execute()
            )
            return response.data or []
        except Exception as error:
            if _is_missing_quant_table_error(error):
                raise QuantStrategyStorageNotReady(
                    "Quant strategy database migration has not been applied."
                ) from error
            raise

    async def create_strategy(self, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        parse_dsl(payload["dsl"])
        row = {"user_id": user_id, **payload}
        try:
            response = self.supabase.table("quant_strategies").insert(row).execute()
            return response.data[0]
        except Exception as error:
            if _is_missing_quant_table_error(error):
                raise QuantStrategyStorageNotReady(
                    "Quant strategy database migration has not been applied."
                ) from error
            raise

    async def update_strategy(
        self, user_id: str, strategy_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        if "dsl" in payload:
            parse_dsl(payload["dsl"])
        try:
            response = (
                self.supabase.table("quant_strategies")
                .update(payload)
                .eq("id", strategy_id)
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as error:
            if _is_missing_quant_table_error(error):
                raise QuantStrategyStorageNotReady(
                    "Quant strategy database migration has not been applied."
                ) from error
            raise
        if not response.data:
            raise ValueError("Strategy not found")
        return response.data[0]

    async def delete_strategy(self, user_id: str, strategy_id: str) -> None:
        self.supabase.table("quant_strategies").delete().eq("id", strategy_id).eq(
            "user_id", user_id
        ).execute()

    async def list_assignments(self, user_id: str) -> List[Dict[str, Any]]:
        try:
            response = (
                self.supabase.table("quant_strategy_assignments")
                .select("*")
                .eq("user_id", user_id)
                .order("symbol")
                .execute()
            )
            return response.data or []
        except Exception as error:
            if _is_missing_quant_table_error(error):
                raise QuantStrategyStorageNotReady(
                    "Quant strategy database migration has not been applied."
                ) from error
            raise

    async def upsert_assignment(
        self, user_id: str, symbol: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        strategy_id = payload.get("strategy_id")
        if strategy_id:
            try:
                strategy = (
                    self.supabase.table("quant_strategies")
                    .select("id")
                    .eq("id", strategy_id)
                    .eq("user_id", user_id)
                    .execute()
                )
            except Exception as error:
                if _is_missing_quant_table_error(error):
                    raise QuantStrategyStorageNotReady(
                        "Quant strategy database migration has not been applied."
                    ) from error
                raise
            if not strategy.data:
                raise ValueError("Strategy not found")
        row = {"user_id": user_id, "symbol": symbol.upper(), **payload}
        try:
            response = (
                self.supabase.table("quant_strategy_assignments")
                .upsert(row, on_conflict="user_id,symbol")
                .execute()
            )
            return response.data[0]
        except Exception as error:
            if _is_missing_quant_table_error(error):
                raise QuantStrategyStorageNotReady(
                    "Quant strategy database migration has not been applied."
                ) from error
            raise

    async def delete_assignment(self, user_id: str, symbol: str) -> None:
        try:
            (
                self.supabase.table("quant_strategy_assignments")
                .delete()
                .eq("user_id", user_id)
                .eq("symbol", symbol.upper())
                .execute()
            )
        except Exception as error:
            if _is_missing_quant_table_error(error):
                raise QuantStrategyStorageNotReady(
                    "Quant strategy database migration has not been applied."
                ) from error
            raise

    async def preview(self, dsl: str, symbol: str, entry_price: float) -> Dict[str, Any]:
        rules = parse_dsl(dsl)
        candles = self.market.get_history(symbol, period="6mo", interval="1d")
        if not candles:
            raise ValueError(f"No market history found for {symbol}")
        context = build_indicator_context(candles, entry_price)
        return {
            "symbol": symbol.upper(),
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
            "indicators": {key: _round(value) for key, value in context.items()},
            **evaluate_rules(rules, context),
        }

    async def backtest(
        self,
        user_id: str,
        strategy_id: str | None,
        dsl: str,
        symbol: str,
        period: str,
        initial_capital: float,
    ) -> Dict[str, Any]:
        rules = parse_dsl(dsl)
        candles = self.market.get_history(symbol, period=period, interval="1d")
        if len(candles) < 55:
            raise ValueError("Backtest needs at least 55 daily candles")

        cash = initial_capital
        shares = 0.0
        entry_price = float(candles[0]["close"])
        equity_curve: List[Dict[str, Any]] = []
        trades: List[Dict[str, Any]] = []

        for index in range(50, len(candles)):
            window = candles[: index + 1]
            price = float(window[-1]["close"])
            context = build_indicator_context(window, entry_price)
            evaluation = evaluate_rules(rules, context)
            signal = evaluation["signal"]

            if signal == "buy" and shares == 0 and cash > 0:
                shares = cash / price
                cash = 0.0
                entry_price = price
                trades.append({"date": window[-1]["date"], "side": "buy", "price": price})
            elif signal in {"sell", "reduce", "stop_loss", "take_profit"} and shares > 0:
                proceeds = shares * price
                pnl = proceeds - shares * entry_price
                cash = proceeds
                shares = 0.0
                trades.append(
                    {
                        "date": window[-1]["date"],
                        "side": "sell",
                        "price": price,
                        "reason": signal,
                        "pnl": _round(pnl),
                    }
                )

            value = cash + shares * price
            equity_curve.append({"date": window[-1]["date"], "value": _round(value)})

        final_capital = cash + shares * float(candles[-1]["close"])
        peaks: List[float] = []
        drawdowns: List[float] = []
        for point in equity_curve:
            value = float(point["value"] or 0)
            peak = max(peaks[-1], value) if peaks else value
            peaks.append(peak)
            drawdowns.append(((peak - value) / peak * 100) if peak else 0.0)
        sell_trades = [trade for trade in trades if trade["side"] == "sell"]
        wins = [trade for trade in sell_trades if float(trade.get("pnl") or 0) > 0]
        result = {
            "strategy_id": strategy_id,
            "symbol": symbol.upper(),
            "period": period,
            "initial_capital": _round(initial_capital),
            "final_capital": _round(final_capital),
            "total_return_pct": _round(((final_capital / initial_capital) - 1) * 100),
            "max_drawdown_pct": _round(max(drawdowns) if drawdowns else 0.0),
            "trades_count": len(trades),
            "win_rate_pct": _round((len(wins) / len(sell_trades) * 100) if sell_trades else 0.0),
            "trades": trades,
            "equity_curve": equity_curve,
        }
        try:
            self.supabase.table("quant_backtests").insert(
                {
                    "user_id": user_id,
                    "strategy_id": strategy_id,
                    "symbol": symbol.upper(),
                    "period": period,
                    "initial_capital": result["initial_capital"],
                    "final_capital": result["final_capital"],
                    "total_return_pct": result["total_return_pct"],
                    "max_drawdown_pct": result["max_drawdown_pct"],
                    "trades_count": result["trades_count"],
                    "win_rate_pct": result["win_rate_pct"],
                    "result": result,
                }
            ).execute()
        except Exception as error:
            if _is_missing_quant_table_error(error):
                raise QuantStrategyStorageNotReady(
                    "Quant strategy database migration has not been applied."
                ) from error
            raise
        return result


def get_quant_strategy_service() -> QuantStrategyService:
    return QuantStrategyService()
