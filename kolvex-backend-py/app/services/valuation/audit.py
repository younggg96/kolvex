"""Coverage audit, not a valuation service or an approval of source share bases."""
from collections import Counter, defaultdict
from .eps import MODEL_VERSION, finite, iso_date, parse_eps_facts, ttm_candidate


def audit_company(companyfacts, market, *, start, as_of):
    start_date, cutoff = iso_date(start), iso_date(as_of)
    if start_date >= cutoff:
        raise ValueError("Audit start must precede cutoff")
    ledger = parse_eps_facts(companyfacts)
    facts = [f for f in ledger["facts"] if iso_date(f.filed) < cutoff]
    market_rows, rejected_prices, seen = [], 0, set()
    for row in market.get("rows", []):
        session = iso_date(row["date"])
        if not start_date <= session < cutoff:
            continue
        if session in seen:
            raise ValueError("Duplicate market session")
        seen.add(session)
        if not finite(row.get("close")) or row["close"] <= 0:
            rejected_prices += 1
            continue
        market_rows.append(row)
    market_rows.sort(key=lambda r: r["date"])
    statuses, methods = Counter(), Counter()
    events = []
    previous = None
    for row in market_rows:
        candidate = ttm_candidate(facts, row["date"])
        statuses[candidate["status"]] += 1
        if candidate["status"] == "complete":
            methods[candidate["method"]] += 1
        identity = (candidate["status"], candidate["period_end"],
                    tuple(r["id"] for r in candidate["inputs"]))
        if identity != previous:
            events.append({**candidate, "effective_session": row["date"]})
            previous = identity
    latest = ttm_candidate(facts, as_of)
    by_period = defaultdict(list)
    for fact in facts:
        by_period[(fact.start, fact.end)].append(fact)
    changed = [versions for versions in by_period.values() if len({f.value for f in versions}) > 1]
    changed.sort(key=lambda rows: rows[0].end, reverse=True)
    annual_ends = sorted({f.end for f in facts if f.form.startswith("10-K")
                          and 330 <= f.duration <= 385 and start <= f.end < as_of})
    quarter_ends = {f.end for f in facts if 70 <= f.duration <= 120}
    missing_fourth_quarters = [end for end in annual_ends if end not in quarter_ends]
    complete = statuses["complete"]
    total = len(market_rows)
    coverage = complete / total if total else None
    checks = {
        "current_ttm_inputs_complete": latest["status"] == "complete",
        "historical_ttm_candidate_coverage_at_least_90pct": coverage is not None and coverage >= .9,
        "at_least_252_price_sessions": total >= 252,
        "usd_prices": market.get("currency") == "USD",
        "explicit_price_adjustment": market.get("parameters", {}).get("auto_adjust") is False
                                     and market.get("parameters", {}).get("back_adjust") is False,
        # Neither Company Facts nor the price provider proves an EPS share basis.
        "eps_share_basis_verified": False,
    }
    return {
        "model_version": MODEL_VERSION, "as_of": as_of, "start": start,
        "cik": companyfacts["cik"], "name": companyfacts.get("entityName"),
        "readiness": "blocked", "ready_for_pe": all(checks.values()), "checks": checks,
        "eps": {
            "currency": ledger["currency"], "fact_versions": len(facts),
            "reported_quarter_periods": len({(f.start, f.end) for f in facts if 70 <= f.duration <= 120}),
            "reported_annual_periods": len({(f.start, f.end) for f in facts if 330 <= f.duration <= 385}),
            "rejected": ledger["rejected"], "other_units": ledger["other_units"],
            "missing_direct_q4_ends": missing_fourth_quarters,
            "periods_with_value_changes": len(changed),
            "value_change_examples": [[f.public() for f in rows] for rows in changed[:3]],
            "current": latest,
        },
        "history": {
            "first_session": market_rows[0]["date"] if total else None,
            "last_session": market_rows[-1]["date"] if total else None,
            "price_sessions": total, "rejected_price_rows": rejected_prices,
            "candidate_complete_sessions": complete, "candidate_coverage": coverage,
            "statuses": dict(statuses), "complete_methods": dict(methods), "events": events,
        },
        "market": {
            "currency": market.get("currency"), "timezone": market.get("timezone"),
            "parameters": market.get("parameters"), "splits": market.get("splits", []),
            "close_vs_adj_close_differing_sessions": sum(
                finite(r.get("adj_close")) and abs(r["close"] - r["adj_close"]) > .000001
                for r in market_rows),
        },
        "limitations": [
            "TTM completeness is not proof that EPS and price share bases match.",
            "Changed EPS values can reflect splits, amendments or other re-expressions; they are not automatically restatements.",
            "Missing Q4 EPS is not reconstructed by subtracting annual and year-to-date EPS.",
            "Filing dates are date-level: a fact is first eligible on a later observed trading session.",
            "No PE, fair-value curve or trading recommendation is emitted by this audit.",
        ],
    }


def markdown_report(report):
    lines = ["# 股票估值数据核验", "",
             f"截止日期：{report['as_of']}；生成时间：{report['generated_at']}。", "",
             "这是阶段A的真实来源核验，不是估值结果。候选完整率仅表示存在完整的十二个月 EPS 输入，不代表拆股口径已核验。", "",
             "| 股票 | 当前 EPS 输入 | 历史候选完整率 | 缺少直接 Q4 EPS 的年度数 | 行情交易日 | PE 发布条件 |",
             "| --- | --- | --- | --- | --- | --- |"]
    for symbol, row in report["companies"].items():
        if "error" in row:
            lines.append(f"| {symbol} | 来源读取失败 | — | — | — | 未通过 |")
            continue
        coverage = row["history"]["candidate_coverage"]
        percent = f"{coverage:.1%}" if coverage is not None else "无行情"
        lines.append(f"| {symbol} | {row['eps']['current']['status']} | {percent} | "
                     f"{len(row['eps']['missing_direct_q4_ends'])} | {row['history']['price_sessions']} | 未通过 |")
    lines.extend(["", "## 结论与下一步", "",
        "历史候选完整率按审计窗口内实际取得的有效收盘交易日计算；没有取得的交易日不会被统计为成功。未单独核对整个交易所日历，因此该比例也不是行情完整率。", "",
        "1. 为缺失的直接披露 Q4 EPS 补充可追溯来源，例如公司正式年度业绩公告；不以全年 EPS 减前三季累计 EPS 代替。",
        "2. 为采用的财报 EPS 核验拆股展示基准，记录依据；不能仅根据申报日或期间结束日推定股本基准。",
        "3. 通过以上核验后，再生成 PE 参考曲线和当前区间。现有阅读财报接口保持原行为。", "",
        "## 来源与复现", "",
        "完整结果、各交易时点的输入事件、申报链接和来源校验和见同目录 `report.json`。原始响应保存在命令指定的缓存目录，文件按内容哈希命名；离线重放会检查校验和。", "",
        "运行命令和口径见仓库 `docs/stock-valuation/README.md`。", "",
        "- [SEC Company Facts 官方说明](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)",
        "- [yfinance 价格历史参数](https://ranaroussi.github.io/yfinance/reference/yfinance.price_history.html)",
        "- [Yahoo 复权收盘价说明](https://help.yahoo.com/kb/SLN28256.html)", "",
        "未核验行情公开展示权限；本报告仅供内部开发验证。", ""])
    return "\n".join(lines)
