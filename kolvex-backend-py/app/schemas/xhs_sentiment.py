"""Validation for the manually imported daily Xiaohongshu sentiment digest (xhs-daily.v2)."""

import json
import re
from datetime import date, datetime, timezone
from typing import Annotated, Literal
from urllib.parse import parse_qs, urlsplit

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    field_validator,
    model_validator,
)
from pydantic_core import PydanticCustomError

from app.schemas.person_updates import TIMESTAMP, _reject_constant, _validate_text

SCHEMA_VERSION = "xhs-daily.v2"
STANCES = ("fear_panic", "bearish", "neutral", "mixed_cautious_buy", "bullish")
ID_PATTERN = r"^[a-z0-9]+(-[a-z0-9]+)*$"
NOTE_ID_PATTERN = r"^[0-9A-Za-z]{1,64}$"
TICKER_PATTERN = r"^[A-Z][A-Z0-9.\-]{0,9}$"
XHS_HOSTS = {"www.xiaohongshu.com", "xiaohongshu.com", "xhslink.com"}


def _text(max_length: int):
    return Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length),
        AfterValidator(_validate_text),
    ]


Text40 = _text(40)
Text60 = _text(60)
Text100 = _text(100)
Text200 = _text(200)
Text300 = _text(300)
Ticker = Annotated[str, StringConstraints(pattern=TICKER_PATTERN)]
Count = Annotated[int, Field(ge=0)]
Stance = Literal["fear_panic", "bearish", "neutral", "mixed_cautious_buy", "bullish"]


def _zoned(value: str) -> str:
    if TIMESTAMP.fullmatch(value) and (value.endswith("Z") or int(value[-2:]) < 60):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
        except (ValueError, OverflowError):
            pass
    raise PydanticCustomError("zoned_time", "Use a valid ISO 8601 timestamp with a timezone")


