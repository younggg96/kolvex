# Kolvex stock information workspace

Kolvex presents creator opinions, market data, AI analysis and linked holdings for users to read. The primary flow requires no personal opinion, plan, price threshold or review entry.

## Reader flow

1. Browse stock lists in Markets and open a ticker under `/dashboard/market/[ticker]`.
2. Read the K-line chart, change summary, AI technical analysis and chart drawings, then creator distribution and historical views. The right rail contains latest stock news, the latest creator call and the user's linked position.
3. Browse Creator Opinions for stock and creator directories, weekly changes and creator views on linked holdings. Read published AI Research reports without entering a ticker, selecting a model or supplying an API key.
4. Open Updates (`/dashboard/journal`, kept for link compatibility) for imported opinion changes and recent opinions. Switch between all stocks and linked equity holdings using buttons.
5. Portfolio automatically matches available creator updates to existing equity holdings.

Markets, Creator Opinions, AI Research and Updates do not show personal thesis prompts or ticker-entry forms. Ask Kolvex opens from the sidebar, header, or ⌘K. The question is sent as written. Opinions, quotes, and holdings already loaded on the page go to the model as evidence and appear in the composer as a removable label; they are not written into the conversation. Settings, authentication, brokerage linking and admin publishing remain operational controls rather than information-entry requirements for reading research. Existing chat URLs remain accessible.

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
creators action. Changing the ticker resets this component's selection and
expansion through its keyed mount.

## Sources and limits

- Opinion changes use the existing dashboard's daily average direction score, comparing the most recent covered date against the previous covered date. First opinions are labelled separately. Strength is displayed qualitatively.
- The Updates feed uses the catalogue's latest imported opinions and changes; it is not a complete event archive. Full opinion history remains in the YouTube explorer.
- Source dates are visible and each opinion links to its creator and original video.
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

The October 9 request adds private analysis generation to the stock workspace.
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
technical/research snapshots; `stock_analysis_heads` holds one current pointer
per user, stock and kind. Both enable RLS with own-user read policies. Browser
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
