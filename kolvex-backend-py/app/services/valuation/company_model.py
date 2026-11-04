"""Company equity valuation and an explicit FCFF enterprise-to-equity bridge.

Forward parameters are assumptions, never inferred analyst forecasts. Monetary
inputs/outputs use one currency and full precision; shares are an explicit model
denominator, not silently labelled fully diluted shares.
"""
import math

from .eps import finite
from .pe import SCENARIOS, comparison

VERSION = "company-valuation-v1"


def bounded(value, name, minimum=None, maximum=None, *, exclusive_min=False):
    if not finite(value):
        raise ValueError(f"{name}: finite_number_required")
    if minimum is not None and (value < minimum or (exclusive_min and value == minimum)):
        raise ValueError(f"{name}: below_allowed_range")
    if maximum is not None and value > maximum:
        raise ValueError(f"{name}: above_allowed_range")
    return float(value)


def fcff_value(*, revenue, shares, cash, debt, other_claims, tax_rate, years,
               revenue_growth, operating_margin, reinvestment_rate, discount_rate,
               terminal_growth, terminal_roic):
    revenue = bounded(revenue, "revenue", 0, exclusive_min=True)
    shares = bounded(shares, "shares", 0, exclusive_min=True)
    cash, debt, other_claims = [bounded(v, n, 0) for v, n in ((cash, "cash"), (debt, "debt"), (other_claims, "other_claims"))]
    tax_rate = bounded(tax_rate, "tax_rate", 0, 1)
    revenue_growth = bounded(revenue_growth, "revenue_growth", -1, 2, exclusive_min=True)
    operating_margin = bounded(operating_margin, "operating_margin", -1, 1)
    reinvestment_rate = bounded(reinvestment_rate, "reinvestment_rate", 0, 2)
    discount_rate = bounded(discount_rate, "discount_rate", 0, 1, exclusive_min=True)
    terminal_growth = bounded(terminal_growth, "terminal_growth", 0, .05)
    terminal_roic = bounded(terminal_roic, "terminal_roic", 0, 1, exclusive_min=True)
    if isinstance(years, bool) or years not in (5, 10):
        raise ValueError("forecast_years: must_be_5_or_10")
    if discount_rate <= terminal_growth:
        raise ValueError("discount_rate_must_exceed_terminal_growth")
    if terminal_roic <= terminal_growth:
        raise ValueError("terminal_roic_must_exceed_terminal_growth")
    forecast = []
    for year in range(1, years + 1):
        sales = revenue * (1 + revenue_growth)**year
        ebit = sales * operating_margin
        nopat = ebit * (1-tax_rate)
        reinvestment = nopat * reinvestment_rate
        fcff = nopat - reinvestment
        pv = fcff / (1+discount_rate)**year
        if not all(math.isfinite(v) for v in (sales, ebit, nopat, reinvestment, fcff, pv)):
            raise ValueError("calculation_exceeds_finite_range")
        forecast.append({"year": year, "revenue": sales, "ebit": ebit, "nopat": nopat,
                         "reinvestment": reinvestment, "fcff": fcff, "present_value": pv})
    # Stable growth consumes capital. It is not free growth of the last FCFF.
    terminal_nopat = forecast[-1]["revenue"] * (1+terminal_growth) * operating_margin * (1-tax_rate)
    terminal_reinvestment_rate = terminal_growth / terminal_roic
    terminal_fcff = terminal_nopat * (1-terminal_reinvestment_rate)
    if not math.isfinite(terminal_fcff):
        raise ValueError("calculation_exceeds_finite_range")
    if terminal_fcff <= 0:
        return {"status": "not_applicable", "reason": "nonpositive_terminal_cashflow",
                "enterprise_value": None, "equity_value": None, "fair_price": None, "forecast": forecast}
    terminal_value = terminal_fcff / (discount_rate-terminal_growth)
    terminal_pv = terminal_value / (1+discount_rate)**years
    enterprise_value = math.fsum(row["present_value"] for row in forecast) + terminal_pv
    equity_value = enterprise_value + cash - debt - other_claims
    if not all(math.isfinite(v) for v in (enterprise_value, equity_value, terminal_value, terminal_pv)):
        raise ValueError("calculation_exceeds_finite_range")
    return {"status": "complete" if equity_value > 0 else "nonpositive_equity_value",
            "enterprise_value": enterprise_value, "equity_value": equity_value,
            "fair_price": bounded(equity_value / shares, "fair_price", 0, exclusive_min=True) if equity_value > 0 else None,
            "terminal_value": terminal_value, "terminal_present_value": terminal_pv,
            "terminal_fcff": terminal_fcff, "terminal_reinvestment_rate": terminal_reinvestment_rate,
            "terminal_value_share": terminal_pv / enterprise_value if enterprise_value > 0 else None,
            "forecast": forecast,
            "bridge": {"operating_enterprise_value": enterprise_value, "nonoperating_cash": cash,
                       "debt": debt, "other_claims": other_claims, "equity_value": equity_value, "shares": shares}}