class Strict(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class Counts(Strict):
    fear_panic: Count
    bearish: Count
    neutral: Count
    mixed_cautious_buy: Count
    bullish: Count

    def total(self) -> int:
        return sum(getattr(self, stance) for stance in STANCES)


class Sample(Strict):
    keywords: Annotated[list[Text40], Field(min_length=1, max_length=20)]
    posts_scanned: Count
    posts_by_keyword: dict[Text40, Count] | None = None
    deep_read_posts: Count | None = None
    comments_read: Count | None = None
    classified_by: Literal["title", "body"]
    latest_window_hours: Annotated[int, Field(ge=1, le=168)] | None = None


class Sentiment(Strict):
    all: Counts
    latest: Counts | None = None
    comments: Counts | None = None


class Source(Strict):
    note_id: Annotated[str, StringConstraints(pattern=NOTE_ID_PATTERN)]
    url: str
    title: Text200
    author_nickname: Text60 | None = None
    published_at: str | None = None
    published_raw: Text40 | None = None
    comments: Count | None = None

    @field_validator("published_at")
    @classmethod
    def validate_time(cls, value: str | None) -> str | None:
        return None if value is None else _zoned(value)

    @model_validator(mode="after")
    def validate_url(self):
        parts = urlsplit(self.url)
        if (
            parts.scheme != "https"
            or (parts.hostname or "").lower() not in XHS_HOSTS
            or parts.username is not None
            or parts.password is not None
            or any(char.isspace() or char == "\\" or ord(char) < 32 for char in self.url)
        ):
            raise PydanticCustomError("xhs_url", "Use an HTTPS xiaohongshu.com or xhslink.com URL")
        if parts.hostname != "xhslink.com" and self.note_id not in parts.path:
            raise PydanticCustomError("note_url", "The URL path must contain note_id")
        # Xiaohongshu refuses note pages opened without xsec_token (error 300031),
        # so a link without one can never be opened by a reader.
        if parts.hostname != "xhslink.com" and not any(
            token.strip() for token in parse_qs(parts.query).get("xsec_token", [])
        ):
            raise PydanticCustomError("xsec_token", "xiaohongshu.com URLs must include xsec_token")
        return self


class Excerpt(Strict):
    text: Text60
    likes: Count | None


class Heat(Strict):
    posts: Count
    comments: Count | None = None


class Topic(Strict):
    id: Annotated[str, StringConstraints(min_length=1, max_length=64, pattern=ID_PATTERN)]
    title: Text40
    summary: Text200
    stance: Stance
    tickers: Annotated[list[Ticker], Field(max_length=10)] = Field(default_factory=list)
    heat: Heat
    excerpts: Annotated[list[Excerpt], Field(max_length=5)] = Field(default_factory=list)
    sources: Annotated[list[Source], Field(min_length=1, max_length=5)]


class Rumor(Strict):
    text: Text100
    status: Literal["unverified", "debunked"]
    tickers: Annotated[list[Ticker], Field(max_length=10)] = Field(default_factory=list)
    sources: Annotated[list[Source], Field(max_length=3)] = Field(default_factory=list)


class DailyDigest(Strict):
    schema_version: Literal["xhs-daily.v2"]
    date_pt: str
    captured_at: str
    sample: Sample
    sentiment: Sentiment
    topics: Annotated[list[Topic], Field(min_length=1, max_length=20)]
    rumors: Annotated[list[Rumor], Field(max_length=20)] = Field(default_factory=list)
    limitations: Annotated[list[Text300], Field(max_length=20)] = Field(default_factory=list)

    @field_validator("date_pt")
    @classmethod
    def validate_date(cls, value: str) -> str:
        try:
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                return date.fromisoformat(value).isoformat()
        except ValueError:
            pass
        raise PydanticCustomError("date", "Use YYYY-MM-DD")

    @field_validator("captured_at")
    @classmethod
    def validate_captured(cls, value: str) -> str:
        return _zoned(value)

    @model_validator(mode="after")
    def cross_checks(self):
        if self.sample.posts_scanned != self.sentiment.all.total():
            raise PydanticCustomError(
                "scan_total", "sample.posts_scanned must equal the sum of sentiment.all"
            )
        if self.sentiment.latest is not None:
            if self.sample.latest_window_hours is None:
                raise PydanticCustomError(
                    "latest_window", "sentiment.latest needs sample.latest_window_hours"
                )
            if self.sentiment.latest.total() > self.sentiment.all.total():
                raise PydanticCustomError(
                    "latest_total", "sentiment.latest cannot exceed sentiment.all"
                )
        seen = set()
        for topic in self.topics:
            if topic.id in seen:
                raise PydanticCustomError("duplicate_topic", "Topic ids must be unique")
            seen.add(topic.id)
        return self


MAX_DAYS = 31


def _parse(body: bytes, chinese: bool):
    """Return (document, None) or (None, [error])."""
    try:
        return json.loads(body.decode("utf-8"), parse_constant=_reject_constant), None
    except json.JSONDecodeError as exc:
        return None, [
            f"JSON 格式错误（第 {exc.lineno} 行，第 {exc.colno} 列）：{exc.msg}"
            if chinese
            else f"Invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ]
    except (UnicodeDecodeError, ValueError, RecursionError):
        return None, ["JSON 格式错误。" if chinese else "Invalid JSON."]


def _check_day(document, today_pt: date, chinese: bool) -> tuple[dict | None, list[str]]:
    try:
        digest = DailyDigest.model_validate(document)
    except ValidationError as exc:
        return None, [_format_error(error, chinese) for error in exc.errors(include_input=False)]

    if date.fromisoformat(digest.date_pt) > today_pt:
        return None, [
            "date_pt：不能晚于太平洋时间今天" if chinese else "date_pt: cannot be after today (PT)"
        ]

    result = digest.model_dump(mode="json")
    result["topics"].sort(
        key=lambda topic: (topic["heat"]["posts"], topic["heat"]["comments"] or 0), reverse=True
    )
    result["captured_at"] = (
        datetime.fromisoformat(result["captured_at"]).astimezone(timezone.utc).isoformat()
    )
    return result, []


def validate_digest(body: bytes, today_pt: date, chinese: bool) -> tuple[dict | None, list[str]]:
    """Parse and validate one day's digest. Topics come back sorted by heat."""
    document, errors = _parse(body, chinese)
    if errors:
        return None, errors
    return _check_day(document, today_pt, chinese)


def validate_batch(
    body: bytes, today_pt: date, chinese: bool
) -> tuple[list[dict] | None, list[str]]:
    """
    One day as an object, or up to MAX_DAYS days as an array. Every day must pass,
    and no date may repeat; otherwise nothing is returned. Days come back newest first.
    """
    document, errors = _parse(body, chinese)
    if errors:
        return None, errors
    if isinstance(document, dict):
        day, errors = _check_day(document, today_pt, chinese)
        return ([day] if day else None), errors
    if not isinstance(document, list) or not 1 <= len(document) <= MAX_DAYS:
        return None, [
            f"顶层须为一天的对象，或包含 1–{MAX_DAYS} 天的数组"
            if chinese
            else f"Top level must be one day's object or an array of 1–{MAX_DAYS} days"
        ]

    days, errors, seen = [], [], {}
    for index, item in enumerate(document, 1):
        raw_date = item.get("date_pt") if isinstance(item, dict) else None
        label = (
            f"第 {index} 天" + (f"（{raw_date}）" if isinstance(raw_date, str) else "")
            if chinese
            else f"Day {index}" + (f" ({raw_date})" if isinstance(raw_date, str) else "")
        )
        day, day_errors = _check_day(item, today_pt, chinese)
        errors.extend(f"{label} {error}" for error in day_errors)
        if day is None:
            continue
        if day["date_pt"] in seen:
            errors.append(
                f"{label} 与第 {seen[day['date_pt']]} 天日期重复"
                if chinese
                else f"{label} repeats the date of day {seen[day['date_pt']]}"
            )
            continue
        seen[day["date_pt"]] = index
        days.append(day)
    if errors:
        return None, errors
    days.sort(key=lambda day: day["date_pt"], reverse=True)
    return days, []


MESSAGES_ZH = {
    "missing": "必填",
    "model_type": "须为对象",
    "dict_type": "须为对象",
    "list_type": "须为数组",
    "string_type": "须为字符串",
    "int_type": "须为整数",
    "greater_than_equal": "不能为负数或小于下限",
    "less_than_equal": "超过上限",
    "string_too_short": "不能为空",
    "string_too_long": "超过长度上限",
    "string_pattern_mismatch": "格式不正确",
    "too_short": "数量不足",
    "too_long": "数量超过上限",
    "literal_error": "取值不在允许范围内",
    "extra_forbidden": "未知字段（如分数、占比、评论人昵称或属地，都不接受）",
    "zoned_time": "须为带时区的 ISO 8601 时间",
    "date": "须为 YYYY-MM-DD",
    "xhs_url": "须为 xiaohongshu.com 或 xhslink.com 的 HTTPS 链接",
    "note_url": "链接路径须包含 note_id",
    "xsec_token": "xiaohongshu.com 链接须带 xsec_token（从搜索结果点进帖子，复制地址栏完整链接），否则读者打不开",
    "scan_total": "sample.posts_scanned 须等于 sentiment.all 各项之和",
    "latest_window": "提供 sentiment.latest 时须填写 sample.latest_window_hours",
    "latest_total": "sentiment.latest 总数不能超过 sentiment.all",
    "duplicate_topic": "话题 id 不能重复",
    "invalid_text": "含有无法保存的字符",
}


def _format_error(error: dict, chinese: bool) -> str:
    parts = []
    for part in error["loc"]:
        if isinstance(part, int):
            parts.append(f"[{part + 1}]")
        else:
            part = str(part).encode("utf-8", errors="backslashreplace").decode("utf-8")
            parts.append(("." if parts else "") + part)
    label = "".join(parts) or "JSON"
    if not chinese:
        return f"{label}: {error['msg']}"
    return f"{label}：{MESSAGES_ZH.get(error['type'], error['msg'])}"
