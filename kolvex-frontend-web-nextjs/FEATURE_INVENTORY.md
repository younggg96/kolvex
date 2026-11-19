# Kolvex 功能整合清单

本清单对应 `lib/productFeatures.ts`（功能开关的唯一来源）。三端完整对照（Web / App / 后端 / 文档）见 [`docs/product/feature-catalog.md`](../docs/product/feature-catalog.md)。最后核对：2026-11-13。

已删除功能的历史 URL 由 middleware（`isProductRouteDisabled`）重定向到 `/dashboard`；`enabled: false` 的功能同样会被重定向。

## 当前启用

| 功能 | ID | 页面入口 | 主要代码边界 |
| --- | --- | --- | --- |
| 行情与个股 | `home` | `/dashboard`、`/dashboard/market/[ticker]` | `components/decision/Market.tsx`、`components/decision/StockWorkspace.tsx`、`app/api/market/*` |
| 自选股 | `watchlist` | `/dashboard/watchlist` | `components/decision/Watchlist.tsx`、`hooks/useWatchlist.ts`、`lib/watchlist*.ts` |
| 观点更新 | `journal` | `/dashboard/journal` | `components/decision/Journal.tsx`、`/api/theses` |
| AI 聊天、研究工作区 | `chat` | `/dashboard/chat`、`/dashboard/workspaces` | `components/chat`、`lib/chatApi.ts`、`lib/researchWorkspaceApi.ts`、`/api/chat`、`/api/chat-history`、`/api/research-workspaces` |
| AI 研究 | `tradingAnalysis` | `/dashboard/ai-research`（旧 `/dashboard/research/deep-research`、`/dashboard/trading-analysis` 重定向） | `components/trading-analysis`、`lib/tradingAnalysisApi.ts`、`/api/trading-analysis` |
| 博主观点（YouTube / Reddit / X） | `youtubeOpinions` | `/dashboard/youtube-opinions`、`/dashboard/reddit-opinions`、`/dashboard/x-opinions` | `components/youtube`、`components/x`、`lib/youtubeOpinionsApi.ts`、`lib/xContentApi.ts`、`lib/redditOpinions.ts` |
| 早晚报 | `briefs` | `/dashboard/briefs` | `components/briefs`、`lib/dailyBriefs.ts`、`/api/briefs` |
| 新闻终端 | `news` | `/dashboard/news` | `components/news`、`lib/newsFeed.ts`、`/api/news` |
| 投资组合（Plaid） | `portfolio` | `/dashboard/portfolio`、公开页 `/portfolio/[userId]` | `components/portfolio`、`lib/portfolioApi.ts`、`lib/plaidApi.ts`、`/api/portfolio`、`/api/plaid` |
| 虚拟交易 | `paperTrading` | `/dashboard/paper-trading` | `components/paper-trading`、`lib/paperTrading*.ts`、`/api/paper-trading` |
| 超级投资者 | `superinvestors` | `/dashboard/superinvestors` | `components/superinvestors` |
| 国会交易 | `congressTrades` | `/dashboard/congress-trades` | `components/congress`、`/api/congress/trades` |
| 期权异动 | `optionsActivity` | `/dashboard/options-activity` | `components/options-activity`、`lib/optionsActivity.ts`、`/api/market/options-activity` |
| 设置 | `settings` | `/dashboard/settings`、`/config` | `components/user`、`/api/user-api-keys`、`/api/upload/avatar` |
| 管理后台 | `admin` | `/dashboard/admin` | `components/admin`、`/api/admin` |

## 已删除的功能（`RETIRED_PRODUCT_ROUTE_PREFIXES`）

不得在导航中恢复：

