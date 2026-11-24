#!/usr/bin/env python3
"""Historical analysis of the Market Risk model (M4). Read-only; writes a Markdown report.

Reads the public Cboe daily histories (VIX, VVIX, VIX9D, VIX3M and SPX), scores every
session with the current model and compares the result with what the S&P 500 did next.
Also reruns the stage machine with other confirmation lengths to show the trade-off.

    python scripts/backtest_market_risk.py --out ../docs/market-risk/backtest-v1.0.md
"""

import argparse
import asyncio
import sys
from datetime import date, datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import httpx  # noqa: E402

from app.services.market_risk import backtest, engine, ingest, sources  # noqa: E402
from app.services.market_risk.calendar import is_trading_day  # noqa: E402
from app.services.market_risk.service import series_from_observations  # noqa: E402

SINCE = date(2011, 1, 3)
CONFIRM_OPTIONS = (2, 3, 5)
STAGE_ZH = {
    "stable": "平稳",
    "stress_build_up": "压力积累",
    "stress_acceleration": "压力加速",
    "post_stress_normalization": "压力后修复",
}
LEVEL_ZH = {"low": "低", "moderate": "中等", "elevated": "偏高", "high": "高", "extreme": "极高"}


async def load():
    report = await ingest.collect(start=SINCE)
    if report.source_errors:
        raise SystemExit(f"source errors: {report.source_errors}")
    async with httpx.AsyncClient(timeout=sources.TIMEOUT, follow_redirects=True) as client:
        spx = await sources.fetch_cboe_history(client, "SPX")
    closes = {p.trading_date: p.value for p in spx if p.value and is_trading_day(p.trading_date)}
    return series_from_observations(report.observations), closes, report.expected_through


def pct(value, digits=1) -> str:
    if value is None:
        return "—"
    shown = round(value * 100, digits)
    sign = "+" if shown > 0 else "−" if shown < 0 else ""
    return f"{sign}{abs(shown):.{digits}f}%"


def share(value) -> str:
    return "—" if value is None else f"{value * 100:.0f}%"


