# Watchlist account persistence — 2026-10-30

## Implemented and applied

Migration `20261030220455_user_watchlist.sql` is applied to the existing hosted
Supabase project `zekbqxpgivgznhnheima`. Local version matches remote migration
history. Tables: `user_watchlist`, `user_watchlist_imports`. RPC:
`import_user_watchlist(text[], uuid)`, security invoker with explicit grants/RLS.

Next.js authenticated `/api/watchlist` and the shared frontend store replace
browser-only writes. Watchlist, individual stock stars and Reddit share the
account list. Browser-only legacy data has an atomic, repeat-safe merge path.
Contract and migration lifecycle: `docs/watchlist-sync.md`.

## Verification

- Store/API tests: 18 pass (`node --test scripts/watchlist.test.cjs scripts/watchlist-api.test.cjs`).
- `npx tsc --noEmit --incremental false`: pass.
- Scoped Next lint on the eight changed/new TS/TSX files: pass.
- `npm run build`: pass, 51 static pages plus dynamic `/api/watchlist`.
  Existing unrelated VideoPlayer `<img>` warning and old Browserslist data remain.
- Hosted database transaction tested own-row persistence, duplicate inserts,
  import acknowledgement/retry after a removal, cross-account read isolation,
  cross-account delete/insert rejection and ticker checks. All passed; the entire
  test transaction was rolled back, leaving no test rows.
- Supabase security advisor returned no Watchlist-specific findings. Existing
  notices on other tables/functions are outside this change.
- UI static audit output saved alongside this report. Its four findings are
  existing unrelated settings/scrollbar issues and a false native-select match
  on the Reddit page's authored Radix Select. No UI redesign was introduced.

## Release and browser limits

The existing authenticated production browser still serves the old browser-only
Watchlist. The new frontend has not been published. Vercel MCP can discover
`kolvex` (`prj_Cyo3Z5wZFtOMWCGq4xQJ42zWdye0`), but project access under
`team_nuGAPvd6wKa0I7zxlqQi2uh3` returns 403 and requires the user's team consent.
The local Vercel CLI is logged out. No production push/deployment was attempted.
Authenticated UI success/failure and narrow-viewport checks remain to be exercised
against the deployed build after that access is granted.
