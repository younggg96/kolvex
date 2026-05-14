-- Robinhood broker integration tables
-- Stores per-user Robinhood connection metadata and historical orders.
-- Passwords are intentionally not stored; robin_stocks caches OAuth tokens
-- on the backend host using the per-user session_pickle_name.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS robinhood_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    session_pickle_name VARCHAR(255) NOT NULL,
    device_token VARCHAR(255),
    is_connected BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMPTZ,
    account_number VARCHAR(255),
    portfolio_value DECIMAL(20, 8),
    cash_balance DECIMAL(20, 8),
    buying_power DECIMAL(20, 8),
    total_equity DECIMAL(20, 8),
    profile JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_robinhood_user UNIQUE (user_id)
);

ALTER TABLE robinhood_connections
ADD COLUMN IF NOT EXISTS device_token VARCHAR(255);

CREATE TABLE IF NOT EXISTS robinhood_stock_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id VARCHAR(80) NOT NULL,
    ticker VARCHAR(20) NOT NULL,
    side VARCHAR(20),
    order_type VARCHAR(50),
    quantity DECIMAL(20, 8),
    average_price DECIMAL(20, 8),
    total_amount DECIMAL(20, 8),
    state VARCHAR(50),
    created_time TIMESTAMPTZ,
    executed_time TIMESTAMPTZ,
    fees DECIMAL(20, 8) DEFAULT 0,
    raw_order JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_robinhood_user_order UNIQUE (user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_robinhood_connections_user_id
ON robinhood_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_robinhood_orders_user_id
ON robinhood_stock_orders(user_id);

CREATE INDEX IF NOT EXISTS idx_robinhood_orders_ticker
ON robinhood_stock_orders(ticker);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_robinhood_connections_updated_at ON robinhood_connections;
CREATE TRIGGER update_robinhood_connections_updated_at
    BEFORE UPDATE ON robinhood_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_robinhood_stock_orders_updated_at ON robinhood_stock_orders;
CREATE TRIGGER update_robinhood_stock_orders_updated_at
    BEFORE UPDATE ON robinhood_stock_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE robinhood_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE robinhood_stock_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own robinhood connection" ON robinhood_connections;
CREATE POLICY "Users can view own robinhood connection"
ON robinhood_connections FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own robinhood connection" ON robinhood_connections;
CREATE POLICY "Users can delete own robinhood connection"
ON robinhood_connections FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own robinhood orders" ON robinhood_stock_orders;
CREATE POLICY "Users can view own robinhood orders"
ON robinhood_stock_orders FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage robinhood connections" ON robinhood_connections;
CREATE POLICY "Service role can manage robinhood connections"
ON robinhood_connections FOR ALL
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage robinhood orders" ON robinhood_stock_orders;
CREATE POLICY "Service role can manage robinhood orders"
ON robinhood_stock_orders FOR ALL
USING (auth.role() = 'service_role');

COMMENT ON TABLE robinhood_connections IS 'Robinhood per-user connection metadata and account summary';
COMMENT ON TABLE robinhood_stock_orders IS 'Robinhood stock order history synced by unique order ID';
