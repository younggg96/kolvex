# Mobile UI contract

## Business evidence

- `../kolvex-frontend-web-nextjs/PRODUCT.md`: Chinese-first source-attributed reading, no fabricated returns/creators, retired features excluded.
- `../kolvex-backend-py/app/api/routes/{briefs.py,chat/routes.py,trading_analysis/routes.py,portfolio/holdings_routes.py,users.py}`: authenticated reading and account-owned mutations.
- `../kolvex-backend-py/supabase/migrations/20261030220455_user_watchlist.sql`: existing account-owned select/insert/delete RLS and ticker validation.
- `../kolvex-frontend-web-nextjs/components/auth/AuthForm.tsx`: existing email/signup password policy.
- `../kolvex-frontend-web-nextjs/lib/{dailyBriefs.ts,redditOpinions.ts,chatApi.ts}`: content, comparison and SSE semantics.

## Canonical ownership

| Capability               | Owner                                       | Observable contract                                                                                                               |
| ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Navigation               | Router Stack + NativeTabs, web Tabs adapter | Five fixed tabs, stack back, More hub; private screens remain reachable through an auth gate                                      |
| Theme / type / feedback  | `UI.tsx`, `theme.ts`                        | System theme, scalable type, 44pt controls, inline failure/retry, explicit empty/loading                                          |
| Long lists               | `UI.ListPage`                               | Native virtualized news/watchlist, system scroll indicators, safe-area clearance                                                  |
| Form / selection         | Content Field / Filters                     | Labels, password masking/toggle, local validation, submit locking, native text entry and selected states                          |
| Search / pagination      | UI Search / Content Pager                   | Clear action and focus return; explicit committed remote filters; stale reads cancelled; no automatic duplicate writes            |
| Authentication           | Auth provider / AuthGate                    | Existing Supabase public-client auth, secure native storage, foreground refresh; no service keys; account-bound private transport |
| Async / private requests | `useResource`, `http.ts`                    | Abort and bounded reads; late previous-account results rejected; 401/403 remain explicit; no mutation auto-retry                  |
| Session storage          | `secureStorage.ts` + SecureStore            | Unicode-safe encrypted chunks, manifest commit after durable chunks, serialized writes and deletion                               |
| Watchlist                | Watchlist provider + existing RLS           | Guest local; cloud user-scoped reads/insert/delete, pending and failures; no implicit guest merge                                 |
| Chat                     | stream parser + chat route                  | Full UTF-8/SSE blocks, stop available, no assumed rollback, reconcile history before sending again after uncertain completion     |
| Sources / documents      | SourceLink / TextBody / EditorialImage      | HTTPS only, no embedded credentials or HTML execution; article/source text is data                                                |

## Account and data boundaries

Auth state changes remount the account-scoped screen subtree. Private read hooks mount only behind AuthGate. No private data is persisted in a shared local cache. API tokens are added only to trusted relative FastAPI paths and never to source URLs or Reddit requests. Cloud mutations use the captured user ID and existing RLS; metadata is not used to grant rights.

Portfolio is read-only on mobile. No brokerage authorization, orders, public-sharing changes, admin writes or costly research-generation action is added. Signup is a user action; implementation/verification did not create real accounts or send real AI questions.

Dates that are calendar-only remain unchanged. Market amounts retain source currency/unit. Missing values remain unavailable, and demo quotes are never a fallback for real API failures. Native-device verification and authenticated success-path acceptance remain outstanding as recorded in VERIFICATION.md.

## Native financial reading

StockResearch owns annual/quarterly statement selection, native SVG chart/matrix, compact M/B/T display with exact CSV/accessibility values, explicit reporting currency, loss-aware EPS outcomes and source analyst targets. The root router anchors deep links to the main tab group so readers retain a way back. Reddit reads a fixed allowlisted public FastAPI proxy; it never forwards account tokens to ApeWisdom.

## Color ownership

Web `app/globals.css` owns light/dark product colors. Native `src/lib/palette.ts` adapts those roles, checked by `tests/theme-parity.test.ts`; `useTheme` follows system appearance. Foreground titles, secondary metadata and neutral selected-control fills must stay separate from green positive/action labels and orange-red negative labels. Chart marks use chart-up/chart-down, not text-safe colors. Glass material remains native; reduced transparency uses the matching opaque card token.
