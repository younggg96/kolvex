# Kolvex 功能整合清单

本清单对应 `lib/productFeatures.ts`。当前前端产品入口已收敛为少量核心功能；已删除功能的历史页面 URL 会由 middleware 重定向到 `/dashboard`。

## 当前保留

| 功能 | ID | 页面入口 | 主要代码边界 |
| --- | --- | --- | --- |
| AI Chat | `chat` | `/dashboard`, `/dashboard/chat` | `components/chat`, `lib/chatApi.ts`, `/api/chat`, `/api/chat-history` |
| Markets and stock page | `home` | `/dashboard`, `/dashboard/market/[ticker]` | `components/decision/Market.tsx`, `components/decision/StockWorkspace.tsx`, market/news APIs |
| 博主观点 | `youtubeOpinions` | `/dashboard/youtube-opinions`（旧 `/dashboard/research` 重定向） | `components/youtube/YouTubeOpinionExplorer.tsx`, `/api/youtube-opinions` |
| AI 研究 | `tradingAnalysis` | `/dashboard/ai-research`（旧 `/dashboard/research/deep-research` 和 `/dashboard/trading-analysis` 入口重定向） | `components/trading-analysis`, `lib/tradingAnalysisApi.ts`, `/api/trading-analysis` |
| Portfolio | `portfolio` | `/dashboard/portfolio` | `components/portfolio`, Plaid Investments/portfolio APIs |
| Settings | `settings` | `/dashboard/settings`, `/config` | `components/user`, user API key and avatar APIs |
| Admin | `admin` | `/dashboard/admin` | `/api/admin` |

## 已删除的用户侧功能

| 功能 | 原 ID | 原页面入口 |
| --- | --- | --- |
| Analytics | `analytics` | `/dashboard/analytics` |
| Social Platforms | `social` | `/dashboard/social` |
| Stocks 页面与详情 | `stocks` | `/dashboard/stocks`, `/dashboard/stock/:symbol` |
| Stock Screener | `stockScreener` | `/dashboard/stock-screener` |
| Options Flow | `optionsFlow` | `/dashboard/options-flow` |
| Superinvestors | `superinvestors` | `/dashboard/investors` |
| KOL Tracker | `kolTracker` | `/dashboard/kol` |
| News | `news` | `/dashboard/news` |
| Community | `community` | `/community` |
| Notifications 页面 | `notifications` | `/dashboard/notifications` |

## 保留的共享能力

Portfolio 和首页 ticker 仍依赖基础行情能力，因此保留：

| 共享能力 | 路径 |
| --- | --- |
| 股票 quote/chart/overview API | `/api/stocks` |
| 股票类型和格式化工具 | `lib/stockApi.ts`, `lib/stockApi.server.ts` |
| 小型走势线组件 | `components/common/MiniSparkline.tsx` |

股票讨论、情绪榜、股票搜索、追踪股票等用户侧股票功能已删除。

## Plaid Investments 接入

Portfolio 连接层已统一到 Plaid：

| 能力 | 路径 |
| --- | --- |
| Plaid 前端客户端 | `lib/plaidApi.ts` |
| Plaid 后端代理 | `/api/plaid/[...path]` |
| Plaid Link 连接入口 | `components/portfolio/ConnectionStates.tsx` |
| 投资交易表 | `components/portfolio/InvestmentTransactionsTable.tsx` |

后端需要提供 `/api/v1/plaid/status`、`/link-token`、`/exchange-token`、`/sync`、`/transactions`、`/disconnect`。
