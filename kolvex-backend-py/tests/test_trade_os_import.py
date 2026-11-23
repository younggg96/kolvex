"""
Unit tests for Robinhood and Manual CSV import parsers
"""

from decimal import Decimal

import pytest

from app.services.trade_os.parsers.manual import (
    ManualTradeValidationError,
    parse_manual_trade,
)
from app.services.trade_os.parsers.robinhood import RobinhoodParseError, parse_robinhood_csv

SAMPLE_ROBINHOOD_CSV = """
"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"
"01/15/2026","01/15/2026","01/16/2026","AAPL","Bought 10 shares of AAPL","Buy","10","$150.00","($1500.00)"
"01/20/2026","01/20/2026","01/21/2026","AAPL","Sold 5 shares of AAPL","Sell","5","$160.00","$800.00"
"01/22/2026","01/22/2026","01/23/2026","MSFT","Bought 5 shares of MSFT","Buy","5","$400.00","($2000.00)"
"01/25/2026","01/25/2026","01/25/2026","","Deposit from Bank","ACH","","","$5000.00"
"01/28/2026","01/28/2026","01/28/2026","AAPL","Cash Dividend","CDIV","","","$25.50"
"02/01/2026","02/01/2026","02/02/2026","NVDA","NVDA $120 Call","BTO","1","$5.00","($500.00)"
"""


def test_parse_robinhood_csv_success():
    res = parse_robinhood_csv(SAMPLE_ROBINHOOD_CSV)
    execs = res["executions"]
    cfs = res["cash_flows"]
    unparsed = res["unparsed_rows"]

    # 3 stock trades + 1 option trade
    assert len(execs) == 4

    # Check AAPL Buy
    aapl_buy = next(e for e in execs if e["symbol"] == "AAPL" and e["side"] == "buy")
    assert aapl_buy["quantity"] == Decimal("10")
    assert aapl_buy["price"] == Decimal("150.00")
    assert aapl_buy["amount"] == Decimal("1500.00")
    assert aapl_buy["source"] == "robinhood_csv"
    assert aapl_buy["source_execution_id"].startswith("rh_")

    # Check AAPL Sell
    aapl_sell = next(e for e in execs if e["symbol"] == "AAPL" and e["side"] == "sell")
    assert aapl_sell["quantity"] == Decimal("5")
    assert aapl_sell["price"] == Decimal("160.00")
    assert aapl_sell["amount"] == Decimal("800.00")

    # Check Cash Flows: 1 deposit, 1 dividend
    assert len(cfs) == 2
    deposit = next(c for c in cfs if c["flow_type"] == "deposit")
    assert deposit["amount"] == Decimal("5000.00")

    dividend = next(c for c in cfs if c["flow_type"] == "dividend")
    assert dividend["amount"] == Decimal("25.50")

    # No unparsed rows in this clean sample
    assert len(unparsed) == 0


def test_parse_robinhood_csv_empty():
    with pytest.raises(RobinhoodParseError):
        parse_robinhood_csv("")

    with pytest.raises(RobinhoodParseError):
        parse_robinhood_csv("Some,Random,Headers\n")


def test_parse_robinhood_csv_unrecognized_row():
    csv_data = """
"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"
"01/15/2026","01/15/2026","01/16/2026","XYZ","Unknown action","UNKNOWN_CODE","10","$10.00","$100.00"
    """
    res = parse_robinhood_csv(csv_data)
    assert len(res["executions"]) == 0
    assert len(res["unparsed_rows"]) == 1
    assert "Unrecognized transaction code" in res["unparsed_rows"][0]["reason"]


def test_parse_manual_trades():
    raw_trade = {
        "symbol": "tsla",
        "side": "buy",
        "quantity": "25",
        "price": "220.50",
        "fees": "1.50",
        "executed_at": "2026-02-10T15:30:00Z",
    }
    parsed = parse_manual_trade(raw_trade)
    assert parsed["symbol"] == "TSLA"
    assert parsed["side"] == "buy"
    assert parsed["quantity"] == Decimal("25")
    assert parsed["price"] == Decimal("220.50")
    assert parsed["fees"] == Decimal("1.50")
    assert parsed["source"] == "manual"
    assert parsed["source_execution_id"].startswith("man_")


def test_parse_manual_trades_validation_errors():
    with pytest.raises(ManualTradeValidationError):
        parse_manual_trade({"symbol": "", "side": "buy", "quantity": "10", "price": "100"})

    with pytest.raises(ManualTradeValidationError):
        parse_manual_trade({"symbol": "AAPL", "side": "hold", "quantity": "10", "price": "100"})

    with pytest.raises(ManualTradeValidationError):
        parse_manual_trade({"symbol": "AAPL", "side": "buy", "quantity": "0", "price": "100"})

    with pytest.raises(ManualTradeValidationError):
        parse_manual_trade({"symbol": "AAPL", "side": "buy", "quantity": "10", "price": "-50"})
