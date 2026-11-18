-- Let users remove individual accounts from their portfolio.
-- Plaid returns every account on a linked item (checking, credit cards, auto
-- loans ...) on each sync, so a removed Plaid account must be remembered by its
-- Plaid account_id or the next sync would bring it back.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.portfolio_connections
    ADD COLUMN IF NOT EXISTS removed_account_ids TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.portfolio_connections.removed_account_ids IS
    'Provider account ids the user removed; syncs skip these accounts.';
