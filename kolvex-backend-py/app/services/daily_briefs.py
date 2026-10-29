"""Versioned, portfolio-free pre-market/intraday/post-market briefing contract."""
import re
from datetime import date, datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo
from urllib.parse import urlsplit
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Content(BaseModel):
    model_config = ConfigDict(extra="allow", allow_inf_nan=False)


class Image(Content):
    url: str
    caption: str
    credit: str
    source_page: str


class Source(Content):
    name: str
    url: str


class Stat(Content):
    label: str
    value: str | float


class Impact(Content):
    short_term: str = ""
    long_term: str = ""
    price_range: str = ""
    positioning: str = ""


class Item(Content):
    title: str
    summary: str = ""
    kicker: str = ""
    key_stats: list[Stat] = Field(default_factory=list)
    image: Image | None = None
    sources: list[Source] = Field(default_factory=list)
    related_tickers: list[str] = Field(default_factory=list)
    impact: Impact | None = None
    time_pt: str = ""
    detail: str = ""
    checklist: list[str] = Field(default_factory=list)


class Index(Content):
    name: str
    prev_close: float | None = None
    close: float | None = None
    change_pct: float | None = None
    note: str | None = None

    @field_validator("prev_close", "close", "change_pct", mode="before")
    @classmethod
    def formatted_number(cls, value, info):
        if isinstance(value, bool):
            raise ValueError("指数数值不能是布尔值")
        if not isinstance(value, str):
            return value
        text = value.strip()
        if info.field_name == "change_pct" and text.endswith("%"):
            text = text[:-1].strip()
        if not re.fullmatch(r"[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?", text):
            raise ValueError("请输入数值，支持千分位；涨跌幅也支持百分号")
        # Percentages remain percentage points: "-4.48%" becomes -4.48.
        return float(text.replace(",", ""))


class Detail(Content):
    name: str
    detail: str


class Event(Content):
    date_label: str
    title: str
    detail: str


class Section(Content):
    section_id: str = Field(min_length=1)
    order: int
    title: str = Field(min_length=1)
    subtitle: str = ""
    narrative: str | list[str] = ""
    paragraphs: list[str] = Field(default_factory=list)
    indices: list[Index] = Field(default_factory=list)
    movers_up: list[Detail] = Field(default_factory=list)
    movers_down: list[Detail] = Field(default_factory=list)
    commodities: list[Detail] = Field(default_factory=list)
    items: list[Item] = Field(default_factory=list)
    takeaway: str = ""
    strategy_line: str = ""
    events: list[Event] = Field(default_factory=list)


BriefType = Literal["morning", "intraday", "evening"]


class Brief(Content):
    id: str
    type: BriefType
    date: str
    title: str = Field(min_length=1)
    headline: str = Field(min_length=1)
    subtitle: str = ""
    generated_at_pt: str
    market_status: Literal["trading_day", "weekend"]
    hero_image: Image | None = None

    @model_validator(mode="after")
    def identity(self):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", self.date):
            raise ValueError("brief.date 必须为 YYYY-MM-DD")
        date.fromisoformat(self.date)
        if self.id != f"{self.type}-{self.date}":
            raise ValueError("brief.id 必须等于 {type}-{date}")
        stamp = datetime.fromisoformat(self.generated_at_pt.replace("Z", "+00:00"))
        if stamp.utcoffset() is None or stamp.utcoffset() != stamp.astimezone(ZoneInfo("America/Los_Angeles")).utcoffset():
            raise ValueError("generated_at_pt 必须带正确的美西时区偏移")
        return self


