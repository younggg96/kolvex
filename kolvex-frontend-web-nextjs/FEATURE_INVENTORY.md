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
