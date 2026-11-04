"""PE arithmetic for already verified, price-aligned inputs.

No provider reads, persistence or data-quality approval happen here. Consumers
must enforce the EPS completeness and share-basis checks before publishing a
result. Retain precision here; presentation layers round once for display.
"""
import math

from .eps import finite, iso_date

MODEL_VERSION = "pe-reference-v1"
SCENARIOS = ("conservative", "base", "optimistic")


def positive(value, name):
    if not finite(value) or value <= 0:
        raise ValueError(f"{name} must be finite and positive")
    return value


def comparison(*, price, reference):
    positive(price, "Price")
    positive(reference, "Reference value")
    upside, premium = reference / price - 1, price / reference - 1
    if not math.isfinite(upside) or not math.isfinite(premium):
        raise ValueError("Comparison exceeds finite range")
    return {"price_space": upside, "premium_discount": premium}


def pe_reference(*, eps, multiples, price=None):
    positive(eps, "TTM diluted EPS")
    if set(multiples) != set(SCENARIOS):
        raise ValueError("Exactly three named scenarios are required")
    pe_values = [positive(multiples[key], "Target PE") for key in SCENARIOS]
    if pe_values != sorted(pe_values):
        raise ValueError("Scenario multiples must be ordered")
    if price is not None:
        positive(price, "Price")
    results = {}
    for key, pe in zip(SCENARIOS, pe_values):
        value = positive(eps * pe, "Reference value")
        results[key] = {"eps": eps, "target_pe": pe, "reference_value": value,
                        "comparison": comparison(price=price, reference=value) if price is not None else None}
    return {"model_version": MODEL_VERSION, "eps_basis": "ttm_diluted",
            "result_kind": "model_calculation", "scenarios": results}


def project_pe(*, eps, assumptions, as_of, target_date, price=None):
    """Mechanical annualized EPS growth, with actual days / 365.25."""
    positive(eps, "TTM diluted EPS")
    start, target = iso_date(as_of), iso_date(target_date)
    if target <= start:
        raise ValueError("Target date must follow valuation date")
    if set(assumptions) != set(SCENARIOS):
        raise ValueError("Exactly three named scenarios are required")
    if price is not None:
        positive(price, "Price")
    years = (target - start).days / 365.25
    results = {}
    for key in SCENARIOS:
        growth = assumptions[key]["eps_growth"]
        pe = positive(assumptions[key]["target_pe"], "Target PE")
        if not finite(growth) or growth <= -1:
            raise ValueError("Annualized EPS growth must be finite and greater than -100%")
        try:
            future_eps = positive(eps * math.exp(math.log1p(growth) * years), "Projected EPS")
        except OverflowError as exc:
            raise ValueError("Projected EPS exceeds finite range") from exc
        value = positive(future_eps * pe, "Projected price")
        results[key] = {"eps_growth": growth, "target_pe": pe, "projected_ttm_eps": future_eps,
                        "target_price": value,
                        "price_space": comparison(price=price, reference=value)["price_space"]
                        if price is not None else None}
    values = [results[key]["target_price"] for key in SCENARIOS]
    if values != sorted(values):
        raise ValueError("Projected scenarios cross; revise assumptions instead of relabeling them")
    return {"model_version": MODEL_VERSION, "result_kind": "mechanical_scenario",
            "as_of": as_of, "target_date": target_date, "years": years, "scenarios": results}


def historical_pe_reference(observations, *, as_of, current_pe=None):
    """Calibrate using prior daily PE samples and four distinct financial inputs.

    Observations must contain date, positive PE and a financial_input_id from the
    validated input pipeline. Current/future dates are excluded. No later data
    may be used to reconstruct an earlier observation upstream.
    """
    cutoff = iso_date(as_of)
    try:
        start = cutoff.replace(year=cutoff.year - 5)
    except ValueError:
        start = cutoff.replace(year=cutoff.year - 5, day=28)
    selected, seen = [], set()
    for row in observations:
        day = iso_date(row["date"])
        if not start <= day < cutoff:
            continue
        if day in seen:
            raise ValueError("Duplicate daily PE observation")
        seen.add(day)
        identifier = row.get("financial_input_id")
        if finite(row.get("pe")) and row["pe"] > 0 and isinstance(identifier, str) and identifier.strip():
            selected.append(row)
    distinct_inputs = len({row["financial_input_id"] for row in selected})
    result = {"model_version": MODEL_VERSION, "lookback_start": str(start),
              "cutoff_exclusive": as_of, "sample_count": len(selected),
              "financial_input_count": distinct_inputs, "multiples": None, "percentile": None}
    if len(selected) < 252 or distinct_inputs < 4:
        return {**result, "status": "insufficient_reference_history"}
    values = sorted(row["pe"] for row in selected)

    def quantile(fraction):
        # Linear interpolation (R-7); deterministic across clients and Python versions.
        index = (len(values) - 1) * fraction
        lo, hi = math.floor(index), math.ceil(index)
        return values[lo] + (values[hi] - values[lo]) * (index - lo)

    percentile = None
    if current_pe is not None:
        positive(current_pe, "Current PE")
        percentile = (sum(value < current_pe for value in values)
                      + .5 * sum(value == current_pe for value in values)) / len(values)
    return {**result, "status": "complete", "quantile_method": "linear_r7",
            "first_sample": min(row["date"] for row in selected),
            "last_sample": max(row["date"] for row in selected),
            "multiples": dict(zip(SCENARIOS, (quantile(.25), quantile(.5), quantile(.75)))),
            "percentile": percentile}
