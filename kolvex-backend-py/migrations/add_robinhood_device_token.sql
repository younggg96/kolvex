-- Persist Robinhood's per-user device token outside the server filesystem.
-- This keeps mobile "Yes, it's me" approvals valid across redeploys/restarts.

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS device_token VARCHAR(255);

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS pending_challenge_id VARCHAR(255);
