"""Builds the HTML for scheduled emails: daily digest (brief, creator views, options activity,
AI research) and 13F holdings changes. Email clients ignore stylesheets, so every style is inline
and the layout is table-based."""
import html
import os
import re
from datetime import date, datetime, timedelta, timezone

LOGO_BASE = "https://financialmodelingprep.com/image-stock"
GREEN, RED, AMBER, GREY = "#15803d", "#b91c1c", "#b45309", "#57534e"
INK, MUTED, LINE, PAGE = "#111827", "#6b7280", "#e5e7eb", "#f3f6f4"

SECTION_DEFAULTS = {
    "daily_brief": [
        {"id": "brief", "title": "今日日报"},
        {"id": "kol", "title": "博主观点"},
        {"id": "options", "title": "期权异动"},
        {"id": "research", "title": "AI 研究"},
    ],
    "holdings_change": [{"id": "holdings", "title": "机构 13F 持仓更新"}],
}


EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
SEND_MODES = ("approval", "auto")
AUDIENCES = ("subscribers", "all", "custom")


def default_content(kind: str) -> dict:
    return {"hero_image_url": "", "intro": "",
            "sections": [{**s, "enabled": True, "note": ""} for s in SECTION_DEFAULTS[kind]],
            "delivery": {"mode": "approval", "audience": "subscribers", "emails": []}}


def merge_delivery(stored) -> dict:
    """How the email goes out: approval or automatic, and to whom."""
    stored = stored if isinstance(stored, dict) else {}
    mode = stored.get("mode") if stored.get("mode") in SEND_MODES else "approval"
    audience = stored.get("audience") if stored.get("audience") in AUDIENCES else "subscribers"
    raw = stored.get("emails") if isinstance(stored.get("emails"), list) else []
    emails = list(dict.fromkeys(str(x).strip().lower() for x in raw if str(x).strip()))
    return {"mode": mode, "audience": audience, "emails": emails}


def merge_content(kind: str, stored: dict | None) -> dict:
    """Stored overrides on top of the defaults; section order and ids always come from the defaults."""
    stored = stored or {}
    base = default_content(kind)
    saved = {s.get("id"): s for s in stored.get("sections") or [] if isinstance(s, dict)}
    sections = []
    for section in base["sections"]:
        override = saved.get(section["id"], {})
        merged = {
            "id": section["id"],
            "enabled": bool(override.get("enabled", True)),
            "title": str(override.get("title") or section["title"]).strip()[:60],
            "note": str(override.get("note") or "").strip()[:300],
        }
        if section["id"] == "kol":
            # Chosen creators in the admin's order; empty means every creator who posted recently.
            chosen = override.get("creators") if isinstance(override.get("creators"), list) else []
            merged["creators"] = list(dict.fromkeys(str(c).strip()[:100] for c in chosen if str(c).strip()))[:20]
        sections.append(merged)
    return {"hero_image_url": str(stored.get("hero_image_url") or "").strip(),
            "intro": str(stored.get("intro") or "").strip(), "sections": sections,
            "delivery": merge_delivery(stored.get("delivery"))}


def validate_content(kind: str, content) -> dict:
    if not isinstance(content, dict):
        raise ValueError("邮件内容格式不正确")
    merged = merge_content(kind, content)
    url = merged["hero_image_url"]
    if url and not re.fullmatch(r"https://\S{4,1000}", url):
        raise ValueError("头图需要是 https:// 开头的图片地址")
    if len(merged["intro"]) > 2000:
        raise ValueError("导语不能超过 2000 字")
    delivery = merged["delivery"]
    bad = [x for x in delivery["emails"] if not EMAIL_RE.fullmatch(x)]
    if bad:
        raise ValueError(f"邮箱格式不正确：{bad[0]}")
    if len(delivery["emails"]) > 500:
        raise ValueError("指定邮箱最多 500 个")
    if delivery["audience"] == "custom" and not delivery["emails"]:
        raise ValueError("请填写至少一个指定邮箱")
    return merged


