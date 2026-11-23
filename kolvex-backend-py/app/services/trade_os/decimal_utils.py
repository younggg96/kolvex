"""
Trade OS Decimal Utilities
Provides safe, high-precision Decimal arithmetic, quantization, and validation.
Strictly disallows non-finite values (NaN, Infinity).
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Optional

ZERO = Decimal("0")
ONE = Decimal("1")
HUNDRED = Decimal("100")

MONEY_EXPONENT = Decimal("0.01")
PRICE_EXPONENT = Decimal("0.000001")
QUANTITY_EXPONENT = Decimal("0.000001")
PCT_EXPONENT = Decimal("0.0001")


class DecimalError(ValueError):
    """Raised when an invalid decimal conversion or arithmetic operation occurs."""

    pass


def d(value: Any, default: Optional[Decimal] = None) -> Decimal:
    """
    Safely convert a value to Decimal.
    Rejects NaN, Infinity, -Infinity.
    """
    if value is None:
        if default is not None:
            return default
        raise DecimalError("Value cannot be None")

    if isinstance(value, Decimal):
        if not value.is_finite():
            raise DecimalError(f"Non-finite decimal: {value}")
        return value

    try:
        # Strip common formatting like commas or currency symbols if present as string
        if isinstance(value, str):
            clean_str = value.strip().replace(",", "").replace("$", "").replace("¥", "")
            # Handle parenthesized negative: ($43.64) -> -43.64
            if clean_str.startswith("(") and clean_str.endswith(")"):
                clean_str = "-" + clean_str[1:-1].strip()
            if not clean_str:
                if default is not None:
                    return default
                raise DecimalError("Empty string cannot be converted to Decimal")
            result = Decimal(clean_str)
        else:
            result = Decimal(str(value))

        if not result.is_finite():
            raise DecimalError(f"Non-finite decimal: {value}")
        return result
    except Exception as e:
        if default is not None:
            return default
        raise DecimalError(f"Invalid decimal value: {value!r}") from e


def quantize_money(value: Any, precision: int = 2) -> Decimal:
    """Quantize to standard money exponent (2 decimal places)."""
    exponent = Decimal("0." + "0" * (precision - 1) + "1") if precision > 0 else Decimal("1")
    return d(value).quantize(exponent, rounding=ROUND_HALF_UP)


def money(value: Any, precision: int = 2) -> str:
    """Format decimal value as currency string (e.g. 123.45)."""
    exponent = Decimal("0." + "0" * (precision - 1) + "1") if precision > 0 else Decimal("1")
    return str(d(value).quantize(exponent, rounding=ROUND_HALF_UP))


def price_str(value: Any, precision: int = 4) -> str:
    """Format stock / unit price with up to specified precision."""
    exponent = Decimal("0." + "0" * (precision - 1) + "1")
    return str(d(value).quantize(exponent, rounding=ROUND_HALF_UP))


def quantity_str(value: Any, precision: int = 6) -> str:
    """Format share quantity, preserving fractional parts."""
    exponent = Decimal("0." + "0" * (precision - 1) + "1")
    quantized = d(value).quantize(exponent, rounding=ROUND_HALF_UP)
    # Strip trailing zeroes after decimal point if whole number
    normalized = quantized.normalize()
    if normalized == normalized.to_integral():
        return str(normalized.quantize(Decimal("1")))
    return str(quantized).rstrip("0").rstrip(".")


def safe_div(
    numerator: Any,
    denominator: Any,
    default: Decimal = ZERO,
    rounding: str = ROUND_HALF_UP,
) -> Decimal:
    """Safe division returning default if denominator is zero."""
    num = d(numerator)
    den = d(denominator)
    if den == ZERO:
        return default
    return num / den


def pct_change(current: Any, base: Any) -> Decimal:
    """Compute percentage change ((current - base) / base * 100)."""
    cur = d(current)
    bs = d(base)
    if bs == ZERO:
        return ZERO
    return (cur - bs) / bs * HUNDRED