class LocalizedBrief(Content):
    title: str = Field(min_length=1)
    headline: str = Field(min_length=1)
    subtitle: str = ""
    sections: list[Section] = Field(min_length=1, max_length=50)
    disclaimer: str = ""
    hero_image: Image | None = None

    @field_validator("sections")
    @classmethod
    def unique_sections(cls, sections):
        if len({s.section_id for s in sections}) != len(sections):
            raise ValueError("section_id 不得重复")
        return sorted(sections, key=lambda s: s.order)

    @model_validator(mode="before")
    @classmethod
    def no_identity_override(cls, value):
        if isinstance(value, dict) and {"brief", "id", "type", "date", "generated_at_pt", "market_status"}.intersection(value):
            raise ValueError("translations 只接受译文内容，不可覆盖期次、日期或 ID")
        return value


class Envelope(Content):
    schema_version: Literal["kolvex-brief/1.0"]
    brief: Brief
    language: Literal["zh", "en"] = "zh"
    translations: dict[Literal["zh", "en"], LocalizedBrief] = Field(default_factory=dict)
    sections: list[Section] = Field(min_length=1, max_length=50)
    disclaimer: str = ""

    @model_validator(mode="after")
    def distinct_languages(self):
        if self.language in self.translations:
            raise ValueError("translations 仅填写另一种语言，原文由 language 标识")
        return self

    @model_validator(mode="before")
    @classmethod
    def safe_content(cls, value: Any):
        def visit(node, path=""):
            if isinstance(node, dict):
                for key, item in node.items():
                    current = f"{path}.{key}"
                    if key in {"holdings", "positions", "accounts", "portfolio", "account_id", "account", "holding", "portfolio_positions", "portfolio_accounts"}:
                        raise ValueError(f"{current}: 日报不接受持仓或账户字段")
                    if key in {"url", "source_page"} and item is not None:
                        parsed = urlsplit(item) if isinstance(item, str) else None
                        if not parsed or parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
                            raise ValueError(f"{current}: 必须是 http(s) URL")
                    visit(item, current)
            elif isinstance(node, list):
                for i, item in enumerate(node):
                    visit(item, f"{path}[{i}]")
        visit(value)
        return value

    @field_validator("sections")
    @classmethod
    def unique_sections(cls, sections):
        if len({s.section_id for s in sections}) != len(sections):
            raise ValueError("section_id 不得重复")
        return sorted(sections, key=lambda s: s.order)


def list_saved_briefs(db, page: int, brief_type: str | None = None, brief_date: str | None = None):
    """Project editorial metadata only; never expose import actor/account fields."""
    query = db.table("daily_briefs").select(
        "id,brief_date,brief_type,title,headline,created_at,summary:payload->brief",
        count="exact",
    )
    if brief_type:
        query = query.eq("brief_type", brief_type)
    if brief_date:
        query = query.eq("brief_date", brief_date)
    result = query.order("brief_date", desc=True).order("id").range(
        (page - 1) * 10, page * 10 - 1
    ).execute()
    return {"items": result.data or [], "total": result.count or 0}


def read_saved_brief(db, brief_id: str):
    result = db.table("daily_briefs").select("payload,revision").eq("id", brief_id).limit(1).execute()
    if not result.data:
        raise LookupError("Brief not found")
    # Revalidate stored documents so legacy formatted numbers and new defaults
    # are handled identically in the admin preview and the reader.
    return {"payload": Envelope.model_validate(result.data[0]["payload"]).model_dump(mode="json"), "revision": str(result.data[0].get("revision", 1))}


def list_brief_calendar(db, month: str):
    """At most three immutable issues per day; query one bounded calendar month."""
    first = date.fromisoformat(f"{month}-01")
    next_month = date(first.year + 1, 1, 1) if first.month == 12 else date(first.year, first.month + 1, 1)
    result = (db.table("daily_briefs").select("brief_date,brief_type")
              .gte("brief_date", first.isoformat()).lt("brief_date", next_month.isoformat())
              .order("brief_date").limit(93).execute())
    days = {}
    for row in result.data or []:
        days.setdefault(row["brief_date"], set()).add(row["brief_type"])
    return {"month": month, "days": [{"date": key, "types": sorted(types)} for key, types in sorted(days.items())]}
