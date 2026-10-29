# Reddit features documentation handoff — 2026-10-29

This is an extension of the existing Creator Opinions surface. The existing
`kolvex-frontend-web-nextjs/DESIGN.md` and runtime component/token owners remain
authoritative. No global visual-system change, replacement identity, new token,
or new primitive is required. `DESIGN.md`, `.impeccable/design.json` and other
system artifacts were preserved.

## Product behavior and source evidence

Paths in this report are relative to the repository root unless prefixed with
`kolvex-frontend-web-nextjs/` below.

- `kolvex-frontend-web-nextjs/app/dashboard/reddit-opinions/page.tsx` owns the
  transient community, search, sort and following-only state. Defaults are all
  stock communities, empty search, mentions and all tickers. Search supports an
  optional `$` and its localized clear action restores input focus. The visible
  showing/total count reflects the current loaded list and filters.
- `kolvex-frontend-web-nextjs/lib/redditOpinions.ts` defines the five supported
  communities (`all-stocks`, `wallstreetbets`, `stocks`, `investing`, `options`),
  validates provider rows and keeps absent baselines distinct from zero. Growth
  and rank-gain sorts place unknown comparisons after numeric declines; ties
  use original source rank. Source ranks do not change when the display sorts.
- `kolvex-frontend-web-nextjs/app/api/reddit-opinions/route.ts` validates the
  community before fetching, bounds the provider request to 12 seconds and
  caches each community's rows plus actual `fetchedAt` for five minutes.
  `page.tsx` uses `hooks/useCachedResource.ts` with separate
  `reddit:ranking:${community}` entries, five-minute freshness, one-hour maximum
  cache age and a 20-second client timeout. Refresh bypasses browser freshness
  but may receive a server-cached ranking.
- `kolvex-frontend-web-nextjs/hooks/useRedditWatchlist.ts` uses
  `kolvex:reddit-watchlist` in localStorage, validates saved values and listens
  for storage events. Saved follows persist in this browser. Following-only
  intersects those tickers with the loaded community ranking and search;
  off-board tickers remain saved. The toolbar saved count includes off-board
  follows. A storage failure preserves session use and displays the localized
  session-only notice. These follows do not imply account or holdings sync.
- Mobile native row disclosures preserve stock identity, mentions and change
  at first glance; full names, rank movement, upvotes and follow actions expand
  inline. Desktop retains the shared table and adds a follow action per row.
  Search spans the mobile toolbar, community and sort share two columns, and
  following-only sits beneath them. At md search spans a row above all three
  filters; at xl all four controls share one row.
- `kolvex-frontend-web-nextjs/lib/i18n/locales/zh.json` and `en.json` provide
  shared Chinese/English labels, number formatting, action names, empty states,
  storage notices and data explanations. Existing loading, empty-provider,
  search-empty, refresh-error and retry feedback remain. Follow-empty states
  and clear-filters recovery explain filtered results. Failed refreshes retain
  the prior ranking and fetch time for the same community.
- `kolvex-frontend-web-nextjs/components/layout/navItems.ts` still defines the
  YouTube and Reddit source links once. `OpinionSourceNav.tsx` and
  `DashboardLayout.tsx` retain the incumbent source navigation. The Reddit route
  keeps the Creator Opinions parent active.

The provider supplies a current snapshot and previous-24-hour baselines, not a
historical series. The footer retains source methodology and actual fetch time;
a closed native disclosure explains the data. Activity stays neutral and does
not communicate investment sentiment or a recommendation.

## Reusable primitives and tokens verified

| Role | Existing source verified | Reuse in the extension |
| --- | --- | --- |
| Theme colors | `kolvex-frontend-web-nextjs/app/globals.css`; `tailwind.config.ts` | Existing `background`, `foreground`, `card`, `border`, `muted`, `muted-foreground`, `secondary` and focus `primary` tokens support both themes; no activity color scale added. |
| Typography | `kolvex-frontend-web-nextjs/tailwind.config.ts`; `DESIGN.md` | Existing Inter/Chinese fallback stack, 24/32px heading, small labels and tabular figures. |
| Actions | `kolvex-frontend-web-nextjs/components/ui/button.tsx` | Existing pill ghost, outline and secondary variants; localized accessible names, pressed state and existing focus/disabled treatments. Refresh, clear and desktop follow controls use 40px boxes. |
| Search | `kolvex-frontend-web-nextjs/components/ui/input.tsx` | Existing 40px default Input with muted fill, 12px corners and semantic focus treatment; input ref supports clear-and-focus. |
| Community/sort | `kolvex-frontend-web-nextjs/components/ui/select.tsx` | Existing Radix Select, 40px trigger, 12px corners, semantic popup surface and keyboard selection. |
| Ranking | `kolvex-frontend-web-nextjs/components/ui/table.tsx`; `company-logo.tsx` | Existing table typography, tabular numbers, neutral borders/hover and shared company identities; mobile retains native details. |
| Navigation | `kolvex-frontend-web-nextjs/components/layout/navItems.ts`; `OpinionSourceNav.tsx`; `DashboardLayout.tsx` | Existing parent/source links and page shell, with no new sidebar destination. |
| Loading/cache | `kolvex-frontend-web-nextjs/hooks/useCachedResource.ts`; `lib/clientCache.ts` | Existing cached snapshots, distinct initial/background loading and retained data during recoverable refresh failures. |

## Documentation updated and bounded drift

Updated only the Creator Opinions feature paragraph in
`kolvex-frontend-web-nextjs/PRODUCT.md` and the `Reddit discussion ranking`
section in `docs/decision-workspace.md`. They now describe community scope,
sort/search semantics, local persistence, transient filters, responsive controls,
cache timing and data limits.

The pre-existing Reddit per-screen note in
`kolvex-frontend-web-nextjs/DESIGN.md` says that coverage counts and explanatory
notes are omitted. This extension deliberately introduces a filtered result
count, scope note and closed data disclosure so readers can interpret community
and follow filters without an expanded explanation above the ranking. That
sentence now lags the implemented feature. It was recorded here rather than
rewritten into global design guidance; the existing identity, shared primitives
and tokens remain unchanged. No unrelated documentation drift was repaired.

## Verification and practical limits

Directly reran from `kolvex-frontend-web-nextjs`:

```sh
node --test scripts/reddit-opinions.test.cjs scripts/cached-resource.test.cjs
```

All 17 tests passed. The first file covers normalization, absent baselines,
allowlisted sources, 400/502 responses, community cache separation, sorts,
search/follow intersections, saved-value parsing and existing navigation. The
second covers the shared cache hook's fresh visits, cache reuse, background
refresh/error retention and key/account isolation.

The final implementation passed TypeScript checking, scoped lint, all 17 tests
and the production Next.js build after the responsive toolbar correction.
At 768px, controls end at 736px within the viewport. The independent finish
review returned `ship` at component-harness scope and scored the toolbar fix
resolved. Its authoritative English phone capture is `mobile-en-dark-fresh.jpg`.

The owner also verified all five live community endpoints and exercised search,
sorts, community changes, follow persistence, clear focus, disclosure, loading,
failure and retry in an isolated browser component harness. The local full app
requires login, so these browser checks do not establish an authenticated full
AppShell journey. The screenshots and `finish-review.md` in this directory are
the separate visual evidence and review record; this handoff does not override
their final disposition. No deployment was performed.
