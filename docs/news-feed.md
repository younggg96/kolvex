# Kolvex news stream

`/dashboard/news` is a native single-column headline feed. The reader explicitly
requested no category/search/Focus controls, FinancialJuice tags, detail panel,
mobile detail drawer or related-symbol section. There is one DashboardLayout
header, with saved-only filtering, pause/resume and refresh.

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
- Each headline has an explicit Translate / Show original action, reusing
  `useContentTranslation` and `TranslateButton` from AI Research, the existing
  `translateText` client and `/api/translate` service. Current zh/en UI modes
  follow the existing report behavior: translate source headlines into Chinese.
- Nothing is translated until requested. While translating, source text remains
  visible. The existing hook provides a 45-second timeout, cancellation on
  unmount/source change, stale-result protection and in-row cached switching.
  Failure preserves source text with a retry hint. Corrections invalidate the
  previous translation. Translation is display-only and not saved to articles.
- Device-local bookmarks store at most 500 IDs. Saved-only filtering covers the
  loaded feed window, not an independent archive. Storage failures are visible.
- Poll every 60 seconds while visible and unpaused. Focus/reconnect rechecks and
  manual refresh reuse the existing hook. New items remain buffered behind a
  reveal action; corrections update in place. History stays bounded to 300.
- Render 40 rows initially, with explicit Show more. Errors preserve available
  content; initial loading, empty feed, empty bookmarks and retry have distinct
  states. Removed legacy category/search/focus URL parameters have no effect.

## Verification

- `node --test scripts/news-feed.test.cjs`: feed buffering/bounds, proxy success
  and failure, pause/visibility/cancellation, explicit translation/cache toggles,
  retry preserving originals, and correction/unmount cancellation.
- Backend parser/cache tests remain in `tests/test_news_feed.py`.
- `npx tsc --noEmit`, targeted Next lint and production build verify integration.
- The original release deployed PR #31 (merge 92229e7) to Vercel and Railway;
  both live endpoints returned HTTP 200 with 100 non-stale delayed headlines.
- This simplification follows the user's screenshot feedback. Production smoke
  should confirm one heading, no removed panels/tags, real translated headlines,
  switching to the original, bookmarks and 390px responsive layout.
