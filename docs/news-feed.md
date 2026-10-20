# Dashboard news feed

`/dashboard/news` restores a dedicated news entry in desktop and mobile navigation.
The page aggregates the existing backend `/api/v1/market/news/{symbol}` endpoint,
which supplies Yahoo Finance headlines. It does not embed FinancialJuice or depend
on its private endpoints.

## Behavior

- Presets select market ETFs, technology, consumer, or crypto symbols. These are
  symbol groups, not editorial classifications. Users can supply 1–4 symbols.
- The Next.js `/api/news?symbols=SPY,QQQ,DIA` route validates input, fetches each
  symbol with a 15-second timeout and 60-second upstream revalidation, normalizes
  HTTP(S) source URLs, deduplicates articles, and sorts newest first.
- Partial failures retain successful results and list unavailable symbols. Total
  failure returns 502; an empty successful response is distinguished from failure.
- While visible and unpaused, the page checks every 60 seconds. Hidden tabs stop
  polling; visibility/online recovery triggers a check. Changing symbols cancels
  the old request and resets the feed.
- Incoming headlines wait behind a new-headlines button so reading position is
  preserved. Refresh failure retains loaded items. The session retains up to 300
  articles; search and Show more operate on loaded headlines only.
- Headline links open the publisher in a new tab. Symbol links open the existing
  stock workspace. Chinese/English and light/dark themes follow the app settings.

## Data and release checks

No new API key, database migration or dependency is required. The existing
`NEXT_PUBLIC_BACKEND_API_URL` must point to a running Kolvex backend. Results and
coverage depend on the existing Yahoo Finance source (currently up to 8 headlines
per symbol per request). This is a periodically refreshed latest-news window,
not a complete historical archive or a low-latency breaking-news service.

Automated checks: `npx tsc --noEmit`, targeted `next lint`, and
`node --test scripts/news-feed.test.cjs`. Tests cover validation, safe source links,
deduplication, stable reading order, partial/total failures and empty responses.
Before release, verify actual provider responses and the authenticated dashboard
on desktop/mobile in the deployment environment; these were not exercised locally.
