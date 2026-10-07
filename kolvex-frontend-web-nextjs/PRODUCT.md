# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Chinese-speaking individual investors in US equities. They follow Chinese-language finance creators on YouTube, use AI to research tickers before acting, and keep an eye on their own brokerage holdings. They read in Chinese first (English UI exists via i18n) and come to Kolvex between market sessions or during them, on desktop and on phone (the app ships as a PWA).

## Product Purpose

Kolvex turns scattered investment opinion into something an individual can check against their own book:

- **AI Chat** (`/dashboard`, `/dashboard/chat`): a research agent that answers questions about stocks, markets, and the user's portfolio.
- **Trading Analysis / 深度分析** (`/dashboard/trading-analysis`): multi-agent analysis runs on a ticker that produce a written report with analyst debate and a final decision; past reports can be explored.
- **YouTube Opinions / YouTube 观点追踪** (`/dashboard/youtube-opinions`): opinions extracted from finance creators' videos, browsable by stock or by creator, each with sentiment (bullish, bearish, neutral, mixed), a direction score from −100 to +100, confidence, summary, key points, risks, and a link to the source video. The numeric score is never shown to users; strength is expressed qualitatively (轻度 / 中度 / 强烈 + 看涨 / 看跌, 转强 / 转弱 for changes). Admins import opinions as JSON, one video per object and many videos per batch.
- **Portfolio / 投资组合** (`/dashboard/portfolio`): holdings, options positions, transactions, allocation, performance, and AI portfolio analysis, connected through Plaid Investments.
- **Settings** and **Admin** (admin-only).

Success means the user can see what creators they trust are saying about a stock, interrogate it with AI, and relate it to what they actually hold, quickly and without noise.

## Positioning

Kolvex tracks what specific Chinese-language finance creators said about specific tickers over time, scores each opinion, and puts that next to AI research and the user's real Plaid-connected holdings. The creator-by-ticker opinion record is the part a generic stock app or chatbot does not have.

## Operating Context

- Used during and around US market hours; Chinese-speaking users are often in Asia time zones, so evening and late-night use is normal.
- Desktop browser with a persistent left sidebar; mobile as an installed PWA with a drawer sidebar.
- Data comes from YouTube videos (creator avatars and titles are real third-party content), yfinance-style market data, and Plaid brokerage connections.

## Capabilities and Constraints

- Next.js 14 App Router, React 18, Tailwind CSS 3, Radix UI primitives, lucide-react icons, recharts and chart.js, next-themes, Supabase auth.
- Bilingual zh/en via `lib/i18n`; Chinese is the primary locale.
- Feature set is defined in `lib/productFeatures.ts`; retired features (KOL tracker, news, options flow, stock screener, alerts, and others) are gone and must not reappear in navigation.
- Light and dark themes must both be supported.

## Brand Commitments

- Name: Kolvex. Existing logo (`components/common/LogoIcon.tsx`, `public/icon.svg`) stays.
- Primary green `#00C805` stays as the brand color.
- Both light and dark mode are required.
- Visual direction: the category standard for retail investing apps, executed at full craft. Robinhood is the quality bar; the app should sit alongside it without looking out of place.

## Evidence on Hand

- Real creator opinion data (e.g. 投资TALK君 on NVDA and MSFT) served by the backend; no fabricated creators, scores, or returns in the UI.
- No testimonials, customer counts, or performance claims exist; none should be invented.

## Product Principles

1. The opinion record is the product: who said what about which ticker, when, and how strongly.
2. Always traceable to source: every opinion links back to its video and creator.
3. Relate opinion to the user's own holdings rather than presenting it in isolation.
4. Calm and fast over flashy: users check this often, sometimes late at night, and need to scan, not be entertained.
5. Chinese-first reading: copy, density, and type must read well in Chinese.
