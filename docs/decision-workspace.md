# Kolvex stock information workspace

Kolvex presents creator opinions, market data, AI analysis and linked holdings for users to read. The primary flow requires no personal opinion, plan, price threshold or review entry.

## Reader flow

1. Browse stock lists in Markets or enter a stock code at the top of Markets to open `/dashboard/market/[ticker]`. Lookup trims whitespace, normalizes lowercase codes, and uses the same ticker validation as the detail route. It does not require creator coverage.
2. Read the K-line chart, latest related stock news, change summary, AI technical analysis and chart drawings, then creator distribution and historical views. The right rail contains the latest creator call and the user's linked position. Stock news loads independently with a 20-second client timeout and 15-second proxy timeout; updates run every five minutes while visible and on visibility/reconnect, with no overlapping requests. Refresh failures retain prior articles. Five headlines expand to the bounded returned list, sorted newest first and deduplicated by safe source URL. Chinese headline translation reuses the news terminal hook; available summaries remain in the source language. Source publication timestamps and local last-checked times are distinct. Verify with `node --test scripts/stock-news.test.cjs scripts/news-feed.test.cjs` and backend `python -m unittest discover -s tests -p test_yfinance_news.py`.
3. Browse Creator Opinions for stock and creator directories, weekly changes and creator views on linked holdings. Read published AI Research reports without entering a ticker, selecting a model or supplying an API key.
4. Open Updates (`/dashboard/journal`, kept for link compatibility) for imported opinion changes and recent opinions. Switch between all stocks and linked equity holdings using buttons.
5. Portfolio automatically matches available creator updates to existing equity holdings.

Markets, Creator Opinions, AI Research and Updates do not show personal thesis prompts. Markets offers an optional ticker lookup for direct stock navigation. Ask Kolvex opens from the sidebar, header, or ⌘K. The question is sent as written. Opinions, quotes, and holdings already loaded on the page go to the model as evidence and appear in the composer as a removable label; they are not written into the conversation. Settings, authentication, brokerage linking and admin publishing remain operational controls rather than information-entry requirements for reading research. Existing chat URLs remain accessible.

## Stock-page creator intelligence

`StockWorkspace` delegates 博主情报 / Creator Intelligence to
`components/decision/CreatorIntelligence.tsx`. Its three sentiment cards show
看多 / bullish, 中性或分歧 / neutral or mixed, and 看空 / bearish creators.
`latestCreatorOpinions` in `lib/decision.ts` selects one latest opinion per
channel in the past 30 days, excluding invalid and future dates. The cards and
`creatorEvidence` use this same set, so a prolific channel counts once. Each
group starts with three creators and can expand independently. An empty recent
group does not imply that the stock has no historical opinions.

The timeline uses every opinion supplied by the stock detail response, ordered
newest first, including opinions older than the card window. It starts with the
seven most recent covered dates and can expand to all covered dates. A selected
older date remains visible when the dates are collapsed. The newest opinion is
selected initially. Selecting a date opens that day's newest opinion; the day's
creator chips select individual opinions. Selecting a creator card opens that
creator's latest opinion and moves focus to the inline reading region.

The reading region shows attribution, date, qualitative direction, full supplied
summary, a distinct thesis, key points and risks. Supplied time horizon and
confidence are also shown. The creator links to its directory view and the
original video opens through the source link when available. Missing summary
and thesis use a source-reading message. The Full record link opens the stock's
existing opinion explorer; the timeline represents loaded history rather than a
claim to a complete archive.

The cards stack until the component's content container reaches 42rem, then use
three columns. Dates scroll horizontally and creator chips wrap. Selection
buttons expose pressed state and their controlled reading region; group and date
expansion controls expose expanded state. The component uses existing translated
labels, semantic theme tokens and visible keyboard focus. Reduced-motion
preferences govern the card-to-reader scroll. Loading shows skeletons, a failed
opinion request shows an error with retry, and missing opinions show a browse
creators action and explain that AI analysis and research remain available. Changing the ticker resets this component's selection and
expansion through its keyed mount.

