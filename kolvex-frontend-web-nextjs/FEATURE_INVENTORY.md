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

组合价值和未实现盈亏曲线读取每日估值快照。后端在美股收盘后到下一次开盘前（最长 18 小时）自动读取已连接账户的持仓；在这个窗口内手动刷新也可采集当次收盘的快照。同一个纽约交易日只保存一份完整的美元估值。对有明确美国市场身份的股票和 ETF，券商报价缺失或过期时可使用同一交易日的收盘价。估值或成本不完整时历史留空。已有快照继续显示，连接前和漏采的历史需要独立的可验证持仓数据才能补齐。

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
