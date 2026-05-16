-- Track in-progress Robinhood syncs so the /sync and /connect endpoints can
-- return immediately and the frontend can poll /status to see when the
-- background sync completes. Without these columns the API has to block on
-- ~30-60s of Robinhood + Supabase calls and Vercel's 60s edge proxy timeout
-- starts firing 504 Gateway Timeout responses on accounts with hundreds of
-- order rows.
--
-- Columns:
--   is_syncing       -> true while a background sync task is running for this
--                       user. Cleared (true -> false) when the task ends, or
--                       when get_status notices the row is stale (>15 min).
--   sync_started_at  -> wall-clock time the current/last sync began. Used to
--                       expire stuck "syncing" flags after a server crash.
--   last_sync_error  -> the error message of the most recent failed sync, so
--                       the UI can surface it to the user (e.g. "session
--                       expired"). Cleared on the next successful sync.

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS is_syncing BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ;

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS last_sync_error TEXT;
