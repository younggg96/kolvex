-- Persist Robinhood OAuth tokens directly in Supabase so they survive
-- backend container restarts (Railway/Docker filesystems are ephemeral and
-- wipe ~/.tokens/ on every redeploy, which previously forced users to
-- reconnect after every backend deploy).
--
-- Security notes:
--   * `robinhood_connections` already has Row Level Security enabled. Only
--     the row's `user_id` (auth.uid()) and the service role can read it,
--     so users can never see another user's tokens via the REST API.
--   * Tokens are stored in plaintext TEXT columns. If you want stronger
--     protection at rest, encrypt them at the application layer using a
--     server-only secret (e.g. via pgcrypto's pgp_sym_encrypt) before
--     enabling this in production.
--
-- Columns:
--   access_token            -> Robinhood OAuth bearer token (~24h lifetime)
--   refresh_token           -> Long-lived refresh token used to mint new
--                              access tokens without a fresh device-approval
--                              push notification
--   token_type              -> Usually "Bearer"
--   access_token_saved_at   -> Wall-clock time the row was last updated;
--                              useful for monitoring stale sessions

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS access_token TEXT;

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS refresh_token TEXT;

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS token_type VARCHAR(50);

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS access_token_saved_at TIMESTAMPTZ;