| 功能 | 原页面入口 |
| --- | --- |
| Community | `/community` |
| Alerts | `/dashboard/alerts` |
| Analytics | `/dashboard/analytics` |
| 旧投资者页（已由 `/dashboard/superinvestors` 取代） | `/dashboard/investors` |
| KOL Tracker | `/dashboard/kol` |
| Notifications 页面 | `/dashboard/notifications` |
| Options Flow（已由 `/dashboard/options-activity` 取代） | `/dashboard/options-flow` |
| Social Platforms | `/dashboard/social` |
| 旧股票页与详情（已由 `/dashboard/market/[ticker]` 取代） | `/dashboard/stock`、`/dashboard/stocks` |
| Stock Screener | `/dashboard/stock-screener` |

## Plaid Investments 接入

| 能力 | 路径 |
| --- | --- |
| Plaid 前端客户端 | `lib/plaidApi.ts` |
| Plaid 后端代理 | `/api/plaid/[...path]` |
| Plaid Link 连接入口 | `components/portfolio/ConnectionStates.tsx` |
| 投资交易表 | `components/portfolio/InvestmentTransactionsTable.tsx` |

后端提供 `/api/v1/plaid/status`、`/link-token`、`/exchange-token`、`/sync`、`/transactions`、`/disconnect`。

### 实时价格

`GET /api/v1/portfolio/holdings`（含公开页）返回前，会把美国上市、美元计价的股票和 ETF 的价格换成 Yahoo Finance 最新报价（常规、盘前、盘后三者中时间最新的一个，`price_session` 标 `regular` / `pre` / `post`，持仓表在价格下方标「盘前」「盘后」）（`app/services/portfolio/live_prices.py`），并按价差同步调整 `open_pnl`。原券商价格保留在 `broker_price`，`price_source` 标 `market` 或 `broker`，`price_as_of` 是报价时间或券商最近同步时间。期权、非美元持仓和报价失败的股票保持券商价格，持仓表在价格下方标「券商价 · 日期」。

### 组合价值曲线

本人查看时，曲线来自 `GET /api/v1/portfolio/history/estimated?period=`（`app/services/portfolio/estimated_history.py`）：用当前持仓股数乘每根 K 线的收盘价估算，K 线粒度与个股走势图一致：4小时用 1 分钟线（最近交易日的最后 4 小时）、1日用 5 分钟线、1周用 15 分钟线，1月及以上用日线。最后一点用最新报价，排在报价时间之前的 K 线之后；没有实时报价时止于最后一根 K 线。分时 K 线包含盘前盘后（美东 4:00–20:00）；20:00 到次日 4:00 的隔夜交易 Yahoo 不提供，不在图上。分时点按纽约时间显示。4小时和1日只对本人显示。期权、现金等没有日收盘价的持仓按当前价值计为常数，并在 ⓘ 提示里列出。不考虑期间买卖，ⓘ 里注明「按当前持仓估算」。公开页访客仍看下面的估值快照。

### 每日估值快照

每日估值快照用于公开页曲线和历史留档。后端在美股收盘后到下一次开盘前（最长 18 小时）自动读取已连接账户的持仓；在这个窗口内手动刷新也可采集当次收盘的快照。同一个纽约交易日只保存一份完整的美元估值。对有明确美国市场身份的股票和 ETF，券商报价缺失或过期时可使用同一交易日的收盘价。估值或成本不完整时历史留空。已有快照继续显示，连接前和漏采的历史需要独立的可验证持仓数据才能补齐。

## 手动导入持仓

| 能力 | 路径 |
| --- | --- |
| 提示词、JSON 解析与校验 | `lib/portfolioManualImport.ts`（测试 `scripts/portfolio-manual-import.test.cjs`） |
| 导入弹窗 | `components/portfolio/ManualImportDialog.tsx` |
| 清除确认 | `components/portfolio/ClearManualDialog.tsx` |
| 入口 | 未连接页「手动导入持仓」按钮；持仓页「设置」菜单「手动导入 / 重新导入持仓」「清除手动导入」 |

