# 功能总表与功能要求

> 所有用户可见功能在 Web、App、后端的位置，以及对应的文档。
> **功能是否启用以 `kolvex-frontend-web-nextjs/lib/productFeatures.ts` 为准**；App 的移植细节和验证等级以 `kolvex-mobile/MIGRATION.md` 为准。
> 产品定位与用户画像见 `kolvex-frontend-web-nextjs/PRODUCT.md`。最后核对：2026-11-13。

## 1. 产品原则（所有功能都要遵守）

1. **观点记录就是产品**：谁、在哪天、对哪只股票、说了什么、多强。
2. **永远可追溯**：每条观点链接到原视频 / 原帖和博主；AI 结论附来源。
3. **结合用户自己的持仓**，而不是孤立地展示观点。
4. **平静、快速，不花哨**：用户经常深夜查看，要能快速扫读，不需要娱乐性。
5. **中文优先**：文案、信息密度、字体都要适合中文阅读；英文界面同时可用。
6. **只提供信息，不替用户做决定**：不要求用户写自己的观点、目标价或止损；不展示观点的数字分数，强度用文字描述。
7. **不编造**：不造博主、观点、收益率、用户数或推荐语；缺失的数据就是缺失。

## 2. 功能总表

App 列：✅ 已移植 · ◐ 部分移植（差异见 MIGRATION.md）· — 不提供。

### 行情与个股（`home`）

| 功能 | Web 入口 | App 入口 | 后端（`app/api/routes/`） | 文档 | App |
| --- | --- | --- | --- | --- | --- |
| 行情总览、指数 / 板块 / 跨资产 | `/dashboard` | `(tabs)/index`、`/markets` | `market_data.py` | [decision-workspace.md](../decision-workspace.md) | ✅ |
| 股票观察（今日异动 / 放量活跃 / 博主热议…） | `/dashboard` | 首页 | `market_data.py`（`/market/discovery`） | [stock-discovery.md](../stock-discovery.md) | ✅ |
| 宏观指标 | `/dashboard?tab=macro` | `/macro` | `economic_indicators.py`、`market_observations.py` | `kolvex-backend-py/docs/macro-data.md` | ✅ |
| 重大事件日历 | `/dashboard?tab=calendar` | `/calendar` | `market_events.py` | [market-events.md](../market-events.md) | ✅ |
| 个股工作台（概览、财报、盈利、指标趋势、同行、持股、分析师、简介） | `/dashboard/market/[ticker]?tab=…` | `/stock/[symbol]?tab=…` | `market_data.py` | [decision-workspace.md](../decision-workspace.md) | ✅ |
| 技术图表、画线、AI 技术分析 | 个股 `?tab=technical` | `/technical/[symbol]` | `chart_drawings.py`、`market_data.py`（ai-technical、chart-jobs） | [technical-analysis-focus.md](../technical-analysis-focus.md) | ◐ |
| 估值（PE 区间、情景模拟、公司估值计算器） | 个股 `?tab=valuation` | 个股 `valuation` tab | `valuation.py` | [stock-valuation/PRD.md](../stock-valuation/PRD.md)、[README.md](../stock-valuation/README.md) | ◐ |
| 期权链 | 个股 `?tab=options` | 个股 `options` tab | `options.py` | `PRODUCT.md` | ✅ |
| AI 基本面分析 | 个股概览 | 个股 `summary` tab | `market_data.py`（ai-fundamentals） | — | ✅ |
| Kronos 预测（实验） | 技术分析 | `/technical/[symbol]` | `forecast.py` | — | ◐ |
| 报价刷新与时效 | 全站 | 全站 | `market_data.py` | [market-data-freshness-20261104.md](../market-data-freshness-20261104.md)、[frontend-data-cache.md](../frontend-data-cache.md) | ✅ |
| 搜索 | `/dashboard/search` | `(tabs)/search` | `market_data.py` | — | ✅ |

### 观点与内容