## Latest creator video feed

The YouTube overview's 博主最新视频 preview uses `latest_videos` from the dashboard
API: select each creator's newest imported video from the complete dataset, sort
by source publication time and show at most five creators. A video containing
many stock opinions occupies one entry. Publication time, rather than import time,
controls order; a missing instant falls back to the opinion's calendar date.

`GET /youtube-opinions/videos` returns complete video groups and video-count
pagination. The existing `/dashboard/youtube-opinions/opinions` route consumes
20 videos per request. Grouping precedes slicing, so every stock from a video
remains available even if that video contains more opinions than a page size.
This full list includes each creator's older videos. `VideoOpinionCard` owns
creator/source attribution, compact/full layouts, stock navigation and explicit
expansion. Existing ticker and creator history APIs retain individual-opinion
pagination. Deploy the backend feed and dashboard field before the frontend.

Verification: backend `python -m unittest discover -s tests -p test_youtube_video_feed.py`
covers complete large videos, distinct creators, source-time order, empty pages,
public read access and pagination validation.

## Sources and limits

The creator stock directory pairs each stock's latest source-attributed thesis or
summary with price data, the existing historical opinion average, and recent
evidence. Rows default to a compact summary with a separate, labelled disclosure.
Each row independently expands to full source reasoning, price periods and
evidence; expanding does not navigate or start a history request. Source
actions live inside the expansion.
The API adds a creator distribution using each channel's latest call in
the 30 New York calendar days ending today. Neutral and mixed share one bucket;
invalid, future and older opinion dates do not count. Seven-day discussion heat
counts opinions by publication day, compared with the preceding seven calendar
days. A first covered date is distinct from a score change. Daily average changes
do not claim that the same creator changed their mind.

Directory readers can sort by heat, strengthening, weakening and first coverage.
Search, direction, scope and sort persist in the URL. The full stock directory
loads 40 rows at a time. Holdings filtering remains subject to the existing portfolio
feature flag and uses the shared holdings loader.

### Reddit discussion ranking

The Creator Opinions entry has YouTube and Reddit child routes defined once in
`components/layout/navItems.ts`. `DashboardLayout` supplies the mobile source
links through `OpinionSourceNav`, including on nested YouTube routes. Reddit
keeps the same parent navigation item active at `/dashboard/reddit-opinions`.

`app/api/reddit-opinions/route.ts` requests ApeWisdom's first stock-ranking page
through a same-origin endpoint. The `community` query accepts only `all-stocks`
(default), `wallstreetbets`, `stocks`, `investing` and `options`; unsupported
values return 400 before any provider request. `lib/redditOpinions.ts` validates
and normalizes rows, preserving absent history. The server caches each community's
rows, community identifier and actual `fetchedAt` together for five minutes.
`hooks/useCachedResource.ts` uses a separate `reddit:ranking:${community}` browser
cache entry, a five-minute freshness period and one-hour maximum cache age. A
community change never displays another community's rows. Refresh bypasses browser
freshness but can return the server-cached bundle, so it does not imply a fresh
provider fetch.

Search trims whitespace, ignores case and accepts an optional leading `$`,
filtering only the loaded top-100 ticker/name results. Its localized clear action
returns focus to the search input. Sorts use descending mentions, mention
percentage growth, rank gain or upvotes, breaking ties by source rank without
renumbering the rows. Missing comparison baselines sort after every numeric
comparison, including declines. Mention change compares current and previous
24-hour counts; zero or missing prior mentions have no percentage baseline.
Missing prior rank is labelled new, and rank movement compares the previous rank
with today's. Upvotes remain a separate provider count. These snapshots do not
provide a historical time series.

`hooks/useRedditWatchlist.ts` saves followed tickers in browser localStorage under
`kolvex:reddit-watchlist`, validates stored values and syncs storage events across
tabs. The following-only filter intersects saved tickers with the current
community's loaded ranking and search; leaving that ranking does not remove a
saved ticker. The toolbar count is the total saved ticker count, not the count
currently visible. Follows are device/browser-local, separate from brokerage
holdings and account sync. If storage is unavailable, follows remain usable for
the page session and a localized notice explains the limit. Search, sort,
community and following-only state are intentionally transient page state;
only followed tickers persist.

