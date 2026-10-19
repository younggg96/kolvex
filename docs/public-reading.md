# Public reading and search discovery

Anonymous readers enter through homepage research links, `/research`, `/creators`
or `/stocks`. Reports use `/research/{uuid}`. A stock page groups paginated
source-linked creator opinions and related published research. Creator links
retain `/share/creators/{channelId}`, whose content follows the latest imported
video; existing shared links keep working.

## Source and access rules

- The server calls existing public FastAPI routes under `/api/v1`: trading-analysis
  `published/list` and `published/{id}`, plus youtube-opinions `dashboard` and
  `creators/{channelId}/latest-video`.
- No auth cookie, user access token, service key or private analysis endpoint is
  used. Publishing remains an explicit existing author action. The frontend
  additionally checks `is_published === true` and `status === completed`.
- Server fetches use `no-store` and bounded timeouts. Withdrawing a report removes
  its public page and sitemap entry on the next request. IDs and tickers are
  validated before upstream reads. A real missing report is a not-found response;
  unavailable backends show a retryable error rather than fabricated content.
- Reading uses source text, dates, bylines and safe YouTube links. Reports are
  identified as AI-generated. Raw HTML from reports is not executed.
- No backend permission rules, database policies or authenticated routes change.

## Discovery

Titles, descriptions, self-referencing canonicals, article/breadcrumb structured
metadata and server-rendered body text accompany the public pages. Pagination is
20 items per URL with real links. Lowercase ticker URLs permanently redirect to
their uppercase canonical. The dynamic `/sitemap.xml` walks all 100-report API
batches, includes creator and stock URLs and list pagination, and deduplicates
entries. Backend failure causes sitemap failure, rather than a misleading empty
successful sitemap. Split sitemaps before reaching 50,000 entries.

The library's own copy is Chinese; supplied research stays in its original
language. This is one canonical public version, not a claimed pair of translated
locale routes. Account UI language preferences remain unchanged.

## Verification

`node --test scripts/public-reading.test.cjs scripts/creator-sharing.test.cjs`
checks input validation, anonymous requests, published-only visibility, upstream
failures, sitemap batching and existing source/share links. Production build and
browser checks should also cover anonymous list-to-detail navigation, the full
report body in server HTML, missing/withdrawn content, error retry, pagination,
mobile reflow, keyboard links and both themes. Local fixture verification must
be distinguished from checks against a running real backend.

After deployment, submit `/sitemap.xml` in Search Console and inspect representative
report, creator and stock URLs. Search indexing itself is controlled by the search
engine; no rank or traffic result is implied by these technical checks.


## Validation recorded on 2026-10-19

- Production build, TypeScript and lint completed. The build retains the existing
  VideoPlayer image warning and outdated browser-data notice.
- Sixteen focused public-reading and creator-sharing tests passed; simulated
  publication withdrawal and upstream failures are covered without changing real
  publication state.
- Anonymous HTTP/browser checks used the actual local FastAPI backend with its
  existing data: 16 published reports, 14 creators and 148 opinion-covered stocks.
  The generated sitemap contained 207 unique canonical URLs. Representative
  research, creator, stock and paginated pages returned 200 with indexable
  metadata and source content in server HTML. Missing reports returned 404.
- Backend downtime produced HTTP 500 for both research and the sitemap. Error
  retry reloads the current document to request fresh server data; the browser
  recovered the full 16-report list after the backend restarted.
- Light/dark desktop and 390px mobile views were inspected; the stock view had no horizontal
  page overflow. Real stock pagination reached page two without console errors.
- DESIGN.md lint reported zero errors. The strict project-wide UI audit retained
  three existing findings in dashboard settings and the global scrollbar styles;
  it reported no findings in the new public reading files. This change does not
  alter those unrelated settings/scrollbar implementations.

These are local checks; deployment and Search Console submission are separate.
