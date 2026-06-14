-- Broker-neutral portfolio cache used by direct Robinhood and IBKR integrations.

CREATE TABLE IF NOT EXISTS portfolio_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('robinhood', 'ibkr')),
    is_connected BOOLEAN NOT NULL DEFAULT FALSE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_settings JSONB NOT NULL DEFAULT '{
        "show_total_value": true,
        "show_total_pnl": true,
        "show_pnl_percent": true,
        "show_positions_count": true,
        "show_shares": true,
        "show_position_value": true,
        "show_position_pnl": false,
        "show_position_pnl_per_share": false,
        "show_position_weight": true,
        "show_position_cost": true,
        "hidden_accounts": []
    }'::jsonb,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS portfolio_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES portfolio_connections(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    brokerage_name TEXT,
    account_name TEXT,
    account_number TEXT,
    account_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (connection_id, account_id)
);

CREATE TABLE IF NOT EXISTS portfolio_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    symbol_id TEXT,
    security_name TEXT,
    units NUMERIC(20, 8) NOT NULL,
    price NUMERIC(20, 8),
    open_pnl NUMERIC(20, 8),
    fractional_units NUMERIC(20, 8),
    average_purchase_price NUMERIC(20, 8),
    currency TEXT,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    position_type TEXT NOT NULL DEFAULT 'equity',
    option_type TEXT,
    strike_price NUMERIC(20, 8),
    expiration_date DATE,
    underlying_symbol TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (account_id, symbol, position_type)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_connections_user
    ON portfolio_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_connections_public
    ON portfolio_connections(is_public);
CREATE INDEX IF NOT EXISTS idx_portfolio_accounts_connection
    ON portfolio_accounts(connection_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_positions_account
    ON portfolio_positions(account_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_positions_symbol
    ON portfolio_positions(symbol);

ALTER TABLE portfolio_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their portfolio connections"
    ON portfolio_connections FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public portfolio connections are readable"
    ON portfolio_connections FOR SELECT
    USING (is_public);

CREATE POLICY "Users read their portfolio accounts"
    ON portfolio_accounts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM portfolio_connections c
        WHERE c.id = portfolio_accounts.connection_id
          AND c.user_id = auth.uid()
    ));

CREATE POLICY "Public portfolio accounts are readable"
    ON portfolio_accounts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM portfolio_connections c
        WHERE c.id = portfolio_accounts.connection_id
          AND c.is_public
    ));

CREATE POLICY "Users read their portfolio positions"
    ON portfolio_positions FOR SELECT
    USING (EXISTS (
        SELECT 1
        FROM portfolio_accounts a
        JOIN portfolio_connections c ON c.id = a.connection_id
        WHERE a.id = portfolio_positions.account_id
          AND c.user_id = auth.uid()
    ));

CREATE POLICY "Public portfolio positions are readable"
    ON portfolio_positions FOR SELECT
    USING (
        NOT is_hidden
        AND EXISTS (
            SELECT 1
            FROM portfolio_accounts a
            JOIN portfolio_connections c ON c.id = a.connection_id
            WHERE a.id = portfolio_positions.account_id
              AND c.is_public
        )
    );

CREATE POLICY "Service role manages portfolio connections"
    ON portfolio_connections FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role manages portfolio accounts"
    ON portfolio_accounts FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role manages portfolio positions"
    ON portfolio_positions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Preserve only direct Robinhood cache rows from the retired legacy schema.
DO $$
BEGIN
    IF to_regclass('public.snaptrade_connections') IS NOT NULL THEN
        INSERT INTO portfolio_connections (
            id, user_id, provider, is_connected, is_public, privacy_settings,
            last_synced_at, created_at, updated_at
        )
        SELECT
            sc.id, sc.user_id, 'robinhood', sc.is_connected, sc.is_public,
            COALESCE(to_jsonb(sc)->'privacy_settings', '{}'::jsonb),
            sc.last_synced_at, sc.created_at, sc.updated_at
        FROM snaptrade_connections sc
        WHERE sc.snaptrade_user_id LIKE 'robinhood_%'
        ON CONFLICT (user_id, provider) DO NOTHING;

        INSERT INTO portfolio_accounts (
            id, connection_id, account_id, brokerage_name, account_name,
            account_number, account_type, created_at, updated_at
        )
        SELECT
            a.id, a.connection_id, a.account_id, a.brokerage_name, a.account_name,
            a.account_number, a.account_type, a.created_at, a.updated_at
        FROM snaptrade_accounts a
        JOIN portfolio_connections c ON c.id = a.connection_id
        ON CONFLICT (connection_id, account_id) DO NOTHING;

        INSERT INTO portfolio_positions (
            id, account_id, symbol, symbol_id, security_name, units, price,
            open_pnl, fractional_units, average_purchase_price, currency,
            is_hidden, position_type, option_type, strike_price,
            expiration_date, underlying_symbol, created_at, updated_at
        )
        SELECT
            p.id, p.account_id, p.symbol, p.symbol_id, p.security_name, p.units,
            p.price, p.open_pnl, p.fractional_units, p.average_purchase_price,
            p.currency,
            COALESCE((to_jsonb(p)->>'is_hidden')::BOOLEAN, FALSE),
            COALESCE(to_jsonb(p)->>'position_type', 'equity'),
            to_jsonb(p)->>'option_type',
            (to_jsonb(p)->>'strike_price')::NUMERIC,
            (to_jsonb(p)->>'expiration_date')::DATE,
            to_jsonb(p)->>'underlying_symbol',
            p.created_at, p.updated_at
        FROM snaptrade_positions p
        JOIN portfolio_accounts a ON a.id = p.account_id
        ON CONFLICT (account_id, symbol, position_type) DO NOTHING;

        DROP TABLE snaptrade_positions CASCADE;
        DROP TABLE snaptrade_accounts CASCADE;
        DROP TABLE snaptrade_connections CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.portfolio_snapshots') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Users can view public portfolio snapshots"
            ON portfolio_snapshots;
        CREATE POLICY "Users can view public portfolio snapshots"
            ON portfolio_snapshots FOR SELECT
            USING (EXISTS (
                SELECT 1 FROM portfolio_connections pc
                WHERE pc.user_id = portfolio_snapshots.user_id
                  AND pc.is_public
            ));
    END IF;
END $$;
