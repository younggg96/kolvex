---
version: 1
slug: "app-dashboard-layout-tsx"
primary_target: "app/dashboard/layout.tsx"
related_targets: ["components/layout/AppShell.tsx","components/youtube/YouTubeOpinionExplorer.tsx","components/portfolio/PortfolioPageContent.tsx"]
---

## Scope

The whole authenticated app under `/dashboard`: shell (sidebar, header, mobile navigation), AI Chat, Trading Analysis, YouTube Opinions, Portfolio, Settings, Admin. Visitor mode: Operate.

## Audience and job

Chinese-speaking retail investors in US equities. They check what trusted creators said about a ticker, interrogate it with AI, and relate it to their Plaid-connected holdings. Frequent, short visits, often at night, desktop and installed PWA on phone.

## Constraints

Keep Kolvex name and logo, brand green #00C805, light and dark themes, all existing functions and routes. Layout and interaction may be redesigned. Quality bar: Robinhood.

## Direction contract

THESIS: Kolvex as a Robinhood-calibre investing app: each screen leads with one number or one verdict, content sits in hairline-separated lists on a plain ground, and colour means direction. It refuses the SaaS card kit (every section boxed in a bordered rounded card, grey stat tiles, coloured badge soup).

OWN-WORLD: Pure white or pure black ground, black/white ink, one grey for secondary text, hairline rules. Green #00C805 for up, bullish and the primary action; orange-red #FF5000 for down and bearish (darkened for small text in light mode). Inter with tabular figures plus the system Chinese sans. Pill buttons and pill toggles, 16px radius only on overlays and the few true panels.

STORY: The user sees the verdict first (score, value, change), then the evidence underneath (opinions, holdings, reports), and every opinion traces to its creator and video.

FIRST VIEWPORT: Sidebar on the left, quiet. On a stock or creator page: name at 32px, the consensus verdict as a 32px coloured phrase (for example 强烈看涨; numeric scores are never shown) with opinion count, creator count and latest date, a line chart of opinion strength over time beneath it with no numeric axis, then the opinion list. On phones a bottom tab bar replaces the sidebar for the four main sections.

FORM: Category standard (canon), user-chosen over the dealt hand; seed 9b98cc96. Signature interaction: scrubbing a line chart rewrites the headline above it, the verdict phrase and date on opinion pages, the value and change on the portfolio. Motion grammar: 150 to 200ms state transitions only, no page-load choreography.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
