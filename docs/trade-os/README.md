# Trade OS — 交易决策与风控系统 (实验性功能 · Beta)

> 面向美股主动交易者的标准化交易计划、风控审批、成交归集与复盘系统（当前处于实验性 Beta 预览阶段）。  
> 核心原则：**Every trade has a reason. Every risk has a limit. Every result improves the system.**

---

## 1. 策略：Swing Trading Strategy V3.0（PRD v1.0，2026-11-23）

产品规格以《Kolvex Trade OS PRD v1.0 / Swing Trading Strategy V3.0》为准。旧的 Trend Breakout 20D 已被替换；用户已有的旧策略版本保留不动（版本不可变），系统为每个用户追加 `SWING_V3_TREND_PULLBACK` v3.0.0，状态为 `research`。

| PRD 章节 | 规则 | 代码 | 状态 |
|---|---|---|---|
| §6 市场环境 | 进攻 / 谨慎 / 防守 / 未知；数据缺失或收盘超过 5 天 → 未知、禁止开仓；不再默认「进攻」 | `services/trade_os/market_regime.py` | ✅ |
| §7 扫描四层 | $10 + 2000 万成交额；EMA20>SMA50>SMA200 且收盘>SMA50；RS20>0 并排序；5 个交易日内财报拦截，财报日期未知也拦截 | `services/trade_os/scanner.py` | ✅（财报窗口按 NYSE 交易日计算） |
| §8 回调状态机 | 20 日 Pivot、回调 3–10 天 / 3–10%、触及 EMA20±ATR、跌破 SMA50 失效、确认 K 线四条件 | `services/trade_os/setup_detection.py` | ✅ |
| §9.2 计划价格 | 入场 = 信号高点 + 0.01；止损 = 回调低点 − 0.25×ATR；目标 2R；止损距离 2.5%–10% | `setup_detection.build_plan_levels` | ✅ |
| §9.3 仓位 | min(风险预算、10% 仓位、可用现金、组合剩余风险) | `services/trade_os/position_sizing.py` | ✅（现金取最新权益快照的 `cash_balance`） |
| §10 入场执行 | t+1/t+2 有效；跳空 >0.5R 取消；同一根 K 线同时触及止损与入场按不利处理 | `setup_detection.py`、`backtester.py` | ✅ |
| §11 持仓退出 | 固定 2R、第 16 天开盘时间退出、跳空止损按开盘价 | `backtester.py` | ◐ 仅回测；实盘持仓页尚未按此提示 |
| §12 风控 | 市场档位限额、回撤 6/8/10% 三级、周 2% / 月 5% 亏损、连亏 3 笔、重复持仓、最大持仓数、已批准未成交计划计入组合风险、标准拒绝码 | `services/trade_os/risk_engine.py`、`trade_plan_service.py` | ✅（周/月收益暂未剔除期内出入金） |
| §13 回测 | 多股票共用账户、同日信号按 RS20 排序、市场状态限额、开发/样本外/未使用三段、研究门槛、SPY 对照、后台任务 | `backtester.py`、`backtest_jobs.py`、迁移 `20261123150000_trade_os_portfolio_backtests.sql`（未执行） | ◐ 未做财报退出、分红、历史股票池 |
| §22.1 | 前端不能决定市场状态：审批接口忽略客户端传入的 regime | `api/routes/trade_os/plans.py` | ✅ |
| §23 收盘后任务 | 每个 NYSE 交易日收盘 45 分钟后：确认 SPY 已有当天日线 → 保存当日市场状态 → 用该状态跑扫描并保存；节假日、提前收盘按交易所日历；Redis 租约保证多副本只跑一次，数据未到就下个周期重试 | `services/trade_os/daily_job.py`、`trading_calendar.py`、`main.py` | ✅ 生产环境默认开启；本地用 `TRADE_OS_DAILY_JOB_ENABLED=true` 打开 |
| §6.4 / §8.7 只用完整收盘 | 盘中 Yahoo 的「今天」日线会被丢弃；过期判断按交易日（落后超过 1 个交易日 = 未知） | `trading_calendar.completed_bars`、`is_stale` | ✅ |
| §6.5 每日存档 | 市场状态和定时扫描按交易日唯一存一条，带规则版本和判断条件，不覆盖历史 | 迁移 `20261123140000_trade_os_daily_job.sql` | ◐ 迁移文件已写，**尚未在数据库执行**；执行前写入会自动退回旧字段 |
| §14 模拟交易、§16 提醒、§5 持仓/今日信号卡片 | — | — | ❌ 未开始 |

验收测试：`tests/test_trade_os_swing_v3.py`（AC-01–03、05–12、15–19、21、24、26、28 与 §25.1 数值例）、`test_trade_os_scanner.py`、`test_trade_os_backtester.py`。

## 1.0 回测结论（2026-11-23，组合回测引擎 swing-v3-portfolio-1）

扫描用的 25 只股票，2017-01 → 2026-11-20，10 万美元共用账户，双边滑点各 5 bp，市场过滤开。**未达到 PRD 研究门槛**：

| 区间 | 笔数 | 胜率 | 每笔期望 | PF | 最大回撤 | 收益 |
|---|---|---|---|---|---|---|
| 全部 | 353 | 44.2% | +0.06R | 1.12 | 9.8% | +9.8% |
| 开发集 2017–2023 | 224 | 46.4% | +0.06R | 1.11 | 7.7% | +6.6% |
| 样本外 2024–2025 | 103 | 46.6% | +0.26R | 1.47 | 4.0% | +10.4% |
| 未使用数据 2026 | 26 | 15.4% | −0.76R | 0.23 | 6.6% | −6.1% |