Below md, the ranking uses native `details` rows: rank, shared company logo,
ticker, truncated company name, mentions and signed percentage change remain
visible. Touch or keyboard expansion reveals the full company name, rank
movement, upvotes and follow action. From md, all fields and per-row follow
controls appear in the table. Missing percentage baselines display an em dash.
The short title and accessible icon-only refresh action precede the shared Input,
community and sort Selects, and following-only Button. On phones search spans
the toolbar width, community and sort share two columns, and following-only sits
below. From md search occupies a full row above the three filters; from xl all
controls share one row. Scope and showing/total result counts explain what the
filters include. The compact footer links to ApeWisdom's methodology and shows
the actual fetch date/time; a closed native data disclosure explains the 24-hour
comparison and activity limits. Discussion activity uses neutral colors and is
not an investment direction or recommendation. Chinese/English formatting,
accessible action labels and data semantics are shared across both layouts.

Initial loading, unavailable data, an empty provider list, no search matches,
no saved follows and no followed matches have distinct feedback. Empty filtered
results offer a clear-filters action. A failed refresh retains the previous
ranking and its fetch time with an error and retry action.

Verification: from `kolvex-frontend-web-nextjs`, run `node --test
scripts/reddit-opinions.test.cjs scripts/cached-resource.test.cjs`. These cover
provider normalization, baseline and sort semantics, search/follow intersections,
storage parsing, community validation/cache separation, source navigation and
shared cache loading/error behavior. Implementation and browser verification
evidence is recorded in `artifacts/reddit-features-20261029/documentation.md` at
the repository root.

### Creator and market sources

- Opinion changes use the existing dashboard's daily average direction score, comparing the most recent covered date against the previous covered date. First opinions are labelled separately. Strength is displayed qualitatively.
- The Updates feed uses the catalogue's latest imported opinions and changes; it is not a complete event archive. Full opinion history remains in the YouTube explorer.
- Source dates are visible and each opinion links to its creator and original video.
- Creator opinion dates use `America/New_York` across cards, date filters, timelines and chart markers. The shared formatter is `lib/opinionDates.ts`. Publication instants come from the YouTube Data API; calendar labels never shift with the viewer's timezone.
- Creator history's video view includes the latest untracked uploads from coverage.
  Videos without opinions are hidden by default and can be revealed with the labelled
  count control. They show source metadata without opinion rows or stock counts.
  Date filters apply to uploads; sentiment filters show only videos with matching opinions.
- The creator-page Share action opens one dialog for public links, complete share text, social platform composers, email and native sharing. Public `/share/creators/[channelId]` links require no sign-in and follow the latest imported video. Images are a tab within this flow, generating source-attributed PNGs from that video's complete set of stock summaries. Long summaries continue across numbered images. Readers preview and save each image or explicitly open device sharing; opening the dialog does not publish anything.
- Share images follow the active website theme. The image renderer snapshots inherited CSS tokens and computed typography from the preview, shares LogoIcon's brand asset, and uses the same qualitative strength labels and three-step meter as opinion rows. Switching light/dark mode regenerates the image.
- Failed loads display an error, never a healthy-plan status or an invented update.
- Updates are loaded when the page opens or refreshes. There is no new background monitor or push notification service.
- Technical analysis retains its chart action and uses the existing analysis endpoint. Latest stock news uses the yfinance market endpoint and links to its publisher. Published AI Research uses the published-report endpoints. No new automatic paid analysis generation is introduced.

## Authoring and retained records

Creator Opinions (`/dashboard/youtube-opinions`) now owns the former Research
overview and the existing YouTube explorer. AI Research (`/dashboard/ai-research`)
shows published reports by default. Administrators can choose Manage reports
(`?view=authoring`) to access existing configuration and generation in
`components/trading-analysis/ResearchAuthoring.tsx`.

