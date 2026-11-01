# Mobile UI contract

## Evidence

- `../README.md`: Next.js / FastAPI product and service boundaries.
- `../kolvex-frontend-web-nextjs/PRODUCT.md`: Chinese-first reading, source attribution, no fabricated creators or returns.
- `../kolvex-backend-py/app/api/routes/market_data.py`: quote/history response contracts.
- `../kolvex-backend-py/app/api/routes/youtube_opinions.py`: public dashboard contract; admin mutations excluded.
- Current user request: create a React Native phone client with SwiftUI glass style.

## Canonical UI map

| Capability                     | Owner                          | Contract                                                                        | Verification            |
| ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------- | ----------------------- |
| Navigation                     | Expo Router Stack + NativeTabs | Four stable tabs; stock detail has system back                                  | bundle + device pending |
| Theme / type                   | theme.ts + UI Copy             | System theme and scalable system font                                           | typecheck + preview     |
| Feedback                       | UI Failure / Empty / Skeleton  | Inline errors and retry; do not hide readable stale data                        | preview                 |
| Search                         | UI Search                      | Explicit clear, local filtering without network races, explicit code submission | preview                 |
| Async                          | useResource                    | Abort on unmount/key change, 15s deadline, ignore stale results                 | code review             |
| Self-managed storage           | Watchlist provider             | Local device only; serialized writes; visible failure                           | preview persistence     |
| Single select                  | Button range group             | Selected state announced; no popup                                              | preview                 |
| Scrollbar                      | OS ScrollView                  | Native indicator; content clears safe area/navigation                           | device pending          |
| Forms / CRUD / toast / billing | Not applicable                 | No account writes, payments or destructive remote actions                       | code inspection         |

## Flow ledger

Market search filters a bounded curated company list and can explicitly open another syntactically valid ticker. Quote details load independently from price history. Switching range cancels prior history work. Adding/removing watchlist updates locally immediately; serialized persistence prevents stale writes. An empty watchlist points to Markets. Opinion cards retain creator/date/sentiment and link only to HTTPS YouTube sources. Only thirty recent opinions are requested in this first version; full history/pagination remains out of scope.

Demo mode depends solely on missing API configuration and is labeled across all screens. Configured API failures show an error, never fixtures. No credentials are bundled. Missing quote fields show em dashes. Public reading is implemented; there is no mobile authentication/session/Plaid migration claim.
