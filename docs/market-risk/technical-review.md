# Market Risk Monitor — 技术评审与实施计划（Milestone 0）

> 对象：《Kolvex Market Risk Monitor PRD + Technical Design Specification》v1.0（2026-11-23）。
> 本文只记录 PRD 与当前代码的对照结论、需要改的地方和建议的实施顺序。开发进度见 [README.md](README.md)。

## 1. 结论

PRD 的方向（日终、可追溯、透明评分、先验证再预测）和项目硬性规则一致，可以开工。但有 5 处必须先改或先拍板，否则会直接违反 `AGENTS.md` 的规则或和已有功能冲突：

| # | 问题 | PRD 原文 | 建议 |
| --- | --- | --- | --- |
| 1 | 提醒 / 通知是已下线功能 | §13 Alerts、`/market/risk/settings` | `RETIRED_PRODUCT_ROUTE_PREFIXES` 含 `/dashboard/alerts`、`/dashboard/notifications`。V1 不做提醒；要做需先由产品决定是否恢复该能力 |
| 2 | 与 Trade OS「市场状态」重名重叠 | §8 Market Regime Engine | Trade OS 已有 `market_regime.py`（SPY/QQQ 50/200 SMA → risk_on / cautious / risk_off）和 `/dashboard/trade-os/market`。本功能 UI 改称「风险阶段 / Risk Stage」，Trade OS 后续（Milestone 7）读取本功能的结果，不再各算一套 |
| 3 | 路由不符合现有结构 | `/market/risk`、`/api/market-risk` | Web 用 `/dashboard/market-risk`（`/dashboard/market/[ticker]` 已存在，`/dashboard/market/risk` 会吃掉代码为 RISK 的股票）；后端用 `/api/v1/market-risk/*`；Next 代理 `/api/market-risk/*`；在 `productFeatures.ts` 新增 `marketRisk`（experimental） |
| 4 | 颜色写死 hex | §18.2 Color Tokens | 只用 `app/globals.css` 现有 token；阶段 / 等级必须带文字 + 图标 |
| 5 | 数据授权未确认 | §14、§19.3 | 见第 3 节。上线前需要你确认 Cboe 数据的公开展示权限 |

## 2. 可复用的现有能力

| PRD 需要 | 已有实现 | 用法 |
| --- | --- | --- |
| 定时采集 | `main.py` 里的 asyncio worker + Redis lease（如 `economic_indicators.run_economic_indicators_worker`） | 照同一模式写 `run_market_risk_worker`，不引入新调度器 |
| FRED 读取 | `economic_indicators.py` 的 `parse_fred`（公共 CSV，区分观测日与抓取时间） | 复用解析，新增 `VIXCLS`、`VXVCLS`（VIX3M） |
| VIX 报价 | Web `lib/marketBenchmarks.ts` 的 `^VIX` 走现有行情源 | 只用于盘中展示参考；评分只用日终收盘 |
| 手动导入兜底 | `fear_greed.py` 管理员 CSV 导入（校验 → 确认 → 记录导入人） | 若某数据源只能人工获取（如 P/C），沿用这一流程 |
| 期权链 / Greeks | `options_chain/`（Alpaca，`indicative` 免费源，含 OI 与 Greeks） | 仅能做 V2 内部研究；代码注释已写明公开展示需付费 OPRA 源，且 Alpaca 只有 SPY 不含 SPX/SPXW |
| AI 解释 | 现有 AI provider + 免费额度 `deepseek-flash` | V1 先做规则模板解释，AI 摘要按 `input_hash` 复用，开发时不触发付费调用 |
| 恐慌贪婪 | 市场概览右侧 CNN Fear & Greed | 不重复展示；可在本页链接过去 |
| 图表 | Web 已装 `recharts` | 直接用 |

## 3. 数据源评估（V1 关键指标）

| 指标 | 候选来源 | 历史长度 | 风险 |
| --- | --- | --- | --- |
| VIX | Cboe 每日历史 CSV；FRED `VIXCLS` | 1990 起 | FRED 页面标注该序列版权归 Cboe，公开展示需确认 |
| VIX3M | FRED `VXVCLS`；Cboe CSV | 2007 起 | 同上 |
| VIX9D | Cboe CSV | 2011 起 | FRED 没有；只有 Cboe |
| VVIX | Cboe CSV | 2006 起 | 同上 |
| Equity / Total / Index P/C | Cboe 每日市场统计页面 | Cboe 公开 CSV 只到 2019 年左右 | **最脆弱**：需抓网页、格式易变、历史不足 756 日、授权不明 |
| SKEW | Cboe CSV | 1990 起 | P1 |
| DSPX / VIXEQ | Cboe 指数数据 | 较短 | 留到 Later |

