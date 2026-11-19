import json
from unittest.mock import Mock, patch

import httpx
import pytest

from app.services.x_post_analysis import AnalysisError, analyze_batch, analyze_pending

POST = {
    "id": "2123513385858056311",
    "text": "A joke with an incidental $TSLA tag.",
    "cashtags": ["TSLA"],
    "quoted_texts": [],
}
LABEL = {
    "id": POST["id"],
    "stock_relevance": "low",
    "summary_zh": "作者发了一条带股票标签的玩笑。",
    "summary_en": "The author posts a joke with a stock tag.",
}


def response(rows, finish_reason="stop"):
    return httpx.Response(
        200,
        json={
            "choices": [
                {
                    "finish_reason": finish_reason,
                    "message": {"content": json.dumps({"posts": rows})},
                }
            ]
        },
    )


def test_uses_flash_non_thinking_and_preserves_string_id():
    def send(request):
        assert request.url.host == "api.deepseek.com"
        body = json.loads(request.content)
        assert body["model"] == "deepseek-flash"
        assert body["thinking"] == {"type": "disabled"}
        assert json.loads(body["messages"][1]["content"])[0]["id"] == POST["id"]
        return response([LABEL])

    with httpx.Client(transport=httpx.MockTransport(send)) as client:
        result = analyze_batch(client, [POST])
    assert result[POST["id"]]["stock_relevance"] == "low"
    assert result[POST["id"]]["status"] == "complete"


@pytest.mark.parametrize(
    ("rows", "finish_reason"),
    [
        ([], "stop"),
        ([{**LABEL, "id": int(POST["id"])}], "stop"),
        ([{**LABEL, "stock_relevance": "other"}], "stop"),
        ([{**LABEL, "summary_zh": " "}], "stop"),
        ([LABEL], "length"),
    ],
)
def test_invalid_model_response_is_rejected(rows, finish_reason):
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: response(rows, finish_reason))
    ) as client:
        with pytest.raises(AnalysisError, match="^invalid_model_response$"):
            analyze_batch(client, [POST])


def test_drains_pending_only_and_writes_analysis_without_mutating_source():
    db = Mock()
    table = db.table.return_value
    query = table.select.return_value.eq.return_value.eq.return_value.order.return_value.limit
    query.return_value.execute.side_effect = [Mock(data=[POST]), Mock(data=[])]
    query.return_value.gt.return_value.execute.return_value = Mock(data=[])
    table.update.return_value.eq.return_value.eq.return_value.execute.return_value = Mock(
        data=[{"id": POST["id"]}]
    )
    analysis = {key: value for key, value in LABEL.items() if key != "id"}
    with patch(
        "app.services.x_post_analysis.analyze_batch", return_value={POST["id"]: analysis}
    ) as model:
        result = analyze_pending(db, "test-key")
        again = analyze_pending(db, "test-key")
    assert result["analyzed"] == result["low_relevance"] == 1
    assert again["analyzed"] == 0
    model.assert_called_once()
    table.update.assert_called_once_with({"ai_analysis": analysis})
    table.update.return_value.eq.assert_called_once_with("id", POST["id"])
    table.update.return_value.eq.return_value.eq.assert_called_once_with(
        "ai_analysis->>status", "pending"
    )


def test_provider_failure_keeps_result_pending_without_leaking_details():
    db = Mock()
    table = db.table.return_value
    query = table.select.return_value.eq.return_value.eq.return_value.order.return_value.limit
    query.return_value.execute.return_value = Mock(data=[POST])
    with patch(
        "app.services.x_post_analysis.analyze_batch",
        side_effect=AnalysisError("deepseek_http_429"),
    ):
        result = analyze_pending(db, "test-key")
    assert result["error"] == "deepseek_http_429"
    assert result["analyzed"] == result["low_relevance"] == 0
    table.update.assert_not_called()