Legacy `/dashboard/trading-analysis` redirects to the authoring view, where readers
still receive only published reports; the legacy ticker parameter is preserved.
`/dashboard/trading-analysis/explore` redirects to the published library. Old
`/dashboard/research` routes redirect to Creator Opinions, Markets stock detail,
or AI Research as appropriate. Existing report detail URLs remain supported.
Published reports return to the AI Research library; authoring reports return to
report management. Desktop and mobile navigation mark AI Research active on those
retained detail URLs, and Markets active on its stock detail route.

## Canonical UI map

The frontend visual contract is `kolvex-frontend-web-nextjs/DESIGN.md`. The following
owners govern the research workflow; this navigation change does not alter the
backend report lifecycle, publishing permissions or paid generation behavior.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Scrollbar | `app/globals.css` | DESIGN.md | Existing application content scrollers | Browser layout and computed style |
| Select/Listbox | `components/ui/select.tsx` | Existing report authoring controls | Authored Radix select | Retained controls; build and keyboard review |
| Date | `components/ui/calendar.tsx` | Existing report authoring controls | Authored calendar | Retained zh-CN/en-US date behavior |
| Toast | Sonner provider and existing report handlers | Existing authoring workflow | Success and error | Existing regression checks and build |
| CRUD | `lib/tradingAnalysisApi.ts` and existing backend authorization | PRODUCT.md and report APIs | Reader library; administrator authoring | Reader/admin routing, report return navigation |

Route links have native link keyboard behavior, visible focus, translated names
and `aria-current`. In-page report panels retain the existing Radix tab model.
AI Research document titles follow the current locale. Shared navigation stays
usable during initial loading, empty lists and failed requests; retry remains in
the affected content. The existing 30-report page limit and stale-request guard
are retained. No additional external side effect occurs when changing views.

Personal thesis entry and comparison have been disconnected from the reader UI. Existing thesis API helpers, database records, version history and migrations are retained; no database deletion or migration is required for this change. Legacy individual research and chat routes remain available.

## Product measure

Measure whether users return to read new information: repeat visits to stock pages, creator opinion/source views, published report reading and holdings-related update views. Do not use personal thesis creation as the core product measure. Instrumentation is a separate task; this change does not claim these metrics are already collected.

## User-requested stock analysis and history

Chart AI analysis and drawing requests now submit durable, user-owned jobs through
`/market/chart-jobs/{ticker}` and return 202 immediately. A backend worker claims
queued jobs atomically, loads that user's configured provider key at execution time,
and saves the immutable result, current history pointer and completed job in one
transaction. The queue contains request settings and safe error codes, never API
keys or access tokens. Same-request retries and concurrent submissions on one
user/ticker reuse the existing job. Each user may have at most three active tickers.

The frontend restores pending jobs on entry and polls only while a task is pending;
focus/reconnection also refreshes status. Closing the chart stops polling without
cancelling the server task. Submission, queue, running, timeout, interruption and
configuration failures have visible localized feedback near the chart controls.
A status outage retains the pending state and offers Check status. Failed jobs are
terminal and require an explicit retry; a worker restart never silently repeats a
possibly billed model request. Running jobs expire after ten minutes, queued jobs
after twenty minutes, and model generation has an eight-minute deadline.

The October 9 request adds explicit analysis generation to the stock workspace.
It is an explicit exception to the earlier reading-only stock-page contract;
public report publishing and the administrator report-management UI retain
their existing behavior. No analysis runs just by opening a stock.

A click on Generate analysis or Update analysis runs the visible chart window,
saves the validated result, indicators, view, all AI drawing anchors, request
parameters and original OHLCV bars, then makes it current. Failed generation or
saving leaves the previous current version intact. The date list has pages of
10 and an explicit older-record action. Viewing a historical version displays
a historical-view notice, original bars and drawings without changing the
pointer. Set as current explicitly switches the pointer with a compare-and-swap
check; a conflict reloads the newest pointer before allowing another attempt.