def group_table(groups: dict, labels: dict, baseline: dict) -> list[str]:
    lines = [
        "| 分组 | 交易日 | 20 日收益均值 | 20 日收益中位数 | 20 日下跌占比 | 20 日内最大回撤均值 | 20 日内回撤 ≥5% 占比 | 60 日收益均值 |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for key, row in [("all", baseline), *groups.items()]:
        if not row.get("n"):
            continue
        name = "全部（基准）" if key == "all" else labels[key]
        lines.append(
            f"| {name} | {row['n']} | {pct(row.get('ret20_mean'))} | {pct(row.get('ret20_median'))} | "
            f"{share(row.get('ret20_negative'))} | {pct(row.get('dd20_mean'))} | "
            f"{share(row.get('dd20_alert'))} | {pct(row.get('ret60_mean'))} |"
        )
    return lines


def render(series, closes, through) -> str:
    runs = {}
    for confirm in CONFIRM_OPTIONS:
        with backtest.override(CONFIRM_SESSIONS=confirm):
            runs[confirm] = backtest.analyse(engine.evaluate(series), closes)
    main = runs[engine.CONFIRM_SESSIONS]
    all_period = main["periods"]["all"]
    out = [
        f"# Market Risk 模型 {engine.MODEL_VERSION} 历史分析（M4）",
        "",
        f"> 由 `kolvex-backend-py/scripts/backtest_market_risk.py` 生成（{datetime.now(timezone.utc):%Y-%m-%d}），"
        f"数据截至 {through}。只用于内部研究，页面不展示命中率。",
        "",
        "## 方法",
        "",
        f"- 输入：Cboe 日终 VIX / VVIX / VIX9D / VIX3M（{SINCE} 起，评分从有 252 日历史后开始），"
        "标普 500 指数（Cboe `SPX`）收盘价。",
        "- 模型没有拟合参数，每天的分位数只用当天以前的数据，所以每个评分日都是样本外。"
        "按 2012–2019（开发期）和 2020 起（验证期）分开统计，看规律是否稳定。",
        "- 前瞻结果从评分当天收盘算起：N 个交易日后的收益，以及这段时间内最低收盘价相对当天的回撤。",
        f"- 「回撤事件」：标普 500 从前高收盘回落 ≥{abs(backtest.EPISODE_DRAWDOWN) * 100:.0f}%。"
        f"「提前出现压力阶段」= 跌破 −10% 当天及之前 {backtest.LEAD_SESSIONS} 个交易日内出现过压力积累或压力加速。",
        "- 基准对照：任意一天往前 21 个交易日的窗口里出现过压力阶段的比例。事件覆盖率要明显高于它才有意义。",
        "",
        "## 结论",
        "",
    ]
    base = all_period["baseline"]
    accel = all_period["by_stage"]["stress_acceleration"]
    stable = all_period["by_stage"]["stable"]
    out += [
        f"1. **评分衡量的是波动和回撤风险，不是方向。** 压力加速阶段之后 20 日收益均值 {pct(accel['ret20_mean'])}，"
        f"高于全样本 {pct(base['ret20_mean'])}；但 20 日内回撤 ≥5% 的比例为 {share(accel['dd20_alert'])}，"
        f"平稳阶段只有 {share(stable['dd20_alert'])}。页面不能把高分写成「看空」或「会下跌」。",
        f"2. **事件覆盖率不能单独作为证据。** {all_period['episodes']} 次 ≥10% 回撤里有 {all_period['episodes_warned']} 次"
        f"在跌破 −10% 前已出现压力阶段，但任意窗口出现压力阶段的基准比例就有 {share(all_period['windows_with_stress'])}。"
        "多数回撤是在下跌已经开始后才进入压力阶段（见事件表的「领先」列），它更像确认而不是预警。",
        f"3. **压力加速的「后续回撤」命中率低。** {all_period['acceleration_entries']} 次进入压力加速，"
        f"之后 20 日内再跌 ≥5% 的有 {all_period['acceleration_followed']} 次。",
        f"4. **阶段切换太频繁。** 每年 {all_period['stage_changes_per_year']:.1f} 次，"
        f"{share(all_period['short_runs'])} 的阶段持续不超过 5 个交易日。确认周期的取舍见下表。",
        "",
        "## 确认周期敏感性",
        "",
        "| 连续确认交易日 | 每年阶段切换 | 阶段持续中位数（交易日） | ≤5 日的阶段占比 | 进入压力加速次数 | 其后 20 日回撤 ≥5% | 回撤事件提前出现压力阶段 | 随机窗口出现压力阶段（基准） |",
        "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for confirm, run in runs.items():
        p = run["periods"]["all"]
        mark = "（当前 v1.0）" if confirm == engine.CONFIRM_SESSIONS else ""
        out.append(
            f"| {confirm}{mark} | {p['stage_changes_per_year']:.1f} | {p['median_run']:g} | {share(p['short_runs'])} | "
            f"{p['acceleration_entries']} | {p['acceleration_followed']} | {p['episodes_warned']}/{p['episodes']} | "
            f"{share(p['windows_with_stress'])} |"
        )
    out += [
        "",
        "确认 3 个交易日把切换次数降约三分之一，回撤事件覆盖不变；确认 5 个交易日切换最少，但漏掉 2 次回撤。"
        "改确认周期要发布新模型版本（`v1.1`），由产品决定；本报告不改 v1.0。",
        "",
    ]
    for name, period in main["periods"].items():
        title = "全部" if name == "all" else name
        out += [
            f"## {title}（{period['first']} – {period['last']}）",
            "",
            "### 按阶段",
            "",
            *group_table(period["by_stage"], STAGE_ZH, period["baseline"]),
            "",
            "### 按评分等级",
            "",
            *group_table(period["by_level"], LEVEL_ZH, period["baseline"]),
            "",
            f"阶段切换每年 {period['stage_changes_per_year']:.1f} 次；回撤事件 {period['episodes_warned']}/{period['episodes']} 提前出现压力阶段，"
            f"基准 {share(period['windows_with_stress'])}。",
            "",
        ]
    out += [
        "## 回撤事件（≥10%）",
        "",
        "| 前高 | 跌破 −10% | 低点 | 最大回撤 | 跌破当天阶段 | 当天评分 | 最早压力阶段 | 领先（交易日） |",
        "| --- | --- | --- | ---: | --- | ---: | --- | ---: |",
    ]
    for ep in main["episodes"]:
        out.append(
            f"| {ep['peak']} | {ep['crossed']} | {ep['trough']}{'（未结束）' if ep.get('open') else ''} | "
            f"{pct(ep['depth'])} | {STAGE_ZH[ep['stage_at_cross']]} | {ep['score_at_cross']:.1f} | "
            f"{ep['first_stress_stage'] or '—'} | {ep['lead_sessions'] if ep['lead_sessions'] is not None else '—'} |"
        )
    out += [
        "",
        f"「领先」以 {backtest.LEAD_SESSIONS} 个交易日为上限：等于 {backtest.LEAD_SESSIONS} 表示窗口开始时已在压力阶段。",
        "",
        "## 局限",
        "",
        "- 2012 年以来只有 7 次 ≥10% 回撤，样本很小，事件彼此不独立。",
        "- 使用的是 Cboe 当前发布的历史数据（含事后修订），不是当时实时可见的版本。",
        "- 只看标普 500 指数，不含股息、交易成本；不是交易策略回测。",
        "- 未包含 P/C、SKEW、GEX 等 v1.0 之外的指标。",
        "",
    ]
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, help="write the Markdown report here")
    args = parser.parse_args()
    series, closes, through = asyncio.run(load())
    text = render(series, closes, through)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
