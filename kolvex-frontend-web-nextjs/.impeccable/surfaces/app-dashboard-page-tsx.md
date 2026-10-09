---
version: 1
slug: "app-dashboard-page-tsx"
primary_target: "app/dashboard/page.tsx"
related_targets: ["app/dashboard/research/page.tsx","app/dashboard/research/[ticker]/page.tsx","app/dashboard/journal/page.tsx","app/dashboard/portfolio/page.tsx","app/dashboard/youtube-opinions/page.tsx"]
---

## Scope

The five main tabs inside the established dashboard world: 行情 (`/dashboard`), 研究 (`/dashboard/research` and `/dashboard/research/[ticker]`), 组合 (`/dashboard/portfolio`), 日志 (`/dashboard/journal`), 观点 (`/dashboard/youtube-opinions`). Visitor mode: Operate. Visual world inherited from `app-dashboard-layout-tsx`; this brief governs page structure only.

## Audience and job

Same users as the app. Frequent short visits, often at night or between sessions. On every tab the first job is "what changed since I last looked, and does it touch what I hold or what I decided?"

## Constraints

No new palette, type, or components outside the established world. All existing data, functions, routes, i18n (zh first), light and dark. Numeric opinion scores are never shown. Pain points to fix: pages look the same, no lead in the first viewport, pages disconnected, wrong density, weak mobile.

## Direction contract

THESIS: Change first. Each tab's first viewport answers one question, what moved since you last looked, as a single headline figure or verdict, with the evidence list beneath. It refuses the current scaffold of page title, search box, and bordered panels repeated on every tab.

OWN-WORLD: Inherited: white or black ground, black or white ink, one grey, hairline rules, green #00C805 up/bullish/primary, orange-red #FF5000 down/bearish, Inter tabular figures with system Chinese sans, pill toggles. No bordered panels as page structure; sections are headings over hairline lists.

STORY: The user sees the change (index move, opinion shifts, portfolio move, theses needing review, newest videos), sees which of those touch their holdings or theses, and opens the stock workspace, where price, creator split, position and thesis sit in one scroll.

FIRST VIEWPORT: 行情: benchmark move as 40px coloured figure with SPY/QQQ/DIA pills, then "today's biggest moves" list. 研究: headline count of creator opinion changes this week, then a dated change timeline, held tickers marked. 组合: value and scrubbable chart first, then "changes in your holdings", then holdings. 日志: "N theses need review" headline, review list, then full journal. 观点: unchanged explorer, plus newest-first ordering. Stock workspace: price 40px plus chart, then creator split with bulls left and bears right on a shared date axis; on phones the first screen is only price, chart and verdict.

FORM: Surface structure "change first", ordered list position 4 of 7, dealt lead; seed 99bfca5a. Raises: labanotation-style bull/bear split; one-stock first screen on mobile. Signature interaction: scrubbing a chart rewrites the headline above it. Motion: 150 to 200ms state transitions only.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
