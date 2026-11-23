# Trade OS — 交易决策与风控系统 (实验性功能 · Beta)

> 面向美股主动交易者的标准化交易计划、风控审批、成交归集与复盘系统（当前处于实验性 Beta 预览阶段）。  
> 核心原则：**Every trade has a reason. Every risk has a limit. Every result improves the system.**

---

## 1. 核心价值与模块分期

| 阶段 | 核心模块 | 状态 | 关键交付 |
|---|---|---|---|
| **Phase 0** | **数据基础** | **已完成** | 交易账户管理、Robinhood CSV 导入、幂等去重、FIFO 成交归集、权益快照 |
| **Phase 1** | **风险优先 MVP** | **已完成** | 策略版本快照、确定性头寸计算、出入金调整回撤、Trade Plan Builder、服务端 Risk Engine（单笔/组合/回撤风控）、持仓风控面板 |
| **Phase 2** | **策略与扫描** | **已完成** | Market Regime Engine (SPY/QQQ 双基准 50/200 SMA)、Trend Breakout 20D 扫描引擎、ATR(14) 价格区间、一键转计划 |
| **Phase 3** | **回测与复盘** | **已完成** | 事件驱动策略回测引擎（Trend Breakout 20D）、Trade Journal 对账日志与复盘标注、R-Multiple 分布统计、AI 结构性复盘解释 |

---

## 1.1 怎么用（Web 导航与总览引导）

页面按一笔交易的生命周期分成 4 个阶段，顶部分段控件对应阶段，阶段内多页时再显示二级入口：

| 阶段 | 页面 | 做什么 |
|---|---|---|
| 1 准备 | 账户与导入、策略实验室 | 建账户填期初资金 → 导入券商 CSV → 可选：回测策略 |
| 2 开仓前 | 市场状态、机会扫描、交易计划 | 先看市场能不能开仓 → 扫描候选 → 写入场/止损/目标，系统算仓位并审批 |
| 3 持仓中 | 持仓风控 | 看单笔、组合、回撤是否超限 |
| 4 复盘 | 交易复盘、绩效统计 | 标注失误、看纪律与 R 期望 |

总览页顶部的 5 步清单按数据自动打勾（账户 → 导入 → 市场 → 计划 → 复盘），第一个未完成的步骤高亮。Trade OS 不下单，只做计划、审批与复盘。

## 2. 路由与接口

### Web 路由
- 总览工作台：`/dashboard/trade-os`
- 账户与导入：`/dashboard/trade-os/settings`
- 交易计划：`/dashboard/trade-os/plans`
- 持仓风控：`/dashboard/trade-os/risk`
- 策略实验室与回测：`/dashboard/trade-os/strategies`
- 市场宏观状态：`/dashboard/trade-os/market`
- 机会扫描：`/dashboard/trade-os/scanner`
- 交易日志与复盘：`/dashboard/trade-os/journal`
- 绩效与纪律统计：`/dashboard/trade-os/analytics`

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
