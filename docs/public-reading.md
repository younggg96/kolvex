# Public reading and search discovery

Anonymous readers enter through homepage research links, `/research`, `/creators`
or `/stocks`. Reports use `/research/{uuid}`. A stock page groups paginated
source-linked creator opinions and related published research. Creator links
retain `/share/creators/{channelId}`, whose content follows the latest imported
video; existing shared links keep working.

## Source and access rules

- The server calls existing public FastAPI routes under `/api/v1`: trading-analysis
  `public/list` and `public/{id}`, plus youtube-opinions `dashboard` and
  `creators/{channelId}/latest-video`.
- No auth cookie, user access token, service key or private analysis endpoint is
  used. Publishing remains an explicit existing author action. The frontend
  additionally checks `is_published === true` and `status === completed`.
- Server fetches are cached for 600 seconds under the `public-content` tag and
  use bounded timeouts. Publishing, withdrawing or deleting a report through the
  web proxy (`/api/trading-analysis/.../publish|unpublish`, `DELETE`) calls
  `revalidateTag`, so the page and sitemap update on the next request. A change
  made outside the web proxy (for example from the App directly against the
  backend) can stay visible for up to 600 seconds. IDs and tickers are
  validated before upstream reads. A real missing report is a not-found response;
  unavailable backends show a retryable error rather than fabricated content.
- Reading uses source text, dates, bylines and safe YouTube links. Reports are
  identified as AI-generated. Raw HTML from reports is not executed.
- No backend permission rules, database policies or authenticated routes change.

## Rendering cost

Every public reading route (`/stocks`, `/stocks/{ticker}`, `/research`,
`/research/{uuid}`, `/creators`, their `/page/{n}` variants,
`/share/creators/{channelId}` and `/sitemap.xml`) is ISR: rendered on first
request, then served from the CDN cache and revalidated at most every 600
seconds. Do not read `searchParams`, cookies or headers in these routes, and do
not reintroduce `force-dynamic` or `no-store`: that turns every crawler hit into
a Vercel Function render. On 2026-11-14 that pattern exhausted the Hobby Fluid
Active CPU allowance and paused deployments. Middleware skips the Supabase
session refresh for these paths; it only redirects legacy `?page=` links.

## Discovery

Titles, descriptions, self-referencing canonicals, article/breadcrumb structured
metadata and server-rendered body text accompany the public pages. Pagination is
20 items per URL with real links; pages 2+ use path URLs (`/stocks/page/2`,
`/stocks/NVDA/page/3`) and legacy `?page=N` links 308-redirect to them, while
`/page/1` redirects to the base URL. Lowercase ticker URLs permanently redirect to
their uppercase canonical. The `/sitemap.xml` walks all 100-report API
batches, includes creator and stock URLs and list pagination, and deduplicates
entries. Backend failure causes sitemap failure, rather than a misleading empty
successful sitemap. Split sitemaps before reaching 50,000 entries.

### AI search (GEO)

- `/llms.txt` (route handler, ISR 600s) lists the entry pages, the 30 stocks and
  creators with the most recorded opinions (with their real counts) and the 30
  latest published reports.
- Stock pages open with a data-backed summary built by `stockOpinionSummary`
  (`lib/publicSeo.ts`): recorded opinion and creator counts, bullish/bearish/
  neutral counts, the latest opinion's creator and date (page 1 only) and the
  published research count. It is also the meta description. With nothing
  recorded it falls back to the generic sentence; it never shows estimates.
- Stock and creator share pages emit a `CollectionPage` whose `ItemList` holds
  one `Comment` per opinion (creator as author, opinion date, summary, source
  video URL, ticker); missing fields are omitted. Research pages' `Article` also
  carries `about` (ticker), `inLanguage` and `isAccessibleForFree`.
- The shared root layout still renders `<html lang="en">`. `ReadingLayout` (used
  by `(public)` pages and creator share pages) sets `lang="zh-CN"` on its wrapper,
  and public reading paths also send `Content-Language: zh-CN` (`next.config.js`).
  Do not switch `<html lang>` from request headers in the root layout: that makes
  every page dynamic and undoes ISR.
- Creator share pages reuse bilingual components (`useCopy`), so the page and its
  error boundary wrap them in `FixedLocale locale="zh"` (`lib/i18n`); the server
  HTML is Chinese and matches hydration whatever the visitor's language setting.

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


## Shared visual system

Public research now uses the same `ResearchSummaryCard` as the authenticated
published library, including logos, qualitative decisions, metadata and grid
breakpoints. Creator/stock directories use the workspace's compact hover rows and
shared avatar/logo components. `StrengthIndicator` supplies the same qualitative
opinion styling to the workspace and public pages. `reader-styles.ts` centralizes
the contents grid, conclusion surface and link styling for both report readers.
The public header uses active route underlines, shared pill buttons and a localized
version of the existing theme toggle. Source data, publication checks, full server
HTML, canonical URLs and anonymous access remain unchanged.


Visual parity verification (2026-10-19): production build and 16 public-reading /
creator-sharing regression tests passed. Desktop and 390px mobile layouts were
inspected in both themes; header theme controls, keyboard route navigation and
native disclosures worked. Production browser checks recorded no console errors
or page-width overflow. Anonymous HTTP checks retained indexable canonical
metadata, full report HTML, valid pagination and 404 behavior. The sitemap still
contained 207 unique URLs. The Impeccable detector returned no findings for the
changed UI; the project-wide audit retains the previously documented three
unrelated settings/scrollbar findings. No deployment was performed.
