-- Plaid Investments storage and portfolio provider support.

DO $$
BEGIN
    ALTER TABLE portfolio_connections
        DROP CONSTRAINT IF EXISTS portfolio_connections_provider_check;

    ALTER TABLE portfolio_connections
        ADD CONSTRAINT portfolio_connections_provider_check
        CHECK (provider IN ('plaid', 'robinhood', 'ibkr'));
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'portfolio_connections table does not exist yet';
END $$;

CREATE TABLE IF NOT EXISTS plaid_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    institution_id TEXT,
    institution_name TEXT,
    accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_connected BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS plaid_investment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT,
    investment_transaction_id TEXT NOT NULL,
    account_id TEXT,
    account_name TEXT,
    security_id TEXT,
    symbol TEXT,
    name TEXT,
    type TEXT,
    subtype TEXT,
    date DATE,
    quantity NUMERIC(20, 8),
    price NUMERIC(20, 8),
    amount NUMERIC(20, 8),
    fees NUMERIC(20, 8),
    currency TEXT,
    raw_transaction JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, investment_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user
    ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item
    ON plaid_items(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_investment_transactions_user
    ON plaid_investment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_investment_transactions_symbol
    ON plaid_investment_transactions(symbol);
CREATE INDEX IF NOT EXISTS idx_plaid_investment_transactions_date
    ON plaid_investment_transactions(date DESC);

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_investment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own plaid items" ON plaid_items;
CREATE POLICY "Users read own plaid items"
    ON plaid_items FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages plaid items" ON plaid_items;
CREATE POLICY "Service role manages plaid items"
    ON plaid_items FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Users read own plaid investment transactions"
    ON plaid_investment_transactions;
CREATE POLICY "Users read own plaid investment transactions"
    ON plaid_investment_transactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages plaid investment transactions"
    ON plaid_investment_transactions;
CREATE POLICY "Service role manages plaid investment transactions"
    ON plaid_investment_transactions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
