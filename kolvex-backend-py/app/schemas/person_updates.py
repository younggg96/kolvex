"""Validation for manually imported key-person updates."""

import json
import re
from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    AnyHttpUrl,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    TypeAdapter,
    ValidationError,
    field_validator,
)
from pydantic_core import PydanticCustomError


def _validate_text(value: str) -> str:
    if any(ord(char) == 0 or 0xD800 <= ord(char) <= 0xDFFF for char in value):
        raise PydanticCustomError("invalid_text", "Text contains an invalid Unicode character")
    return value


NonEmpty = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1), AfterValidator(_validate_text)
]
ID_PATTERN = r"^[a-z0-9]+(-[a-z0-9]+)*$"
TIMESTAMP = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})")
HTTP_URL = TypeAdapter(AnyHttpUrl)


class PersonUpdate(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", validate_default=True)

    id: Annotated[str, StringConstraints(min_length=1, max_length=128, pattern=ID_PATTERN)]
    person: NonEmpty
    person_cn: NonEmpty
    published_at: str
    title: NonEmpty
    summary: NonEmpty
    source_url: NonEmpty
    impact: Literal["high", "medium", "low"]
    tags: list[NonEmpty] = Field(default_factory=list)
    tickers: list[NonEmpty] = Field(default_factory=list)
    avatar_url: NonEmpty | None = None
    image_url: NonEmpty | None = None
    image_alt: NonEmpty | None = None

    @field_validator("published_at")
    @classmethod
    def validate_time(cls, value: str) -> str:
        if TIMESTAMP.fullmatch(value):
            try:
                # fromisoformat permits normalized offset minutes, so check those separately.
                if value.endswith("Z") or int(value[-2:]) < 60:
                    timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    return timestamp.astimezone(timezone.utc).isoformat()
            except (ValueError, OverflowError):
                pass
        raise PydanticCustomError("zoned_time", "Use a valid ISO 8601 timestamp with a timezone")

    @field_validator("source_url", "avatar_url", "image_url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            url = HTTP_URL.validate_python(value)
        except ValidationError:
            url = None
        if (
            url is None
            or not re.match(r"^https://[^/?#]", value, re.IGNORECASE)
            or not url.host
            or url.username is not None
            or url.password is not None
            or any(char.isspace() or char == "\\" or ord(char) < 32 for char in value)
        ):
            raise PydanticCustomError("https_url", "Use an absolute HTTPS URL without credentials")
        return value

    @field_validator("image_alt")
    @classmethod
    def validate_image_pair(cls, value, info):
        if info.data.get("image_url") and value is None:
            raise PydanticCustomError("missing", "Field required")
        if value is not None and "image_url" in info.data and info.data["image_url"] is None:
            raise PydanticCustomError("image_alt_without_url", "Provide image_url for image_alt")
        return value


class PersonUpdatesImport(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    items: Annotated[list[PersonUpdate], Field(min_length=1, max_length=500)]


def _reject_constant(value: str):
    raise ValueError(value)


def validate_import(body: bytes, chinese: bool) -> tuple[list[dict], list[str]]:
    try:
        document = json.loads(body.decode("utf-8"), parse_constant=_reject_constant)
    except json.JSONDecodeError as exc:
        return [], [
            f"JSON 格式错误（第 {exc.lineno} 行，第 {exc.colno} 列）：{exc.msg}"
            if chinese
            else f"Invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ]
    except (UnicodeDecodeError, ValueError, RecursionError):
        return [], ["JSON 格式错误。" if chinese else "Invalid JSON."]

    try:
        items = PersonUpdatesImport.model_validate(document).model_dump()["items"]
    except ValidationError as exc:
        errors = [_format_error(error, chinese) for error in exc.errors(include_input=False)]
        return [], errors + _duplicates(document, chinese)
    errors = _duplicates(document, chinese)
    return ([] if errors else items), errors


def _duplicates(document, chinese: bool) -> list[str]:
    items = document.get("items") if isinstance(document, dict) else None
    seen = {}
    errors = []
    for row, item in enumerate(items if isinstance(items, list) else [], 1):
        item_id = item.get("id") if isinstance(item, dict) else None
        if not isinstance(item_id, str):
            continue
        if item_id in seen:
            first = seen[item_id]
            errors.append(
                f"第 {row} 条的 id 与第 {first} 条重复"
                if chinese
                else f"Item {row} has the same id as item {first}"
            )
        else:
            seen[item_id] = row
    return errors


def _format_error(error: dict, chinese: bool) -> str:
    path = error["loc"]
    path = tuple(
        part.encode("utf-8", errors="backslashreplace").decode("utf-8")
        if isinstance(part, str)
        else part
        for part in path
    )
    if len(path) >= 2 and path[0] == "items":
        row = path[1] + 1
        field = ".".join(map(str, path[2:]))
        prefix = f"第 {row} 条" if chinese else f"Item {row}"
        if error["type"] == "missing":
            return f"{prefix}缺少 {field}" if chinese else f"{prefix} is missing {field}"
        label = f"{prefix} {field}".rstrip()
    else:
        label = ".".join(map(str, path)) or "JSON"
    if not chinese:
        return f"{label}: {error['msg']}"
    messages = {
        "missing": "必填",
        "model_type": "须为对象",
        "list_type": "须为数组",
        "string_type": "须为字符串",
        "string_too_short": "不能为空",
        "string_too_long": "最多 128 个字符",
        "string_pattern_mismatch": "只允许小写字母、数字和单个分隔连字符",
        "too_short": "至少需要 1 条动态",
        "too_long": "每批最多 500 条",
        "literal_error": "须为 high、medium 或 low",
        "zoned_time": "须为有效的 ISO 8601 时间，并带 Z 或 ±HH:MM 时区",
        "https_url": "须为不含账号密码的绝对 HTTPS URL",
        "image_alt_without_url": "填写图片描述时须同时提供 image_url",
        "extra_forbidden": "未知字段",
        "invalid_text": "含有无法保存的字符",
    }
    return f"{label}：{messages.get(error['type'], error['msg'])}"
