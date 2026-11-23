from decimal import Decimal

from app.services.trade_os.analytics_service import compute_account_analytics
from app.services.trade_os.journal_service import generate_structured_ai_review


def test_generate_structured_ai_review_planned_winner():
    review = generate_structured_ai_review(
        symbol="NVDA",
        realized_pnl=Decimal("850.00"),
        planned=True,
        planned_entry=Decimal("130.00"),
        planned_stop=Decimal("123.50"),
        planned_target=Decimal("143.00"),
        realized_r=Decimal("2.10"),
        mistake_tags=[],
    )
    assert "Execution Fidelity" in review
    assert "+2.10R" in review
    assert "Maintain current plan-first discipline" in review


def test_generate_structured_ai_review_outside_plan_loser():
    review = generate_structured_ai_review(
        symbol="TSLA",
        realized_pnl=Decimal("-450.00"),
        planned=False,
        realized_r=None,
        mistake_tags=["fomo"],
    )
    assert "Outside Plan" in review
    assert "FOMO" in review


def test_compute_account_analytics_empty():
    res = compute_account_analytics([])
    assert res["total_closed_trades"] == 0
    assert res["win_rate_pct"] == 0.0
    assert res["profit_factor"] == 1.0


def test_compute_account_analytics_with_trades():
    journal_items = [
        # Planned winner: +$600, +2.0R
        {
            "status": "closed",
            "planned": True,
            "realized_pnl": "600.00",
            "realized_r": 2.0,
            "review": {"mistake_tags": []},
        },
        # Planned loser: -$300, -1.0R
        {
            "status": "closed",
            "planned": True,
            "realized_pnl": "-300.00",
            "realized_r": -1.0,
            "review": {"mistake_tags": ["early_exit"]},
        },
        # Outside plan loser: -$150, no R
        {
            "status": "closed",
            "planned": False,
            "realized_pnl": "-150.00",
            "realized_r": None,
            "review": {"mistake_tags": ["fomo"]},
        },
        # Open trade (should not count towards closed metrics)
        {
            "status": "open",
            "planned": True,
            "realized_pnl": "0.00",
            "realized_r": None,
        },
    ]

    res = compute_account_analytics(journal_items)
    assert res["total_closed_trades"] == 3
    assert res["outside_plan_count"] == 1
    # 2 out of 3 planned -> 66.67%
    assert res["plan_coverage_pct"] == 66.67
    # 1 win out of 3 -> 33.33%
    assert res["win_rate_pct"] == 33.33
    # Gross profit: 600, Gross loss: 450 -> 600/450 = 1.33
    assert res["profit_factor"] == 1.33
    # Expectancy R: (2.0 + -1.0) / 2 = 0.50
    assert res["expectancy_r"] == 0.50
    assert res["r_distribution"]["win_2_to_3r"] == 1
    assert res["r_distribution"]["loss_0_to_1r"] == 1
    assert res["mistake_tag_counts"]["early_exit"] == 1
    assert res["mistake_tag_counts"]["fomo"] == 1