def calculate_company(snapshot, command):
    model = command["model"]
    if model not in {"pe", "peg", "dcf"}:
        raise ValueError("unsupported_model")
    scenarios = command["scenarios"]
    if set(scenarios) != set(SCENARIOS):
        raise ValueError("exactly_three_named_scenarios_required")
    overrides = {k: v for k, v in command["inputs"].items() if v is not None}
    inputs = {**snapshot["inputs"], **overrides}
    origins = {key: "user_assumption" if key in overrides else snapshot["origins"].get(key, "unavailable")
               for key in inputs}
    result = {"symbol": snapshot["symbol"], "snapshot_id": snapshot["snapshot_id"], "currency": snapshot["currency"],
              "model": model, "model_version": VERSION, "result_kind": "assumption_based_company_valuation",
              "inputs": inputs, "input_origins": origins, "assumptions": scenarios,
              "price": snapshot.get("price"), "quote_time": snapshot.get("quote_time"),
              "status": "complete", "scenarios": {}, "sensitivity": []}
    if model == "dcf" and snapshot.get("dcf_exclusion"):
        return {**result, "status": "not_applicable", "reason": snapshot["dcf_exclusion"]}
    shares = bounded(inputs.get("shares"), "shares", 0, exclusive_min=True)
    if model in {"pe", "peg"}:
        eps = inputs.get("eps")
        if not finite(eps) or eps <= 0:
            return {**result, "status": "not_applicable", "reason": "positive_eps_required"}
    for name in SCENARIOS:
        assumption = scenarios[name]
        if model in {"pe", "peg"}:
            expected = {"target_pe"} if model == "pe" else {"target_peg", "eps_growth"}
            if set(assumption) != expected:
                raise ValueError("unexpected_scenario_fields")
            if model == "pe":
                multiple = bounded(assumption["target_pe"], "target_pe", 0, 500, exclusive_min=True)
            else:
                peg = bounded(assumption["target_peg"], "target_peg", 0, 10, exclusive_min=True)
                growth = bounded(assumption["eps_growth"], "eps_growth", 0, 2, exclusive_min=True)
                multiple = peg * growth * 100
            fair = bounded(eps * multiple, "fair_price", 0, exclusive_min=True)
            row = {"status": "complete", "fair_price": fair, "equity_value": fair * shares,
                   "enterprise_value": None, "target_pe": multiple}
        else:
            expected = {"revenue_growth", "operating_margin", "reinvestment_rate", "discount_rate"}
            if set(assumption) != expected:
                raise ValueError("unexpected_scenario_fields")
            row = fcff_value(revenue=inputs.get("revenue"), shares=shares, cash=inputs.get("cash"),
                             debt=inputs.get("debt"), other_claims=inputs.get("other_claims"),
                             tax_rate=inputs.get("tax_rate"), years=command["years"],
                             terminal_growth=command["terminal_growth"], terminal_roic=command["terminal_roic"], **assumption)
        if row["fair_price"] is not None and snapshot.get("price") is not None:
            row["comparison"] = comparison(price=snapshot["price"], reference=row["fair_price"])
        else:
            row["comparison"] = None
        if row["equity_value"] is not None and not math.isfinite(row["equity_value"]):
            raise ValueError("calculation_exceeds_finite_range")
        result["scenarios"][name] = row
    values = [result["scenarios"][key]["equity_value"] for key in SCENARIOS]
    if all(v is not None for v in values) and values != sorted(values):
        raise ValueError("scenario_values_cross")
    if model == "dcf":
        base = scenarios["base"]
        for wacc in (base["discount_rate"]-.01, base["discount_rate"], base["discount_rate"]+.01):
            for growth in (command["terminal_growth"]-.005, command["terminal_growth"], command["terminal_growth"]+.005):
                try:
                    cell = fcff_value(revenue=inputs["revenue"], shares=shares, cash=inputs["cash"], debt=inputs["debt"],
                                      other_claims=inputs["other_claims"], tax_rate=inputs["tax_rate"], years=command["years"],
                                      terminal_growth=growth, terminal_roic=command["terminal_roic"],
                                      **{**base, "discount_rate": wacc})
                    fair = cell["fair_price"]
                except ValueError:
                    fair = None
                result["sensitivity"].append({"discount_rate": wacc, "terminal_growth": growth, "fair_price": fair})
    return result
