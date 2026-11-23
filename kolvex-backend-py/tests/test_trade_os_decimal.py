"""
Unit tests for Trade OS Decimal utilities
"""

from decimal import Decimal

import pytest

from app.services.trade_os.decimal_utils import (
    ZERO,
    DecimalError,
    d,
    money,
    pct_change,
    price_str,
    quantity_str,
    safe_div,
)


def test_d_valid_conversions():
    assert d(100) == Decimal("100")
    assert d(100.5) == Decimal("100.5")
    assert d("100.50") == Decimal("100.50")
    assert d("$1,234.56") == Decimal("1234.56")
    assert d("($43.64)") == Decimal("-43.64")
    assert d("-150.00") == Decimal("-150.00")
    assert d(Decimal("42.0")) == Decimal("42.0")


def test_d_invalid_conversions():
    with pytest.raises(DecimalError):
        d(None)

    with pytest.raises(DecimalError):
        d("")

    with pytest.raises(DecimalError):
        d("   ")

    with pytest.raises(DecimalError):
        d("invalid_str")

    with pytest.raises(DecimalError):
        d(float("nan"))

    with pytest.raises(DecimalError):
        d(float("inf"))

    with pytest.raises(DecimalError):
        d(float("-inf"))


def test_d_with_default():
    assert d(None, default=ZERO) == ZERO
    assert d("", default=Decimal("10")) == Decimal("10")
    assert d("not_a_num", default=Decimal("5.5")) == Decimal("5.5")


def test_money_formatting():
    assert money("1234.567") == "1234.57"
    assert money("10") == "10.00"
    assert money("-45.5") == "-45.50"
    assert money(ZERO) == "0.00"
    assert money("($15.20)") == "-15.20"


def test_price_str():
    assert price_str("150.25") == "150.2500"
    assert price_str("150.25678") == "150.2568"


def test_quantity_str():
    assert quantity_str("100.000000") == "100"
    assert quantity_str("10.500000") == "10.5"
    assert quantity_str("0.123456") == "0.123456"


def test_safe_div():
    assert safe_div(10, 2) == Decimal("5")
    assert safe_div(10, 0) == ZERO
    assert safe_div(10, 0, default=Decimal("-1")) == Decimal("-1")


def test_pct_change():
    assert pct_change(120, 100) == Decimal("20")
    assert pct_change(80, 100) == Decimal("-20")
    assert pct_change(100, 0) == ZERO
