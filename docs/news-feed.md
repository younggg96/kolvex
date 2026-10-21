# Kolvex news stream

`/dashboard/news` is a native single-column headline feed. The reader explicitly
requested no category/search/Focus controls, FinancialJuice tags, detail panel,
mobile detail drawer or related-symbol section. There is one DashboardLayout
header, with pause/resume and refresh. No bookmark controls or storage hook.

## Source and API

- FastAPI `GET /api/v1/news/feed` reads FinancialJuice's public RSS endpoint
  `https://www.financialjuice.com/feed.ashx?xy=rss`.
- Next.js `/api/news` proxies it with a 15-second timeout and no-store responses.
  The configured backend URL remains unchanged.
- The feed is labelled delayed. No paid real-time entitlement, full article
  bodies, invented article text or AI analysis is provided.
- Parsing still validates HTTPS FinancialJuice `/News/` links, strips tracking,
  bounds downloads to 1 MB, rejects DTD/entity declarations, deduplicates IDs and
  returns at most 100 items. Process-local cache/coalescing uses a 60-second TTL,
  a 60-second retry cooldown and up to 15 minutes of explicitly stale fallback.
- The source remains traceable via the headline link. Publisher tags are omitted
  from the interface at the user's request.

## Reading and translation

- One date-grouped timeline on desktop and phones. Publication times use the
  reader's local timezone and Chinese/English formatting. Titles link directly
  to the source in a new tab. No row selection or secondary detail surface.
- Headlines automatically follow the active application language. English uses
  source titles; Chinese translates displayed titles with the existing
  `translateText` client and `/api/translate` service, without individual actions.
- `useNewsTranslations` limits concurrency to three, deduplicates identical text,
  and caches at most 1000 translations in memory. Cache keys use exact source
  text. Corrections and locale changes cancel old work; late results cannot
  replace the selected language. English switches back to originals immediately.
- Each translation pass has a 45-second timeout. Pending/failed entries retain
  readable originals. A page-level status explains progress or partial failure,
  and Retry requests only titles absent from the cache. Only the rendered window
  is translated; Show more automatically translates its additional rows.
- No bookmarks, saved-only filter, per-row actions or bookmark-storage access.
- Poll every 60 seconds while visible and unpaused. Visibility/reconnect rechecks and
  manual refresh reuse the existing hook. New items remain buffered behind a
  reveal action; corrections update in place. History stays bounded to 300.
- Render 40 rows initially, with explicit Show more. Errors preserve available
  content; initial loading, empty feed and retry have distinct
  states. Removed legacy category/search/focus URL parameters have no effect.

## Verification

- `node --test scripts/news-feed.test.cjs`: buffering/bounds, proxy responses,
  polling/cancellation; automatic locale selection, concurrency limit, duplicate
  title reuse, cache reuse, partial failure/retry, correction/locale cancellation
  and ignored late results.
- `npx tsc --noEmit`, targeted Next lint and production build verify integration.
- Backend parser/cache tests remain in `tests/test_news_feed.py`; backend source
  and the existing translation API are unchanged.
- Production smoke should confirm automatic Chinese with no Translate/Save
  controls, immediate English source display on language change, Chinese cache
  reuse, readable fallback/retry and 390px layout without horizontal overflow.
