-- Persist the in-progress Robinhood device-approval workflow so that
-- subsequent /connect calls can resume the SAME mobile push instead of
-- generating a new one each time.
--
-- pending_machine_id          -> /pathfinder/user_machine/ id returned after
--                                we kick off the verification_workflow
-- pending_workflow_started_at -> wall-clock time we started the workflow.
--                                Used to expire stale state (Robinhood
--                                inquiries time out after a few minutes).

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS pending_machine_id VARCHAR(255);

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS pending_workflow_started_at TIMESTAMPTZ;
