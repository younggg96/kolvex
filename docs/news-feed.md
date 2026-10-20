# Kolvex news terminal

`/dashboard/news` is a native Kolvex terminal inspired by FinancialJuice's dense
headline workflow. It uses Kolvex components, themes, localization and navigation.

## Source and API

- The backend `GET /api/v1/news/feed` reads FinancialJuice's public RSS URL:
  `https://www.financialjuice.com/feed.ashx?xy=rss` (linked in its website footer).
- RSS supplies titles, publication times, original links and IDs. It does not
  supply the website's editorial classifications, Market Moving rating, paid
  real-time entitlement or reliable full article bodies.
- The parser returns at most 100 items, deduplicates by provider ID, strips link
  tracking parameters, accepts only HTTPS FinancialJuice `/News/` links, rejects
  DTD/entity declarations and bounds downloads to 1 MB. Only explicit `$TICKER`
  mentions become related-symbol links.
- Process-local cache and request coalescing limit upstream requests to once per
  60 seconds per backend process. Failed fetches have a 60-second cooldown; the
  last successful result may be served with `stale: true` for up to 15 minutes.
  Thereafter, or without cached data, the endpoint returns 502.
- Next.js `/api/news` proxies this endpoint with a 15-second timeout and no-store
  responses. No new API key, database migration or production package is needed.
  Deploy the backend route together with the frontend; the existing
  `NEXT_PUBLIC_BACKEND_API_URL` must point to that backend.

## Terminal behavior

- Desktop: category rail, dense timestamped feed, headline details pane.
  Smaller screens: horizontal filters and an accessible details drawer.
- Categories and Focus are local English keyword rules, explicitly labelled as
  such, and can overlap. They are not FinancialJuice editorial tags or predictions.
- Searches cover loaded titles, publisher and explicit tickers. Bookmarks store
  up to 500 IDs on the current device; saved filtering covers the loaded window,
  not an independently persisted article archive.
- Poll every 60 seconds while visible and unpaused. Visibility/online recovery
  triggers a check. Pause stops automatic checks; manual Refresh remains available.
  An already-running request can finish after pause, but new items remain buffered.
- New headlines appear behind a count/button so the reading position stays fixed.
  Existing headline corrections update in place. Revealing pending headlines sorts
  newest first and retains up to 300 items. Show more renders 40 additional rows.
- Refresh errors preserve visible content and show an error; stale backend results
  also show a warning. Initial loading, empty filters and retries have distinct UI.
- Details show original source, timestamp, rule categories, bookmark action and
  related links to the existing stock workspace. No invented body or AI analysis.
- The terminal always identifies the feed as delayed; polling does not imply
  real-time delivery or guaranteed upstream latency.

## Validation

- `node --test scripts/news-feed.test.cjs` in the frontend: buffering, corrections,
  bounded history, classification/filtering, polling pause/resume/visibility, request
  cancellation and proxy success/failure semantics.
- `python -m unittest discover -s tests -p test_news_feed.py` in the backend:
  source normalization, hostile links/XML, limits, concurrent cache access,
  retry cooldown, stale fallback and expiration. Requires existing `httpx`.
- `npx tsc --noEmit` and targeted `next lint` for the news files.
- The backend service fetched and parsed live public RSS during development
  (100 items, delayed delivery, non-stale response). The connected browser could
  not reach the development server (connection refused), so visual and signed-in
  end-to-end verification remain pending. A deployment
  smoke test should verify the authenticated dashboard at desktop/mobile widths,
  real backend connectivity, theme switching and drawer keyboard focus.

This replaces the earlier draft's Yahoo symbol aggregation. The existing stock
news API is unaffected. No embedded widget, private endpoint, account token or
paid feed is used.