**对评分模型的影响**：PRD 给 Options Activity 20% 权重，但 P/C 是最不可靠的数据。若 P/C 缺失，覆盖率恰好 80%，评分会长期停在 Partial。建议：

- `v1.0` 模型只用 VIX / VVIX / VIX9D / VIX3M 四个关键指标（权重按 PRD 比例重新分配：波动率水平 30%、波动率的波动 25%、期限结构 35%、尾部 10% 待 SKEW 接入前为 0）。
- P/C 先作为「辅助信息」展示，不进评分；数据源稳定且历史够长后发布 `v1.1` 再纳入。

## 4. PRD 内部需要补全的规则

1. **阶段机阈值缺数字**：Stage 1 ↔ 2 的滞后区间（如升到 60 才进 Stage 2，跌破 55 才退回）、确认周期（PRD 说 2 个观测日，适用于所有切换还是只适用于 Stage 3）都需定值。
2. **「近期峰值」窗口**：Stage 4 要求「较近期峰值下降 ≥15 分」，需定义窗口（建议 20 个交易日）。
3. **Stage 4 何时结束**：PRD 没写 Stage 4 → Stage 1 的条件（建议：评分 <60 且修复条件持续 5 个交易日）。
4. **混合口径**：评分用历史分位数，Stage 3 确认条件用绝对阈值（VIX>28、VVIX>110）。可以接受，但 UI 和文档要分开写清楚。
5. **数据不同步**：VIX 已更新而 VVIX 未更新时，PRD 要求不发布，但没写多久后用 Partial 发布。建议美东 18:30 首次尝试、次日 09:00 前最后重试，仍缺关键指标则不出当日评分。
6. **回测基准**：发布门槛（§25.2 第 6 条）未定。建议 `v1.0` 上线时页面只说「模型估算、未经充分验证」，回测报告完成前不展示任何命中率。

## 5. 简化建议

- **模型版本放代码里，不放数据库**：权重、阈值、所需指标写成 Python 常量（`MODEL_V1_0 = {...}`），git 管版本，快照只存 `model_version` 字符串。PRD 要求「发布后不可改」，代码常量 + 测试比数据库表 + 管理后台更容易保证，也省掉 `/admin/market-risk` 的模型管理界面。
- **指标定义同理放代码**，`market_risk_metric_definitions` 表不需要。
- **V1 只建 5 张表**：`market_risk_observations`、`market_risk_snapshots`、`market_risk_signals`、`market_risk_regime_events`、`market_risk_ingestion_runs`。情景、提醒、AI 报告、期权链表随对应功能再建。
- **子页面先不拆**：V1 一个页面；历史和情景模拟放同页的分区或抽屉。

## 6. 实施顺序

每步是一个可单独合并的改动，全部只读公开数据，不写生产库（迁移文件写好，由你执行）。

| 步骤 | 内容 | 验收 |
| --- | --- | --- |
| M1a 数据层 | 迁移（5 张表 + RLS：只读公开、写入仅 service role）；Cboe CSV / FRED adapter；交易日历；质量检查；历史回填脚本 | 本地能回填 VIX/VVIX/VIX9D/VIX3M 自 2011 起的日终数据；单测覆盖节假日、缺失、重复、修订 |
| M1b 采集 worker | `run_market_risk_worker`，Redis lease，失败保留上一份已确认快照 | 单测：数据不全时不发布、不误报「风险解除」 |
| M2 评分与阶段 | 分位数归一化（756 日窗口、最少 252 日、只用当日以前数据）、加权评分、覆盖率规则、阶段机、Checklist | 相同输入同版本结果一致；无前视偏差测试；阶段切换都能追溯到规则 |
| M2b 接口 | `GET /latest`、`/metrics`、`/history`、`/signals`、`/regime-history`，统一错误码 | pytest 覆盖 stale / partial / insufficient history |
| M3 页面 | `/dashboard/market-risk`：评分卡 + 阶段 + 期限结构图 + 维度表 + Checklist + 历史图 + 数据状态；中英双语；加载/过期/缺失状态 | 390px 与桌面截图；lint / tsc / 相关 test 通过 |
| M4 历史分析 | walk-forward 回测脚本 + 报告（前瞻收益、回撤、误报率） | 报告进 `docs/market-risk/` |
| 之后 | P/C（v1.1）、SKEW、情景模拟、AI 摘要、App 移植、Trade OS 联动；V2 期权结构待授权 | — |

## 7. 需要你决定的事

1. V1 对所有用户开放，还是先只给管理员 / 实验开关？（建议实验开关，和 Trade OS 一样）
2. 是否接受 `v1.0` 不含 P/C（第 3 节）？
3. 提醒功能是否恢复？若不恢复，PRD §13 移到 Later。
4. Cboe 数据授权：上线前由你确认；开发阶段只在本地和实验开关下使用。
