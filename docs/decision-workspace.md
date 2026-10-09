# Kolvex stock information workspace

Kolvex presents creator opinions, market data, AI analysis and linked holdings for users to read. The primary flow requires no personal opinion, plan, price threshold or review entry.

## Reader flow

1. Browse stock lists in Markets or Research and open a ticker.
2. Read current prices, recent creator calls, source videos, stated risks and available AI technical analysis.
3. Read published deep research without entering a ticker, selecting a model or supplying an API key. Missing published reports are explicitly marked unavailable.
4. Open Updates (`/dashboard/journal`, kept for link compatibility) for imported opinion changes and recent opinions. Switch between all stocks and linked equity holdings using buttons.
5. Portfolio automatically matches available creator updates to existing equity holdings.

Markets, Research and Updates do not show personal thesis prompts or ticker-entry forms. Ask Kolvex opens from the sidebar, header, or ⌘K. The question is sent as written. Opinions, quotes, and holdings already loaded on the page go to the model as evidence and appear in the composer as a removable label; they are not written into the conversation. Settings, authentication, brokerage linking and admin publishing remain operational controls rather than information-entry requirements for reading research. Existing chat URLs remain accessible.

## Sources and limits

- Opinion changes use the existing dashboard's daily average direction score, comparing the most recent covered date against the previous covered date. First opinions are labelled separately. Strength is displayed qualitatively.
- The Updates feed uses the catalogue's latest imported opinions and changes; it is not a complete event archive. Full opinion history remains in the YouTube explorer.
- Source dates are visible and each opinion links to its creator and original video.
- Failed loads display an error, never a healthy-plan status or an invented update.
- Updates are loaded when the page opens or refreshes. There is no new background monitor or push notification service.
- Technical analysis retains its chart action and uses the existing analysis endpoint. Published deep research uses the published-report endpoints. No new automatic paid analysis generation is introduced.

## Authoring and retained records

Research uses one primary navigation entry with two child views: Creator opinions
(`/dashboard/research`) and Deep Research (`/dashboard/research/deep-research`).
The latter shows published reports by default. Administrators can choose Manage
reports (`?view=authoring`) to access existing configuration and generation in
`components/trading-analysis/ResearchAuthoring.tsx`.

Legacy `/dashboard/trading-analysis` redirects to the authoring view, where readers
still receive only published reports; the legacy ticker parameter is preserved.
`/dashboard/trading-analysis/explore` redirects to the published library. Existing
report detail URLs remain supported. Published reports return to the deep research
library; authoring reports return to report management. Both desktop and mobile
navigation mark Research active on these retained detail URLs.

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
Research document titles follow the current locale. Shared navigation stays
usable during initial loading, empty lists and failed requests; retry remains in
the affected content. The existing 30-report page limit and stale-request guard
are retained. No additional external side effect occurs when changing views.

Personal thesis entry and comparison have been disconnected from the reader UI. Existing thesis API helpers, database records, version history and migrations are retained; no database deletion or migration is required for this change. Legacy individual research and chat routes remain available.

## Product measure

Measure whether users return to read new information: repeat visits to stock pages, creator opinion/source views, published report reading and holdings-related update views. Do not use personal thesis creation as the core product measure. Instrumentation is a separate task; this change does not claim these metrics are already collected.
