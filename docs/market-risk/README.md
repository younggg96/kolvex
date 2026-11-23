# Market Risk Monitor — 开发记录

> 规划与评审见 [technical-review.md](technical-review.md)。目前只有后端数据层（M1a），没有接口和页面，因此未进入 `feature-catalog.md`。

## 当前状态

| 步骤 | 状态 |
| --- | --- |
| M1a 数据层 | 代码与测试完成；迁移未应用；未写入任何数据库 |
| M1b 定时采集 | 代码与测试完成；默认关闭（`MARKET_RISK_WORKER_ENABLED`） |
| M2 评分 / 阶段 / 接口 | 未开始 |
| M3 页面 | 未开始 |

开工时按评审里的建议默认值执行（未经产品确认，如需调整请改这里）：实验开关上线；`v1.0` 评分不含 P/C；不做提醒。

## 数据层（M1a）

代码：`kolvex-backend-py/app/services/market_risk/`

| 文件 | 职责 |
| --- | --- |
| `calendar.py` | NYSE 交易日历（常规假日 + 周末顺延规则 + 1990 年以来的临时休市 + 13:00 提前收盘），美东时间，输出 UTC |
| `metrics.py` | 指标定义（代码即版本）：`vix`、`vvix`、`vix9d`、`vix3m`，派生 `vix9d_vix_ratio`、`vix_vix3m_ratio` |
| `sources.py` | Cboe 每日历史 CSV（主来源）与 FRED CSV（交叉校验）解析；格式变化直接报错 |
| `quality.py` | 校验与对齐：每行进入「接受（valid / suspect）」「跳过（非交易日）」「拒绝（附原因）」之一；缺失交易日只报告、不补值 |
| `repository.py` | 只插入不更新：值不变跳过，供应商修订写成新 `source_revision` |
| `ingest.py` | 编排：采集 → 校验 → FRED 交叉校验 → 计算比值 →（可选）写库并记录 `market_risk_ingestion_runs` |

迁移：`kolvex-backend-py/supabase/migrations/20261123120000_market_risk_foundation.sql`（5 张表，开 RLS，只有 service role 可读写；observations / snapshots / regime events 只授予 insert，不可原地修改）。

回填脚本（默认只读演练，不写库）：

```bash
cd kolvex-backend-py && venv/bin/python scripts/backfill_market_risk.py
```

加 `--write` 才写入（需先应用迁移，使用环境变量中的 service key）。可重复执行。

### 校验规则

| 规则 | 处理 |
| --- | --- |
| 非 NYSE 交易日的行 | 跳过（`non_trading_day`） |
| 日期晚于最近一个已收盘交易日 | 拒绝（`not_final`） |
| 空值 | 拒绝（`null_value`） |
| 超出指标合理区间 | 拒绝（`out_of_range`） |
| 同日多行且数值不同 | 全部拒绝（`conflicting_duplicate`） |
| 单日跳变 >60% 且次日回到原位 | 保留，标 `suspect` / `spike` |
| 与 FRED 同日收盘相差 >0.011 | 保留，标 `suspect` / `mismatch_fred` |
| 比值 | 仅在两边同一交易日都有值时计算；任一输入为 suspect 则比值也为 suspect |

观测时间取 Cboe 指数收盘 16:15 ET（提前收盘日 13:15 ET）。

### 真实数据核对结果（2026-11-23 演练，数据截至 2026-11-20）

- 日历与 Cboe / FRED 1990–2026 的日期逐日一致，差异只有下面两类。
- **Cboe 自 2022 年起在 NYSE 假日也发布 VIX**（全球交易时段计算），另有 2004-06-11。共 34 行，按非交易日跳过。VVIX / VIX9D / VIX3M 没有这种行。
- **两个来源都缺的交易日**：VIX 1991-03-01、1997-01-31、1997-11-26、1999-12-31；VVIX 2013-05-13。不补值。
- **VVIX 2006 年数据不可用**：有 15.71、27.94、36.14 等明显错误值（被区间规则拒绝），2006–2007 年缺 60 多个交易日。回填默认从 2011-01-03 开始（VIX9D 起始日）。
- Cboe 与 FRED：VIX 9,287 天、VIX3M 4,321 天，**0 处不一致**。
- FRED 会断开带自定义 User-Agent 的请求，所以 FRED 请求不带 UA；Cboe CDN 会 307 跳转到 `cdn-api.cboe.com`，需要跟随跳转。

## 定时采集（M1b）

`app/services/market_risk/worker.py`，在 `main.py` 的 lifespan 里启动，**默认关闭**。应用迁移后设 `MARKET_RISK_WORKER_ENABLED=true` 才会运行。

| 规则 | 值 |
| --- | --- |
| 何时采集某个交易日 | 美东 18:30 之后（提前收盘日 15:30），即 Cboe 16:15 收盘后约 2 小时 |
| 检查间隔 | 10 分钟 |
| 每次采集范围 | 目标交易日往前 30 个自然日（捕捉供应商事后修订，写成新 revision） |
| 完成条件 | 四个指标当日都有通过校验的值且无来源错误 → 记 `done`，当天不再跑 |
| 未完成 | 30 分钟后重试，直到下一个交易日接替；缺的值不补，在 ingestion run 里报告 |
| 多副本 | Redis lease（10 分钟），只有一个副本执行 |

每次运行都写一条 `market_risk_ingestion_runs`（状态、各指标计数、拒绝样例、缺失日期、交叉校验结果）。

### 测试

```bash
cd kolvex-backend-py && venv/bin/python -m pytest tests/test_market_risk_data.py tests/test_market_risk_worker.py
```

数据层覆盖：假日与顺延规则、提前收盘与夏令时、格式变化报错、各类拒绝 / 跳过、重复、跳变、交叉校验、比值对齐、修订版本、单个 / 全部来源失败时的状态（不补值）。外部请求全部 mock。worker 覆盖：发布时间与提前收盘、完成后不重复跑、不完整时按间隔重试、来源错误永不算完成、lease 被占时跳过、默认关闭。

## 未完成 / 未验证

- worker 没有在真实 Redis / Supabase 上跑过；上线前先应用迁移、跑一次 `--write` 回填，再打开开关。
- 迁移没有在任何 Supabase 环境执行；`--write` 路径（`repository.py` 的读写）只有纯函数部分有单测，没有对真实数据库跑过。
- Cboe 数据公开展示授权未确认（见评审第 3 节），`license_scope` 统一为 `internal_pending_review`。
- 1990 年以前和未来新增的临时休市需要手动加入 `SPECIAL_CLOSURES`。
