# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Chinese-speaking individual investors in US equities. They follow Chinese-language finance creators on YouTube, use AI to research tickers before acting, and keep an eye on their own brokerage holdings. They read in Chinese first (English UI exists via i18n) and come to Kolvex between market sessions or during them, on desktop and on phone (the app ships as a PWA).

## Product Purpose

Kolvex turns scattered investment opinion into something an individual can check against their own book:

- **Markets / 行情** (`/dashboard`, `/dashboard/market/[ticker]`): default signed-in entry with quotes, benchmark ETFs and stock lists. Opening a stock stays in Markets. Its stock identity and quote precede a chart-led workspace. Every viewport follows one reading order: K-line chart and AI drawings, then one unified tab panel for change summary, technical analysis, conditional setup, latest news, creator intelligence and AI research. News retains source links, publication times, translation, refresh and expansion.
  The **Macro indicators / 宏观指标** tab (`/dashboard?tab=macro`) displays eight free government statistics: 2-/10-year Treasury yields, the 10Y−2Y spread, headline/core CPI YoY, unemployment, monthly nonfarm jobs added, and real GDP annualized quarterly growth. Native cards include 1-/3-/5-year charts, actual observation periods, previous-period changes, recent-value disclosures and source links. The allowlisted Federal Reserve/BLS/BEA series use FRED public downloads without an API key; sources are checked every six hours.
- **Creator Opinions / 博主观点**: one primary navigation entry with YouTube (`/dashboard/youtube-opinions`) and Reddit (`/dashboard/reddit-opinions`) source links. YouTube combines the former Research overview with the existing explorer: stock and creator directories, opinion history, weekly changes and creator views on linked holdings. Reddit shows ApeWisdom's current top 100 stock results for all stock communities, r/wallstreetbets, r/stocks, r/investing or r/options. Readers can sort by past-24-hour mentions, mention percentage growth, rank gain or upvotes, and search the loaded ticker/name list with an optional `$` ticker prefix. Missing comparison baselines sort last. Device-local follows persist in this browser; the following-only filter shows their intersection with the current community ranking, while off-board follows remain saved. Search, community, sort and the following-only filter reset on a new page mount. Mobile rows lead with stock identity, mentions and change; expanding reveals the full company name, rank movement, upvotes and follow action. Desktop retains the full table and per-row follow controls. The shared responsive toolbar includes refresh, search and filters; scope and result counts explain the loaded list. Separate five-minute server and browser caches retain each community's ranking and actual fetch time; refresh may return a server-cached result. The compact footer carries the source/methodology link and fetch time, followed by a closed data explanation. Current and previous-24-hour comparisons are available; historical time series are not. Discussion activity does not represent investment sentiment or a recommendation.
- **AI Chat** (`/dashboard/chat`, Ask Kolvex from the sidebar, header, or ⌘K): a question about the page being read. The transcript keeps the question. Creator opinions, quotes, and holdings already loaded on the page are attached as evidence and shown as a short removable label, never pasted into the message.
- **AI Research / AI 研究** (`/dashboard/ai-research`): a separate entry for published AI reports and evidence. Administrators can open Manage reports (`?view=authoring`) for model configuration and report generation. Legacy research and trading-analysis URLs redirect to the current entry; existing report detail URLs remain supported.
- Creator opinions extracted from finance videos retain sentiment, direction, confidence, summary, key points, risks and source video links. The numeric score is not displayed; strength uses qualitative wording. Admin JSON import remains available.
- **Portfolio / 投资组合** (`/dashboard/portfolio`): holdings, options positions, transactions, allocation, performance, and AI portfolio analysis, connected through Plaid Investments.
- **Daily Briefs / 日报** (`/dashboard/briefs`): signed-in readers browse imported pre-market (1h before open), intraday and post-market (1h after close) issues, filter by type and open full articles. Administrators create, read, edit and delete complete bilingual issues; changes become available immediately.
- **News terminal / 新闻终端** (`/dashboard/news`): a single-column delayed headline feed that automatically follows the active interface language (Chinese translations or the English source), without bookmark or per-headline translation controls. Headlines link directly to the source; no categories, search, Focus rules, details pane or related-symbol section.
- **Settings** and **Admin** (admin-only).

Success means users can read creator opinions, AI research and changes related to their holdings without entering their own views or plans.

## Positioning

Kolvex tracks what specific Chinese-language finance creators said about specific tickers over time, scores each opinion, and puts that next to AI research and the user's real Plaid-connected holdings. The creator-by-ticker opinion record is the part a generic stock app or chatbot does not have.

## Operating Context

- Used during and around US market hours; Chinese-speaking users are often in Asia time zones, so evening and late-night use is normal.
- Desktop browser with a persistent left sidebar; mobile as an installed PWA with a drawer sidebar.
- Data comes from YouTube videos (creator avatars and titles are real third-party content), ApeWisdom's aggregated Reddit stock discussion ranking, yfinance-style market data, and Plaid brokerage connections.

## Capabilities and Constraints

- Next.js 14 App Router, React 18, Tailwind CSS 3, Radix UI primitives, lucide-react icons, recharts and chart.js, next-themes, Supabase auth.
- Bilingual zh/en via `lib/i18n`; Chinese is the primary locale.
- Feature set is defined in `lib/productFeatures.ts`; retired features (KOL tracker, options flow, stock screener, alerts, and others) are gone and must not reappear in navigation.
- Light and dark themes must both be supported.

## Brand Commitments

- Name: Kolvex. Existing logo (`components/common/LogoIcon.tsx`, `public/icon.svg`) stays.
- Primary green `#00C805` stays as the brand color.
- Both light and dark mode are required.
- Visual direction: the category standard for retail investing apps, executed at full craft. Robinhood is the quality bar; the app should sit alongside it without looking out of place.

## Evidence on Hand

- Real creator opinion data (e.g. 投资TALK君 on NVDA and MSFT) served by the backend; no fabricated creators, scores, or returns in the UI.
- No testimonials, customer counts, or performance claims exist; none should be invented.

## Reader Experience

- Users receive information; no personal thesis, entry/target/stop, reasoning or review form is required.
- Updates (`/dashboard/journal`) displays imported creator opinion changes and recent source-linked opinions, with an optional holdings scope.
- Markets and stock pages lead with information, not prompts to write a plan.
- Personal thesis storage is retained for existing records, but is disconnected from the reader interface.

## Product Principles

1. The opinion record is the product: who said what about which ticker, when, and how strongly.
2. Always traceable to source: every opinion links back to its video and creator.
3. Relate opinion to the user's own holdings rather than presenting it in isolation.
4. Calm and fast over flashy: users check this often, sometimes late at night, and need to scan, not be entertained.
5. Chinese-first reading: copy, density, and type must read well in Chinese.


AI result visibility: all saved technical analyses, AI drawings and completed
research are shared with all signed-in users, including previously generated results.
The stock workspace prioritizes the current user's result and otherwise opens
the latest result from any user. History identifies authors and supports
Everyone / Mine filters. Generation and modifications remain owner-controlled.