用户复制提示词，连同券商截图或导出文件发给 Codex、Muse 等外部助手，再把返回的 JSON 粘贴进弹窗。前端先校验并预览，再调用 `POST /api/v1/portfolio/manual-import`；`DELETE` 同一路径清除。数据存为 `portfolio_connections.provider = 'manual'` 的连接（需先执行迁移 `kolvex-backend-py/migrations/20261118000000_portfolio_manual_provider.sql`，否则接口返回 503），每次导入整体替换上一次手动导入，但账户和持仓行 id 保持不变，所以公开隐藏设置不会丢。没写价格的股票由后端取 Finnhub 实时报价，取不到就留空（市值不计入），不估算。期权按 OCC 合约代码存储，价格和成本按每股计、市值乘 100。

持仓、公开页、状态和 AI 持仓工具都会合并 Plaid 与手动导入的账户；公开开关和隐私设置对用户的所有连接同时生效。手动导入是静态快照，不参与每日收益快照采集，也没有交易记录（「交易」标签只在连接 Plaid 时显示）。断开 Plaid 不会删除手动导入的持仓。

## 移除账户

| 项 | 位置 |
| --- | --- |
| 入口 | 持仓页每个账户卡片右侧的垃圾桶按钮（仅本人可见），确认弹窗 `components/portfolio/RemoveAccountDialog.tsx` |
| 接口 | `DELETE /api/v1/portfolio/accounts/{id}`（`app/api/routes/portfolio/account_routes.py`、`app/services/portfolio/account_removal.py`） |

删除账户行及其持仓，并从公开隐私设置的隐藏账户列表里去掉它。Plaid 会在每次同步时返回该机构下的所有账户（支票、信用卡、车贷等），所以移除 Plaid 账户时还会把它的 Plaid `account_id` 记到 `portfolio_connections.removed_account_ids`，并删掉该账户的投资交易；之后的同步、交易拉取和每日收益快照都会跳过它。需先执行迁移 `kolvex-backend-py/migrations/20261118010000_portfolio_removed_accounts.sql`，否则移除 Plaid 账户返回 503（手动导入账户不受影响）。断开 Plaid 会删除整个连接，重新连接后被移除的账户会回来。手动导入账户直接删除，下次导入若仍包含它会重新出现。

## AI 洞察（投资组合分析）

| 项 | 位置 |
| --- | --- |
| 界面 | 持仓页「AI 洞察」标签，`components/portfolio/PortfolioAIAnalysis.tsx`；模型选择 `components/ai/AiModelSelect.tsx`（共用 `lib/aiModels.ts` 模型列表和 `/api/user-api-keys` 可用服务商） |
| 接口 | `POST /api/v1/portfolio/analysis`（body `model`、`locale`）；历史 `GET /api/v1/portfolio/analysis/runs?limit=`、`GET /api/v1/portfolio/analysis/runs/{id}`（`app/api/routes/portfolio/analysis_routes.py`、`app/services/portfolio_ai_analysis.py`），Web 经 `/api/portfolio/[...path]` 代理 |
| 存储 | `portfolio_ai_analyses`（迁移 `kolvex-backend-py/migrations/20261119000000_portfolio_ai_analyses.sql`，RLS 只允许本人读取，只有服务端写入，行不可修改） |

用户先选模型，只有已配置自己 API Key 的服务商的模型可选；没有任何 Key 时显示一句话和「前往设置添加」。分析只用用户自己的 Key，不回退到服务器模型。模型读取当前持仓（隐藏持仓除外），按界面语言（中 / 英）写分析；失败返回固定错误码（`ai_not_configured`、`ai_key_rejected`、`ai_rate_limited`、`ai_analysis_invalid`、`ai_analysis_timeout`、`no_positions`、`ai_unavailable`），界面显示对应文案，不显示占位结果。

每次成功的分析都会保存，右侧（窄屏在下方）「历史分析」按时间倒序列出日期、模型和摘要，点一条即可打开当时的完整结果；进入页面时自动打开最近一次。保存失败时仍显示本次结果，并提示「未能保存到历史记录」。迁移未执行时历史接口返回 503，界面显示「历史记录暂时无法加载」，分析本身照常可用。单股分析 `POST /analysis/stock` 仍走服务器 Ollama，未改动。
