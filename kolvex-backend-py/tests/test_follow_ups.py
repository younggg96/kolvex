from app.agent.follow_ups import FollowUpStream, parse_follow_ups, split_follow_ups


def _stream(chunks: list[str]) -> tuple[str, list[str]]:
    stream = FollowUpStream()
    shown = "".join(stream.feed(chunk) for chunk in chunks) + stream.flush()
    return shown, stream.follow_ups


def test_block_split_across_chunks_never_reaches_the_reader():
    shown, questions = _stream(
        [
            "NVDA 收于 180 美元。\n\n<fol",
            "low_ups>\n- NVDA 的支撑位在哪？\n",
            "- 2. 财报什么时候发布？\n</follow_ups>",
        ]
    )
    assert shown.rstrip() == "NVDA 收于 180 美元。"
    assert questions == ["NVDA 的支撑位在哪？", "财报什么时候发布？"]


def test_text_that_only_looks_like_the_tag_is_released():
    shown, questions = _stream(["a < b and <fo", "o> stays"])
    assert shown == "a < b and <foo> stays"
    assert questions == []
    assert _stream(["ends with <follow"]) == ("ends with <follow", [])


def test_reset_drops_a_tool_planning_turn():
    stream = FollowUpStream()
    stream.feed("<follow_ups>\n- old")
    stream.reset()
    assert stream.feed("answer") == "answer"
    assert stream.follow_ups == []


def test_parse_dedupes_cleans_and_caps():
    block = "\n".join(
        ["- “同一个问题”", "* 同一个问题", "", "x" * 200, *[f"{n}) q{n}" for n in range(6)]]
    )
    assert parse_follow_ups(block) == ["同一个问题", "q0", "q1", "q2", "q3"]


def test_split_without_block_is_unchanged():
    assert split_follow_ups("plain answer") == ("plain answer", [])
    assert split_follow_ups("ans\n<follow_ups>\n- Q?\n</follow_ups>") == ("ans", ["Q?"])


def test_a_leading_figure_is_not_a_list_number():
    assert parse_follow_ups("- 3.5% 的涨幅能持续吗？") == ["3.5% 的涨幅能持续吗？"]
