# Account Watchlist

The database of record is the existing hosted Supabase project
`zekbqxpgivgznhnheima`. The frontend's authenticated Next.js server routes access
it directly, matching the journal architecture. No Python backend change,
service-role browser credential, or new environment variable is required.

## Schema and ownership

- `public.user_watchlist`: `user_id` references `auth.users` with cascade deletion,
  validated uppercase `ticker`, server `created_at`; composite primary key
  `(user_id, ticker)` prevents duplicates. User/time/ticker index serves listing.
- `public.user_watchlist_imports`: immutable `(user_id, source_id)` receipts with
  server timestamps. `import_user_watchlist(text[], uuid)` atomically records a
  receipt and inserts missing legacy stocks, preserving existing timestamps.
- Both tables have RLS and explicit least-privilege grants. Authenticated users
  can only select/insert/delete their own stocks and select/insert their own
  import receipts. No anonymous access or client UPDATE privilege. The import
  function is security invoker, has an empty search path, and denies PUBLIC/anon.

## API

`/api/watchlist` uses `auth.getUser()` on every request and requires
`X-Watchlist-User` to match that verified user. The header is a stale-account
check, never the source of authority. Client-supplied user IDs are ignored.
All responses use `Cache-Control: private, no-store`.

| Method | Body | Result |
| --- | --- | --- |
| GET | none | `{userId, items: [{ticker, created_at}]}`, ascending server creation time |
| PUT | `{ticker}` | Add if absent; existing timestamps unchanged |
| DELETE | `{ticker}` | Remove own ticker; already absent succeeds |
| POST | `{tickers, sourceId}` | Atomic one-time legacy import for that account/browser source |

Invalid input: 400; unsigned/expired: 401; stale account: 409; unavailable DB: 503.
GET paginates past Supabase's 1000-row response limit. Import accepts up to 1000
validated tickers at once; oversized legacy lists stay local with a migration
error, never silently truncate. The migration is in backend Supabase migrations.

## Client consistency

The shared external store clears on identity changes, ignores stale responses,
guards duplicate writes and only mutates display after acknowledgement. Errors
retain confirmed data and typed input, disable further edits until a refresh,
and expose retry. A timed-out write has uncertain completion, so reload the
cloud state before retrying. Sign-in is required for persistence. LocalStorage
being unavailable does not prevent normal account reads or writes.

Visible pages refresh on focus, reconnection, visibility return and each 30s;
there is no realtime claim. Each mutation changes only one ticker. Different
stocks added on different devices survive; the last committed operation on the
same ticker wins. Saved order comes from database timestamps.

## Legacy migration

Read `kolvex:watchlist`, falling back to `kolvex:reddit-watchlist` only when the
newer key is absent. Normalize/deduplicate; preserve an intentionally empty list.
Claim a browser owner and persist a random migration source UUID before import.
Retain the UUID/owner receipt locally; remove old list keys only after the atomic
server import succeeds. Server receipts make retries harmless, including a crash
between acknowledgement and local cleanup. Other browsers can import their own
legacy list with a distinct source UUID. Another account cannot claim a failed
migration from the same browser. The server list is never copied to a global
localStorage list.