Generate AI research uses the authenticated user's existing background research
API, covering fundamentals and news. Completed jobs are captured by a database
trigger in the same transaction, including jobs started from existing authoring
routes. A page reload resumes polling pending/running jobs. Previous reports
remain readable during generation. The full snapshot remains available even
if the original job record is deleted. Missing creator evidence offers a link
to the existing creator directory rather than generating source opinions.

Database ownership: `stock_analysis_versions` holds immutable, user-owned
technical/drawings/research snapshots; `stock_analysis_heads` holds one current pointer
per user, stock and kind. Snapshots enable signed-in shared read RLS; current pointers retain own-user read policies. Browser
clients cannot write snapshots or invoke switching RPCs directly. Authenticated
backend routes derive owner identity from the verified session, and switching
functions verify stock and owner. Save and switch are atomic database operations.

Canonical owners remain shared Button, native details, the existing content
scroller, authored Radix chart interval select, and localized inline status/error
feedback. The CRUD variant is the dated immutable list owned by AnalysisHistory,
using `lib/stockAnalysisHistory.ts` and market API routes. Verification is in
`tests/test_stock_analysis_history.py`,
`supabase/tests/stock_analysis_history.sql`, and
`scripts/stock-analysis-history.test.cjs`.

### Separate AI analysis and AI drawings

The follow-up request separates text analysis from chart drawing actions.
`operation=analysis` saves to the `technical` channel and updates the written
report only. `operation=drawings` saves to the `drawings` channel and updates
only chart overlays. The drawing operation uses levels/structure focus and
ignores text-analysis category/custom-question selections. Cache entries are
also separated by operation. Compact and advanced charts, and stock-page empty
states, expose separate buttons and independent result/history handling.

`20261009104736_separate_ai_analysis_and_drawings.sql` adds the drawing channel,
preserves earlier combined snapshots in both histories, and maps each former
current snapshot to a current drawing snapshot. Existing snapshot IDs and text
analysis history remain intact. Save and restore operate on one kind at a time,
so generating or restoring analysis cannot replace the current drawing version.

## Daily briefing reader

The follow-up request adds Daily Briefs to the primary desktop/mobile navigation.
Administrator imports now become readable immediately by signed-in users at
`/dashboard/briefs`; writing remains administrator-only. The date/type library
and immutable `/dashboard/briefs/{id}` articles reuse the same stored documents
and `BriefContent` as admin preview. Type and page remain in URL state, and
return navigation restores them. The reader API selects editorial metadata and
payload only, requires verified authentication, and exposes no write routes.
Database browser grants remain unchanged.

## Stock workspace layout

The stock workspace uses one reading column at every viewport: header, chart,
then one unified insight panel. Its shared Radix tab list contains Summary,
Technicals, Setup, News, Creator intelligence and AI research. Setup remains
available with an explicit empty state when there is no generated setup.
Panels stay mounted and inactive panels use display:none to retain reader state.
The chart and generation hooks remain outside tabs. Selection resets per ticker.
The existing main element owns vertical scrolling; reports have natural height.
All tab labels and empty-state actions support Chinese and English.

### Shared AI results (October 25)

All saved technical analysis, AI drawings and completed AI research results,
including existing versions, are readable by every signed-in user. The stock history service
returns author profile names and a server-derived `is_owner` flag. History is
server-paginated (10 per page), newest first, with Everyone / Mine filters.
Default selection uses the viewer's current pointer, then their newest snapshot,
then the newest snapshot from any author. Filters reset pagination and cancel
stale requests. Explicitly generated results become the viewer's current version.

Read-only viewing of another user's result never changes their pointer. Only an
owner can generate, restore their own version, or manage their research jobs.
The database continues to restrict writing snapshots and calling mutation RPCs
to the backend. Job status, original manual drawings and current pointers retain
their existing access rules. Legacy published research URLs now list all completed
research, regardless of the old publish flag; the publish/unpublish toggle is
removed, and the unpublish endpoint rejects attempts to make shared results private.
