# Web → React Native migration ledger

Observed sources: `../kolvex-frontend-web-nextjs` and `../kolvex-backend-py`; no native host app was found. This is a sibling Expo client, not a brownfield replacement or retirement of an existing native binary. The user requested continuing the mobile port with the existing product content and native glass styling.

## Implemented application flows

| Existing product               | Mobile route                       | Data / parity                                                                                                                                     |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markets                        | `/` → `/stock/[symbol]`            | Quote, daily history, company, selected financial metrics, stock news; missing values stay unavailable                                            |
| YouTube opinions               | `/opinions`, YouTube               | Ticker/direction filters, 20-item pages, attributed summaries, source video, stock detail                                                         |
| X source content               | `/opinions`, X                     | Ticker filter, 20-item pages, creator identity, quotes, truncation notice, source                                                                 |
| Reddit ranking                 | `/opinions`, Reddit                | Existing parser/sort logic, five communities, mentions/baselines, search, saved-only scope, source/fetch time                                     |
| AI research                    | `/research` → `/report/[id]`       | Signed-in completed report library and full textual reports/debates; no administrator generation UI                                               |
| Daily briefs                   | `/briefs` → `/brief/[id]`          | Signed-in filters/pagination, full section content/images/sources, uploaded Chinese translation                                                   |
| News terminal                  | `/news`                            | Virtualized delayed feed, source links, fetch time, stale-data label; source title if no translated field                                         |
| Authentication                 | `/account`                         | Supabase password sign-in/sign-up, email-verification messaging, secure native session, app-state refresh, profile read/write and device sign-out |
| Watchlist                      | `/watchlist`, stock detail, Reddit | Guest local list; authenticated `user_watchlist` under existing RLS, individual insert/delete, serialized guest writes, no guest auto-import      |
| AI chat                        | `/chat` → `/chat/[id]`             | Existing conversations, creation, streaming/stop/reconcile, selected data sources, removable current-turn quote evidence                          |
| Portfolio                      | `/portfolio`                       | Existing connected account/position reading; option metadata and underlying links; no order execution                                             |
| Navigation / system appearance | Five tabs + native stack           | Markets, Opinions, Research, Watchlist, More; glass, fallback, system type/theme and transparency preference                                      |

## Remaining parity and release work

- Native technical K-line chart, advanced indicators/drawing tools, AI drawing generation, financial statement charts/exports, earnings/analyst/options modules and macro workspace.
- Creator profile/directory/history and video-level non-stock summaries; X profile detail; Updates / holdings-scoped opinion changes.
- Native Plaid Link authorization, connection/disconnection, transaction screens, portfolio history/AI analysis and privacy/sharing settings. Existing holdings are readable; new connections remain on web.
- OAuth/deep-link account recovery, full English UI, user-selectable model/provider configuration and report creation/admin CRUD.
- Binary build/signing, distribution, native device QA, VoiceOver/TalkBack, Dynamic Type, real authenticated-account acceptance and store release.

No business ROI, release date or complete platform parity is claimed. Real public API success and negative auth checks were observed; private success paths require an authenticated test account and native behavior requires device evidence. No schema or RLS grants were changed during this port.
