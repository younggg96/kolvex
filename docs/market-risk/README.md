# Market Risk Monitor — 开发记录

> 规划与评审见 [technical-review.md](technical-review.md)，历史分析见 [backtest-v1.0.md](backtest-v1.0.md)。功能总表行：`marketRisk`（实验性）。

## 当前状态

| 步骤 | 状态 |
| --- | --- |
| M1a 数据层 | 代码与测试完成；迁移未应用；未写入任何数据库 |
| M1b 定时采集 | 代码与测试完成；默认关闭（`MARKET_RISK_WORKER_ENABLED`） |
| M2 评分 / 阶段 / 接口 | 代码与测试完成；worker 在当日数据齐全后写入快照 |
| M3 页面 | `/dashboard/market-risk` 完成（实验开关，侧边栏「资金动向」组，Beta） |
| M4 历史分析 | 完成，报告见 [backtest-v1.0.md](backtest-v1.0.md)；未改模型 |

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
cd kolvex-backend-py && venv/bin/python -m pytest tests/test_market_risk_data.py tests/test_market_risk_worker.py tests/test_market_risk_engine.py tests/test_market_risk_backtest.py
cd kolvex-frontend-web-nextjs && node --test scripts/market-risk.test.cjs
```

数据层覆盖：假日与顺延规则、提前收盘与夏令时、格式变化报错、各类拒绝 / 跳过、重复、跳变、交叉校验、比值对齐、修订版本、单个 / 全部来源失败时的状态（不补值）。外部请求全部 mock。worker 覆盖：发布时间与提前收盘、完成后不重复跑、不完整时按间隔重试、来源错误永不算完成、lease 被占时跳过、默认关闭。

## 评分与阶段（M2，模型 `v1.0`）

代码：`engine.py`（纯函数、确定性）、`service.py`（接口数据）、`app/api/routes/market_risk.py`。改动 `engine.py` 中任何常量都必须升 `MODEL_VERSION`。

**评分**：每个指标与自身**之前** 756 个交易日（至少 252 个）比较得到分位数（当天不进自己的样本，无前视），加权平均为 0–100。

| 指标 | 维度 | 权重 |
| --- | --- | --- |
| VIX | 波动率水平 | 25 / 70 |
| VVIX | 波动率的波动 | 20 / 70 |
| VIX / VIX3M | 期限结构 | 15 / 70 |
| VIX9D / VIX | 期限结构 | 10 / 70 |

PRD 的 Options Activity（20%）和 Tail Risk（10%）在 v1.0 没有数据，按 PRD 比例在剩余 70 上归一化，不悄悄挪权重。四个关键指标任一缺失 → 当天不评分，页面显示最近一个已评分交易日并提示「数据不全，未评分」。等级：<40 低、<60 中等、<75 偏高、<90 高、≥90 极高。

**阶段**（PRD 留空的数字在这里定，均为待回测的初始值）：

| 规则 | 值 |
| --- | --- |
| 压力积累 | 评分 ≥ 60 进入；跌破 55 才回平稳（滞后区间） |
| 压力加速 | 评分 ≥ 75 且至少 2 个压力条件（VIX>28、VVIX>110、VIX9D/VIX>1、VIX/VIX3M>1）；维持需 ≥70 且条件仍 ≥2 |
| 压力后修复 | 前序为积累或加速；评分比近 20 个交易日高点低 ≥15，且至少 2 个修复条件（VVIX<110、VIX/VIX3M<1、VIX9D/VIX<1） |
| 修复结束 | 评分 <60 且修复条件 ≥2 → 平稳；评分 ≥75，或修复条件不足且 ≥60 → 压力积累 |
| 确认 | 每次切换连续 2 个已评分交易日；修复 → 平稳需 5 个 |
| 缺数据 | 保留最后确认的阶段，确认计数清零 |

**检查清单**：RISK-001~003、RECOVERY-001~004 按收盘自动判定，连续 2 天成立为「触发」，1 天为「待确认」；RISK-004（P/C）显示「未启用」；V2 的 GEX 规则不显示。

**指标状态**（只用于展示，不进评分）：VIX 20 / 28 / 35；VVIX 100 / 110 / 120；比值 0.95 / 1.00 / 1.10。评分是相对分位数、状态是绝对区间，两者可能不一致（页面 ⓘ 有说明）。

**真实数据演练（2011–2026，评分从 2012 年起；2026-11-23）**：2020-03 全月为压力加速（评分 98–99）；2026-11-23 评分 94.3、压力加速。约每年 21 次阶段切换，偏频繁，见 M4。

### 接口

| 接口 | 说明 |
| --- | --- |
| `GET /api/v1/market-risk/latest` | 最新已评分日：评分与构成、阶段与条件、6 个指标、检查清单、最近 8 次阶段变化、数据新鲜度（日终 / 延迟 / 已过期） |
| `GET /api/v1/market-risk/history?range=1M\|3M\|6M\|1Y\|3Y\|MAX` | 每日评分、阶段、VIX / VIX9D / VIX3M，以及区间内阶段变化 |

都要求登录（Cboe 公开展示授权未确认）。读不到数据返回 503 `unavailable`；没有任何已评分日返回 503 `no_score`；页面显示失败，不用替代数值。结果在进程内缓存 15 分钟。Web 走 `app/api/market-risk/[...path]` 代理。

**本地开发**：迁移应用前可设 `MARKET_RISK_DATA_SOURCE=live`，接口直接读 Cboe 公开 CSV 计算（同一校验流程），页面会显示「直接读取 Cboe」。生产保持默认 `database`。

**快照**：worker 在当日四个指标齐全后，用库中全部历史重新评分，向 `market_risk_snapshots` 插入当日快照（`inputs_hash` 相同则跳过，不同则 `snapshot_revision + 1`），同时写 `market_risk_signals` 与当日的 `market_risk_regime_events`。

## 页面（M3）

`/dashboard/market-risk`：数据状态 → 评分卡（构成条）+ 阶段卡（压力条件）→ 四个阶段 → 期限结构图（今天 vs 上一交易日）+ 指标表 → 升级 / 修复检查 → 历史图（评分线 + VIX 面积 + 阶段底色，1月~全部）与阶段变化 → 页脚免责与数据日期。颜色只用 `positive / warning / negative / muted` token，每处都带文字或图标。没有提醒、AI 摘要、情景模拟和 P/C 图（见评审）。

## 历史分析（M4）

`app/services/market_risk/backtest.py`（纯函数）+ `scripts/backtest_market_risk.py`（只读公开 Cboe 数据，生成 [backtest-v1.0.md](backtest-v1.0.md)）。用 Cboe `SPX` 收盘价看每个评分日之后 5 / 20 / 60 个交易日的收益与回撤，按阶段、等级、2012–2019 / 2020 起分开统计，并用确认 2 / 3 / 5 个交易日做敏感性对比。

```bash
cd kolvex-backend-py && venv/bin/python scripts/backtest_market_risk.py --out ../docs/market-risk/backtest-v1.0.md
```

要点（详见报告）：

1. 评分衡量的是波动和回撤风险，不是方向：压力加速之后 20 日收益均值反而更高（+3.2% vs 全样本 +1.0%），但 20 日内回撤 ≥5% 的比例约是平稳阶段的两倍。页面不能把高分写成「看空」。
2. 7 次 ≥10% 回撤都在跌破 −10% 前出现过压力阶段，但随机 21 日窗口出现压力阶段的基准就有 58%，且多数是在下跌开始后才进入，更像确认而不是预警。
3. 阶段切换每年约 21 次。确认改为 3 个交易日可降到约 14 次、回撤覆盖不变；改为 5 个交易日约 7 次，但漏掉 2 次回撤。

**待产品决定**：是否发布 `v1.1`（确认周期改 3 个交易日）。v1.0 尚未写入任何快照，现在改动成本最低；改了要同时更新 `MODEL_VERSION`、本文、页面 ⓘ 文案和测试。

## 未完成 / 未验证

- worker 没有在真实 Redis / Supabase 上跑过；上线前先应用迁移、跑一次 `--write` 回填，再打开开关。
- 迁移没有在任何 Supabase 环境执行；`--write` 路径（`repository.py` 的读写）只有纯函数部分有单测，没有对真实数据库跑过。
- Cboe 数据公开展示授权未确认（见评审第 3 节），`license_scope` 统一为 `internal_pending_review`。
- 1990 年以前和未来新增的临时休市需要手动加入 `SPECIAL_CLOSURES`。
- 页面截图（2026-11-24）：有数据的完整页面用临时预览页 + 真实 Cboe 数据（390px 深色 / 浅色、1280px 深色）；部分评分、待更新、来源失败、可疑值、待确认阶段、历史加载失败用同一预览页改数据截图；浏览器面板里已有的登录会话打开 `/dashboard/market-risk`，经真实代理到本地后端（8080）返回 `503 no_score`，页面显示「还没有发布风险评分」，侧边栏入口正常高亮。说明本地后端连的库里已有表但没有数据。`unavailable`（读库失败）文案只有代码，没有截图。
- 阈值只做了历史分析，没有调参；页面页脚仍写「尚未经回测充分验证」，等产品决定 v1.1 后再改。
- App 未移植（见 `kolvex-mobile/MIGRATION.md` 第 18 条）。
