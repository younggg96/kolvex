CREATE TABLE IF NOT EXISTS public.ibkr_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    flex_token_encrypted TEXT NOT NULL,
    flex_query_id VARCHAR(64) NOT NULL,
    is_connected BOOLEAN NOT NULL DEFAULT FALSE,
    last_synced_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ibkr_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES public.ibkr_connections(id) ON DELETE CASCADE,
    account_id VARCHAR(128) NOT NULL,
    account_name VARCHAR(255),
    currency VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(connection_id, account_id)
);

CREATE TABLE IF NOT EXISTS public.ibkr_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.ibkr_accounts(id) ON DELETE CASCADE,
    contract_id VARCHAR(128),
    position_key VARCHAR(255) NOT NULL,
    position_type VARCHAR(16) NOT NULL DEFAULT 'equity',
    symbol VARCHAR(64) NOT NULL,
    security_name VARCHAR(255),
    units NUMERIC(24, 8) NOT NULL DEFAULT 0,
    price NUMERIC(24, 8),
    market_value NUMERIC(24, 8),
    average_purchase_price NUMERIC(24, 8),
    open_pnl NUMERIC(24, 8),
    currency VARCHAR(16),
    option_type VARCHAR(8),
    strike_price NUMERIC(24, 8),
    expiration_date DATE,
    underlying_symbol VARCHAR(64),
    multiplier NUMERIC(12, 4) DEFAULT 100,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, position_key)
);

CREATE TABLE IF NOT EXISTS public.ibkr_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id VARCHAR(128),
    trade_id VARCHAR(128) NOT NULL,
    order_id VARCHAR(128),
    symbol VARCHAR(64) NOT NULL,
    security_name VARCHAR(255),
    asset_category VARCHAR(32),
    side VARCHAR(16),
    quantity NUMERIC(24, 8),
    trade_price NUMERIC(24, 8),
    proceeds NUMERIC(24, 8),
    realized_pnl NUMERIC(24, 8),
    commission NUMERIC(24, 8),
    currency VARCHAR(16),
    trade_time TIMESTAMPTZ,
    option_type VARCHAR(8),
    strike_price NUMERIC(24, 8),
    expiration_date DATE,
    multiplier NUMERIC(12, 4) DEFAULT 100,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, trade_id)
);

ALTER TABLE public.ibkr_trades
ADD COLUMN IF NOT EXISTS multiplier NUMERIC(12, 4) DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_ibkr_positions_account ON public.ibkr_positions(account_id);
CREATE INDEX IF NOT EXISTS idx_ibkr_trades_user_time ON public.ibkr_trades(user_id, trade_time DESC);

ALTER TABLE public.ibkr_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ibkr_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ibkr_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ibkr_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ibkr connections" ON public.ibkr_connections;
CREATE POLICY "Users can view own ibkr connections" ON public.ibkr_connections
FOR SELECT USING (auth.uid()::text = ibkr_connections.user_id::text);
DROP POLICY IF EXISTS "Users can view own ibkr accounts" ON public.ibkr_accounts;
CREATE POLICY "Users can view own ibkr accounts" ON public.ibkr_accounts
FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.ibkr_connections c
    WHERE c.id::text = ibkr_accounts.connection_id::text
      AND c.user_id::text = auth.uid()::text
));
DROP POLICY IF EXISTS "Users can view own ibkr positions" ON public.ibkr_positions;
CREATE POLICY "Users can view own ibkr positions" ON public.ibkr_positions
FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.ibkr_accounts a
    JOIN public.ibkr_connections c
      ON c.id::text = a.connection_id::text
    WHERE a.id::text = ibkr_positions.account_id::text
      AND c.user_id::text = auth.uid()::text
));
DROP POLICY IF EXISTS "Users can view own ibkr trades" ON public.ibkr_trades;
CREATE POLICY "Users can view own ibkr trades" ON public.ibkr_trades
FOR SELECT USING (auth.uid()::text = ibkr_trades.user_id::text);

DROP POLICY IF EXISTS "Service role manages ibkr connections" ON public.ibkr_connections;
CREATE POLICY "Service role manages ibkr connections" ON public.ibkr_connections
FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role manages ibkr accounts" ON public.ibkr_accounts;
CREATE POLICY "Service role manages ibkr accounts" ON public.ibkr_accounts
FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role manages ibkr positions" ON public.ibkr_positions;
CREATE POLICY "Service role manages ibkr positions" ON public.ibkr_positions
FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role manages ibkr trades" ON public.ibkr_trades;
CREATE POLICY "Service role manages ibkr trades" ON public.ibkr_trades
FOR ALL USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