# ---------- small HTML helpers ----------

def e(value) -> str:
    return html.escape(str(value or ""))


def clip(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def site() -> str:
    return os.getenv("FRONTEND_URL", "https://kolvex.app").rstrip("/")


def pill(label: str, color: str) -> str:
    return (f'<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;'
            f'font-weight:600;line-height:18px;color:{color};background:{color}14;border:1px solid {color}33">{e(label)}</span>')


def logo(ticker: str, size: int = 32) -> str:
    key = re.sub(r"\.", "-", ticker or "")
    if not key or re.search(r"[\^=/\s]", key):
        return ""
    return (f'<img src="{LOGO_BASE}/{e(key)}.png" width="{size}" height="{size}" alt="" '
            f'style="display:block;width:{size}px;height:{size}px;border-radius:{size // 2}px;background:#ffffff;border:1px solid {LINE}">')


def button(label: str, href: str) -> str:
    return (f'<a href="{e(href)}" style="display:inline-block;margin-top:12px;padding:10px 18px;border-radius:999px;'
            f'background:{GREEN};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">{e(label)}</a>')


def stock_row(ticker: str, badge: str, meta: str, body: str, href: str) -> str:
    return f"""
<tr><td style="padding:12px 0;border-top:1px solid {LINE}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="44" valign="top">{logo(ticker)}</td>
    <td valign="top">
      <div style="font-size:15px;font-weight:700;color:{INK}"><a href="{e(href)}" style="color:{INK};text-decoration:none">{e(ticker)}</a>&nbsp; {badge}</div>
      {f'<div style="margin-top:2px;font-size:12px;color:{MUTED}">{meta}</div>' if meta else ''}
      <div style="margin-top:6px;font-size:14px;line-height:22px;color:#374151">{body}</div>
    </td>
  </tr></table>
</td></tr>"""


def section_block(title: str, note: str, inner: str) -> str:
    note_html = f'<p style="margin:4px 0 0;font-size:13px;line-height:20px;color:{MUTED}">{e(note)}</p>' if note else ""
    return f"""
<tr><td style="padding:28px 28px 4px">
  <h2 style="margin:0;font-size:18px;line-height:26px;color:{INK}">{e(title)}</h2>{note_html}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">{inner}</table>
</td></tr>"""


SENTIMENT = {"bullish": ("看多", GREEN), "bearish": ("看空", RED), "neutral": ("中性", GREY), "mixed": ("分歧", AMBER)}
DECISION = {"BUY": ("买入", GREEN), "SELL": ("卖出", RED), "HOLD": ("持有", GREY)}


def money(value) -> str:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return ""
    for unit, size in (("B", 1e9), ("M", 1e6), ("K", 1e3)):
        if abs(n) >= size:
            return f"${n / size:.1f}{unit}"
    return f"${n:.0f}"


# ---------- data ----------

def fetch_brief(db, today: date):
    rows = (db.table("daily_briefs").select("id,brief_date,title,headline,payload")
            .eq("brief_date", today.isoformat()).order("created_at", desc=True).limit(1).execute().data)
    return rows[0] if rows else None


KOL_FIELDS = ("channel_id,channel_title,channel_avatar_url,channel_url,video_id,video_title,video_url,"
              "video_published_at,ticker,sentiment,summary")


def list_creators(db) -> list[dict]:
    """Creators that have opinions, most recently active first, for the admin picker."""
    rows = (db.table("youtube_stock_opinions").select("channel_id,channel_title,channel_avatar_url,video_published_at")
            .order("video_published_at", desc=True).limit(3000).execute().data or [])
    seen, creators = set(), []
    for row in rows:
        if row.get("channel_id") and row["channel_id"] not in seen:
            seen.add(row["channel_id"])
            creators.append({"channel_id": row["channel_id"], "channel_title": row.get("channel_title") or row["channel_id"],
                             "avatar_url": row.get("channel_avatar_url"), "last_video_at": row.get("video_published_at")})
    return creators


def fetch_kol(db, now: datetime, creators: list[str], limit: int = 6, per_creator: int = 4):
    """Each creator's latest video in the window with the stocks it covers.
    Chosen creators get a 7-day window; with none chosen, everyone from the last 48 hours."""
    since = (now - timedelta(days=7 if creators else 2)).isoformat()
    query = db.table("youtube_stock_opinions").select(KOL_FIELDS).gte("video_published_at", since)
    if creators:
        query = query.in_("channel_id", creators)
    rows = query.order("video_published_at", desc=True).limit(500).execute().data or []
    groups: dict[str, dict] = {}
    for row in rows:
        group = groups.setdefault(row["channel_id"], {**row, "stocks": []})
        # Only the creator's newest video; rows arrive newest first.
        if row["video_id"] == group["video_id"] and row.get("ticker") and len(group["stocks"]) < per_creator:
            group["stocks"].append(row)
    picked = [g for g in groups.values() if g["stocks"] or g.get("summary")]
    if creators:
        picked.sort(key=lambda g: creators.index(g["channel_id"]))
    return picked[:limit]


def fetch_options(db):
    rows = (db.table("options_activity_runs").select("trade_date,session,summary")
            .eq("status", "ok").order("run_at", desc=True).limit(1).execute().data)
    return rows[0] if rows and rows[0].get("summary") else None


def fetch_research(db, now: datetime, limit: int = 4):
    since = (now - timedelta(days=7)).isoformat()
    rows = (db.table("stock_analysis_versions").select("ticker,created_at,payload")
            .eq("kind", "research").gte("created_at", since)
            .order("created_at", desc=True).limit(40).execute().data or [])
    seen, picked = set(), []
    for row in rows:
        payload = row.get("payload") or {}
        if payload.get("status") != "completed" or row["ticker"] in seen:
            continue
        seen.add(row["ticker"])
        picked.append(row)
    return picked[:limit]


def fetch_holdings(db, today: date, since: str | None):
    query = db.table("institution_13f_filings").select("manager_name,period,filed").eq("complete", True)
    query = query.gte("synced_at", since) if since else query.gte("filed", today.replace(day=1).isoformat())
    return query.order("filed", desc=True).limit(50).execute().data or []


# ---------- sections ----------

def brief_html(brief) -> str:
    payload = brief.get("payload") or {}
    parts = [f'<tr><td style="padding-top:4px"><div style="font-size:16px;font-weight:700;line-height:24px;color:{INK}">{e(brief["title"])}</div>'
             f'<p style="margin:6px 0 0;font-size:14px;line-height:22px;color:#374151">{e(brief["headline"])}</p></td></tr>']
    for section in (payload.get("sections") or [])[:4]:
        narrative = section.get("narrative")
        text = " ".join(narrative) if isinstance(narrative, list) else (narrative or "")
        text = text or " ".join(section.get("paragraphs") or []) or section.get("takeaway") or ""
        items = [i.get("title") for i in (section.get("items") or [])[:3] if isinstance(i, dict) and i.get("title")]
        bullets = "".join(f'<li style="margin:2px 0">{e(clip(t, 80))}</li>' for t in items)
        parts.append(
            f'<tr><td style="padding:12px 0 0;border-top:1px solid {LINE};margin-top:12px">'
            f'<div style="font-size:14px;font-weight:700;color:{INK}">{e(section.get("title"))}</div>'
            + (f'<p style="margin:4px 0 0;font-size:14px;line-height:22px;color:#374151">{e(clip(text, 220))}</p>' if text else "")
            + (f'<ul style="margin:6px 0 0;padding-left:18px;font-size:14px;line-height:22px;color:#374151">{bullets}</ul>' if bullets else "")
            + "</td></tr>")
    read_url = f"{site()}/dashboard/briefs/{brief['id']}"
    parts.append(f'<tr><td>{button("阅读完整日报", read_url)}</td></tr>')
    return "".join(parts)


def avatar(url: str | None, name: str) -> str:
    if url and url.startswith("https://"):
        return (f'<img src="{e(url)}" width="36" height="36" alt="" referrerpolicy="no-referrer" '
                f'style="display:block;width:36px;height:36px;border-radius:18px;border:1px solid {LINE}">')
    initial = e((name or "?")[:1])
    return (f'<div style="width:36px;height:36px;border-radius:18px;background:{GREEN}1a;color:{GREEN};'
            f'font-size:15px;font-weight:700;line-height:36px;text-align:center">{initial}</div>')


def kol_html(groups) -> str:
    out = []
    for group in groups:
        video = e(clip(group.get("video_title"), 60))
        if group.get("video_url"):
            video = f'<a href="{e(group["video_url"])}" style="color:{MUTED}">{video}</a>'
        stocks = ""
        for row in group["stocks"]:
            label, color = SENTIMENT.get(row.get("sentiment"), SENTIMENT["neutral"])
            stocks += (f'<tr><td width="28" valign="top" style="padding:8px 0 0">{logo(row["ticker"], 22)}</td>'
                       f'<td valign="top" style="padding:8px 0 0 6px;font-size:14px;line-height:21px;color:#374151">'
                       f'<a href="{site()}/dashboard/market/{e(row["ticker"])}" style="color:{INK};font-weight:700;text-decoration:none">{e(row["ticker"])}</a>'
                       f'&nbsp; {pill(label, color)}<br>{e(clip(row.get("summary"), 120))}</td></tr>')
        out.append(f"""
<tr><td style="padding:14px 0;border-top:1px solid {LINE}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="46" valign="top">{avatar(group.get("channel_avatar_url"), group.get("channel_title"))}</td>
    <td valign="top">
      <div style="font-size:15px;font-weight:700;color:{INK}">{e(group.get("channel_title"))}</div>
      <div style="margin-top:2px;font-size:12px;line-height:18px;color:{MUTED}">{video} · {e(str(group.get("video_published_at") or "")[:10])}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{stocks}</table>
    </td>
  </tr></table>
</td></tr>""")
    out.append(f'<tr><td>{button("查看全部博主观点", f"{site()}/dashboard/youtube-opinions")}</td></tr>')
    return "".join(out)


def options_html(run) -> str:
    summary = run["summary"]
    label, color = SENTIMENT.get(summary.get("sentiment"), SENTIMENT["mixed"])
    points = "".join(f'<li style="margin:4px 0">{e(clip(p, 200))}</li>' for p in (summary.get("points_zh") or [])[:3])
    out = [f'<tr><td style="padding-bottom:8px"><div style="font-size:13px;color:{MUTED}">{e(run["trade_date"])} · 整体 {pill(label, color)}</div>'
           f'<ul style="margin:8px 0 0;padding-left:18px;font-size:14px;line-height:22px;color:#374151">{points}</ul></td></tr>']
    for item in ((summary.get("candidates") or {}).get("items") or [])[:4]:
        is_call = item.get("type") == "call"
        badge = pill(f'{"Call" if is_call else "Put"} {item.get("strike", "")}', GREEN if is_call else RED)
        meta = f'{e(item.get("expiration"))} 到期 · 成交 {money(item.get("premium"))}'
        out.append(stock_row(item.get("underlying", ""), badge, meta, e(clip(item.get("thesis_zh"), 160)),
                             f"{site()}/dashboard/market/{item.get('underlying', '')}"))
    out.append(f'<tr><td>{button("查看期权异动", f"{site()}/dashboard/options-activity")}</td></tr>')
    return "".join(out)


def research_summary(payload: dict) -> str:
    text = ((payload.get("translations") or {}).get("zh") or {}).get("full_signal") or payload.get("full_signal") or ""
    for block in re.split(r"\n\s*\n", text):
        line = re.sub(r"[#*_>`-]+", " ", block).strip()
        # Skip headings and rulers; keep the first real paragraph.
        if len(line) > 30 and not block.lstrip().startswith("#"):
            return clip(line, 180)
    return clip(re.sub(r"[#*_>`]+", " ", text), 180)


def research_html(rows) -> str:
    out = []
    for row in rows:
        payload = row.get("payload") or {}
        decision = str(payload.get("final_decision") or "").upper()
        label, color = DECISION.get(decision, (decision or "研究", GREY))
        out.append(stock_row(row["ticker"], pill(label, color), e(str(row["created_at"])[:10]),
                             e(research_summary(payload)), f"{site()}/dashboard/market/{row['ticker']}"))
    return "".join(out)


def holdings_html(rows) -> str:
    return "".join(
        f'<tr><td style="padding:10px 0;border-top:1px solid {LINE};font-size:14px;line-height:22px;color:#374151">'
        f'<b style="color:{INK}">{e(r["manager_name"])}</b><br><span style="color:{MUTED};font-size:13px">报告期 {e(r["period"])} · 提交 {e(r["filed"])}</span></td></tr>'
        for r in rows) + f'<tr><td>{button("查看机构持仓", f"{site()}/dashboard/superinvestors")}</td></tr>'


# ---------- page ----------

def page(content: dict, today: date, blocks: list[str]) -> str:
    hero = content["hero_image_url"]
    hero_html = (f'<tr><td><img src="{e(hero)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>'
                 if hero else "")
    intro = "".join(f'<p style="margin:0 0 10px;font-size:15px;line-height:24px;color:#374151">{e(p)}</p>'
                    for p in content["intro"].split("\n") if p.strip())
    intro_html = f'<tr><td style="padding:20px 28px 0">{intro}</td></tr>' if intro else ""
    return f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:{PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAGE}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid {LINE}">
<tr><td style="padding:20px 28px;border-bottom:1px solid {LINE}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:20px;font-weight:800;color:{GREEN};letter-spacing:-0.01em">Kolvex</td>
    <td align="right" style="font-size:13px;color:{MUTED}">{today.isoformat()}</td>
  </tr></table>
</td></tr>
{hero_html}{intro_html}{"".join(blocks)}
<tr><td style="padding:28px;font-size:12px;line-height:18px;color:{MUTED};border-top:1px solid {LINE}">
  以上内容仅供研究参考，不构成投资建议。<br>
  <a href="{site()}/dashboard/settings" style="color:{MUTED}">管理邮件通知</a>
</td></tr>
</table></td></tr></table></body></html>"""


def build(db, kind: str, content: dict, template: str, today: date, since: str | None = None):
    """Returns (subject, html) or None when no enabled section has anything to show."""
    now = datetime.now(timezone.utc)
    blocks, title = [], ""
    for section in content["sections"]:
        if not section["enabled"]:
            continue
        inner = ""
        if section["id"] == "brief" and (brief := fetch_brief(db, today)):
            title, inner = brief["title"], brief_html(brief)
        elif section["id"] == "kol" and (rows := fetch_kol(db, now, section.get("creators") or [])):
            inner = kol_html(rows)
        elif section["id"] == "options" and (run := fetch_options(db)):
            inner = options_html(run)
        elif section["id"] == "research" and (rows := fetch_research(db, now)):
            inner = research_html(rows)
        elif section["id"] == "holdings" and (rows := fetch_holdings(db, today, since)):
            inner = holdings_html(rows)
        if inner:
            blocks.append(section_block(section["title"], section["note"], inner))
    if not blocks:
        return None
    fallback = "Kolvex 每日精选" if kind == "daily_brief" else "机构持仓更新"
    default_template = "[Kolvex] {title}" if kind == "daily_brief" else "[Kolvex] 机构持仓更新 {date}"
    try:
        subject = (template or default_template).format(title=title or fallback, date=today.isoformat())
    except (KeyError, IndexError, ValueError):
        subject = f"[Kolvex] {title or fallback}"
    return subject, page(content, today, blocks)
