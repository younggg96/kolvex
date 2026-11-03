---
version: 1
slug: "components-decision-searchpage-tsx"
primary_target: "components/decision/SearchPage.tsx"
related_targets: ["app/dashboard/search/page.tsx", "components/decision/SearchDiscovery.tsx", "components/decision/search-page.module.css"]
---

## Scope

Visitor mode: Operate. Refresh the Web search discovery surface beneath the search field, inheriting PRODUCT.md and DESIGN.md. Chinese-first copy, both existing themes, shared AppShell, ListCard, ListRow, SegmentedControl, CompanyLogo and CreatorAvatar remain canonical.

## Audience and job

Readers can open a known ticker or creator immediately, or explore real popular stocks, creators, published research, news and daily briefs. Search stays a transient destination picker: selecting a result commits its existing destination URL and saves device-local, account-scoped history. Queries and source filters are not persisted in the URL.

## Structure and data

Use a bounded 1280px workspace. On wide screens, the stock ranking has more space than the creator directory; research and news follow in equal columns, then daily briefs. Narrow Web screens stack sections while retaining the same source switches and actions. History uses removable compact links.

The stock source switch selects YouTube (ranked by accumulated opinion count) or Reddit (the existing past-24-hour mention ranking). Creator sources switch between YouTube and X. Show actual source counts and names only. No price returns, scores, fabricated trends or implied investment recommendations. Each source has loading, empty, retry and cached-content error states.

## Interaction and motion

The signature interaction is a shared sliding source selector followed by a quick content crossfade. Ranked stocks arrive over 400ms with 28ms stagger, starting visible; logo and link-arrow movement reinforces navigation on hover or keyboard focus. Search categories reuse the shared segmented control. CSS motion is scoped to search-page.module.css, uses existing easing variables and stops spatial motion under prefers-reduced-motion. No animation loops or additional animation dependency.

Search clears immediately and restores input focus. IME composition cannot submit or start a remote research lookup. Superseded research reads are canceled and late responses ignored; a bounded failure state offers retry. The input focuses automatically only at desktop widths.