| 功能 | ID | Web 入口 | App 入口 | 后端 | 文档 | App |
| --- | --- | --- | --- | --- | --- | --- |
| YouTube 博主观点、博主 / 股票目录 | `youtubeOpinions` | `/dashboard/youtube-opinions` | `(tabs)/opinions`、`/creators`、`/creator/youtube/[id]` | `youtube_opinions.py` | [youtube-channel-profiles.md](../youtube-channel-profiles.md) | ◐ |
| X 博主内容与翻译 | `youtubeOpinions` | `/dashboard/x-opinions` | `opinions` 的 X tab、`/creator/x/[id]` | `x_content.py` | [x-content.md](../x-content.md) | ◐ |
| Reddit 热度榜 | `youtubeOpinions` | `/dashboard/reddit-opinions` | `opinions` 的 Reddit tab | `reddit_opinions.py` | `PRODUCT.md` | ✅ |
| 博主分享（图片 / 社交平台） | `youtubeOpinions` | 博主页、`/share/creators/[channelId]` | 博主页 | — | — | ◐ |
| 观点更新 | `journal` | `/dashboard/journal` | `/updates` | `youtube_opinions.py` | `PRODUCT.md`「Reader Experience」 | ✅ |
| 早晚报 | `briefs` | `/dashboard/briefs`、`/dashboard/briefs/[id]` | `(more)/briefs`、`brief/[id]` | `briefs.py` | [daily-briefs.md](../daily-briefs.md)、[prompts/daily-brief-generator.md](../prompts/daily-brief-generator.md) | ✅ |
| 新闻终端 | `news` | `/dashboard/news` | `(more)/news` | `news_feed.py` | [news-feed.md](../news-feed.md) | ✅ |

### AI

| 功能 | ID | Web 入口 | App 入口 | 后端 | 文档 | App |
| --- | --- | --- | --- | --- | --- | --- |
| AI 聊天 | `chat` | `/dashboard/chat`、`⌘K` | `(tabs)/chat`、`/chat/[id]` | `chat/` | `kolvex-backend-py/app/agent/README.md`、[model-catalog.md](../model-catalog.md) | ✅ |
| 研究工作区 | `chat` | `/dashboard/workspaces` | `(more)/workspaces` | `research_workspaces.py` | — | ✅ |
| AI 研究报告库、阅读 | `tradingAnalysis` | `/dashboard/ai-research` | `(more)/research`、`/report/[id]` | `trading_analysis/` | — | ✅ |
| 研究任务生成（仅管理员） | `tradingAnalysis` | `/dashboard/ai-research?view=authoring` | `/research-task/[id]` | `trading_analysis/` | — | ◐（轮询代替 SSE） |

### 交易与持仓

| 功能 | ID | Web 入口 | App 入口 | 后端 | 文档 | App |
| --- | --- | --- | --- | --- | --- | --- |
| 自选股 | `watchlist` | `/dashboard/watchlist` | `(more)/watchlist` | Supabase 直连 + RLS | [watchlist-sync.md](../watchlist-sync.md) | ✅ |
| 投资组合（Plaid） | `portfolio` | `/dashboard/portfolio`、公开页 `/portfolio/[userId]` | `/portfolio`（只读持仓快照） | `portfolio/`、`plaid.py` | `kolvex-frontend-web-nextjs/FEATURE_INVENTORY.md`「Plaid」 | ◐（2026-11-12 重新启用；App 缺 Plaid 授权、交易、配置、收益图、AI 分析、股票观察「我的持仓」） |
| 虚拟交易 | `paperTrading` | `/dashboard/paper-trading`、个股 `?tab=paper-trading` | `(more)/paper-trading`、个股 tab | `paper_trading.py` | [paper-trading/PLAN.md](../paper-trading/PLAN.md)、[README.md](../paper-trading/README.md)、Web `UX-CONTRACT.md` | ✅ |
| 超级投资者（13F） | `superinvestors` | `/dashboard/superinvestors`、`/dashboard/superinvestors/[manager]` | `(more)/superinvestors`、`/superinvestor/[manager]` | `free_research.py`（`/market/free-research/institutions`） | — | ✅ |
| 国会交易 | `congressTrades` | `/dashboard/congress-trades` | `(more)/congress-trades` | `congress_trades.py` | — | ✅ |
| 期权异动 | `optionsActivity` | `/dashboard/options-activity` | `(more)/options-activity` | `options_activity.py` | — | ✅ |