同期 SPY 买入持有约 +206%（价格收益，不含分红）。关掉市场过滤：423 笔、+0.11R、PF 1.20、回撤 11.8%，仍不达标。出场分布：止损 127、第 16 天退出 113、止盈 74、跳空止损 38；最多的未成交原因是持仓已满（145）。结果仍偏乐观：用的是今天的股票名单（幸存者偏差），也没有财报前退出。

## 1.1 怎么用（Web 三个页面）

| 页面 | 路由 | 回答的问题 | 内容 |
|---|---|---|---|
| 今天 | `/dashboard/trade-os` | 今天能不能开仓？哪些股票有信号？手上有多少风险？ | 大字结论（可开 / 不开及原因）+ 可展开的 SPY/QQQ 明细；今日信号（每个带「生成计划」）；持仓与风险 |
| 交易 | `/dashboard/trade-os/trades` | 这笔怎么做？做得怎么样？ | 计划（新建、审批、列表）/ 复盘 / 统计 三个视图 |
| 策略 | `/dashboard/trade-os/strategies` | 这套规则过去有没有用？ | Swing V3.0 回测与策略版本 |

账户与 CSV 导入在右上角齿轮（`/dashboard/trade-os/settings`）。选中的账户在三个页面间共用（只记在本机浏览器）。旧路由 `market`、`scanner`、`risk` 跳到「今天」，`plans`、`journal`、`analytics` 跳到「交易」（`plans?symbol=…` 的参数会保留）。

## 2. 路由与接口

### Web 路由
- 今天：`/dashboard/trade-os`
- 交易：`/dashboard/trade-os/trades`
- 策略：`/dashboard/trade-os/strategies`
- 账户与导入：`/dashboard/trade-os/settings`

### 后端 API 前缀
`/api/v1/trade-os/*`
- `GET/POST /accounts`：账户管理
- `POST /imports/robinhood-csv/{accountId}`：Robinhood CSV 流水导入与对账
- `GET/POST /equity/{accountId}/snapshots`：权益快照与历史
- `GET/POST /executions/{accountId}`：成交流水与手工录入
- `GET /executions/{accountId}/trade-groups`：FIFO 往返归集交易组
- `GET/POST /strategies`：策略版本管理与只读快照
- `GET/POST /plans`：交易计划管理
- `POST /plans/{id}/approve`：服务端开仓前风控审批
- `GET /portfolio/risk-summary/{accountId}`：实时持仓风险与主题敞口
- `GET /market/regime`, `POST /market/evaluate`：SPY/QQQ 宏观状态与开仓权限
- `GET/POST /scanner/*`：20日突破机会扫描与候选标的生成
- `POST /backtests/run`：历史全真事件驱动策略回测
- `GET /journal/{accountId}`, `POST /journal/review`：交易日志、违纪标记与 AI 复盘
- `GET /analytics/{accountId}`：期望收益 R、盈亏比与纪律覆盖率统计

---

## 3. 数据库表设计
- `kolvex-backend-py/supabase/migrations/20261122121500_trade_os_foundation.sql`
- `kolvex-backend-py/supabase/migrations/20261122123000_trade_os_risk_mvp.sql`
- `kolvex-backend-py/supabase/migrations/20261122130000_trade_os_market_and_scanner.sql`
- `kolvex-backend-py/supabase/migrations/20261122133000_trade_os_phase3.sql`
- `kolvex-backend-py/supabase/migrations/20261123150000_trade_os_rls_hardening.sql`：收紧 RLS（客户端不能再写市场状态 / 扫描 / 回测 / 复盘表；回测和复盘只能读自己的）。所有写入走后端 service role。

**接口鉴权（2026-11-23 修复）**：`/journal/*`、`/analytics/{account_id}` 原本没有登录校验，任何人凭账户 id 就能读交易和盈亏、写复盘。现在需要登录，并校验账户 / 交易组属于本人（`app/api/routes/trade_os/ownership.py`），不属于本人返回 404。`POST /market/evaluate`、`POST /scanner/run` 需要登录。`POST /backtests/run` 仍未加登录（只读行情、不读用户数据，但会消耗计算）。

核心表结构：
- `trading_accounts`：交易账户主表
- `equity_snapshots`：带时间戳与数据质量的净资产快照
- `cash_flows`：出入金、股息、利息流水
- `import_batches`：文件导入批次与去重统计
- `executions`：带唯一指纹的原始成交记录
- `trade_groups`：通过 FIFO 归集的往返交易（成本均价、已实现净盈亏）
- `reconciliation_issues`：超卖、缺失开仓成本等对账异常
- `trade_os_strategies`：策略定义与版本快照
- `trade_plans`：交易计划与不可篡改参数
- `risk_assessments`：风控审批审计记录与输入哈希
- `risk_configs`：账户级风控参数配置
- `account_risk_states`：账户风险分级与熔断状态
- `trade_os_market_regimes`：SPY/QQQ 宏观市场风险环境历史
- `trade_os_scanner_runs`：机会扫描历史与候选标的快照
- `trade_os_backtest_runs`：策略回测运行记录与资金曲线
- `trade_os_journal_reviews`：交易日志复盘评分、失误标签与 AI 分析
- `trade_os_audit_logs`：关键动作审计日志

---

## 4. 跨端移植状态
- **Web 端**：已实现 Phase 0（账户设置、CSV 导入、FIFO 归集查看）。
- **App 端**：MVP 暂不涉及，记录在 `kolvex-mobile/MIGRATION.md`。