### 账户与管理

| 功能 | ID | Web 入口 | App 入口 | 后端 | 文档 | App |
| --- | --- | --- | --- | --- | --- | --- |
| 登录注册、OAuth、找回密码 | — | `/auth/*` | `/sign-in`、`/auth/*` | `auth/` | — | ✅（App 必须登录） |
| 个人资料、头像、主题、语言、模型 API Key | `settings` | `/dashboard/settings`、`/config` | `/account`、`/preferences`、`(more)/settings` | `users.py`、`upload/`、`user_api_keys/` | — | ✅ |
| 管理后台（用户、日报、事件、YouTube、X、期权异动、邮件设置） | `admin` | `/dashboard/admin` | `(more)/admin` | `admin/` 等 | [mcp-content-admin.md](../mcp-content-admin.md) | ◐ |
| 公开阅读页与 SEO | — | `app/(public)/`：`/stocks`、`/creators`、`/research` | —（App 无访客模式） | — | [public-reading.md](../public-reading.md) | — |
| 隐私政策、条款、联系 | — | `/privacy`、`/terms`、`/contact` | 打开网页 | 联系表单返回 410 | — | ✅ |

### 已退役（不得恢复）

`RETIRED_PRODUCT_ROUTE_PREFIXES`：社区、预警、Analytics、旧投资者页 `/dashboard/investors`、KOL tracker、通知、旧期权流 `options-flow`、Social、旧股票页 `/dashboard/stock(s)`、选股器 `stock-screener`。后端对应的未注册路由目录（`kol_tweets`、`xiaohongshu`、`snaptrade`、`stock_alerts`、`scraper` 等）同样视为退役代码。

## 3. 通用功能要求

每个功能上线前都要满足这些要求。

**数据**
- 有真实来源和时间。行情标明是常规时段还是盘后；有快照的数据标明快照日期。
- 加载、空、错误、过期四种状态都要明确显示。错误时提供重试，不显示假数据。
- 观点和 AI 结论附带来源链接。

**权限**
- 公开、登录、管理员三级权限在后端校验，前端只负责隐藏入口。
- AI 生成结果（技术分析、研究报告）对所有登录用户共享，生成和修改只能由作者本人操作。
- 私有数据（持仓、虚拟账户、聊天）按用户隔离，切换账户后不残留。

**交互**
- 页面状态（tab、筛选、范围）写进 URL，刷新和分享后能恢复。App 用同名参数并支持深链接。
- 写操作防重复提交，失败时保留用户输入；危险操作需要确认。
- 会花钱的 AI 调用只能由用户明确点击触发。

**多语言与主题**
- 中英双语、浅色和深色都要支持，桌面和 390px 手机宽度都要可用。

**跨端**
- 用户可见的新能力要么两端同时实现，要么在 `MIGRATION.md` 登记为待移植（见 [web-mobile-parity.md](../engineering/web-mobile-parity.md)）。

## 4. 新功能文档模板

新功能在 `docs/<功能名>.md` 新建文档，并在本表和 [docs/README.md](../README.md) 各加一行：

```markdown
# <功能名>

入口：Web `<路由>` · App `<路由>` · 功能开关 `<productFeatures id>`

## 用户能做什么
- …（只写用户可见的行为，按优先级排）

## 规则
- 数据来源、刷新频率、缺失时怎么显示
- 权限：公开 / 登录 / 管理员
- 不做什么（明确排除的范围）

## 实现
| 层 | 位置 |
| --- | --- |
| Web | `components/…`、`lib/…`、`app/api/…` |
| App | `src/components/…`、`src/lib/…` |
| 后端 | `app/api/routes/…`、`app/services/…` |
| 数据库 | `supabase/migrations/…`（RLS 说明） |

## 验证
- 已验证：…（命令、测试名、在哪个环境看过）
- 未验证：…
```
