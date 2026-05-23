-- Robinhood option order history synced by option order + leg.

CREATE TABLE IF NOT EXISTS robinhood_option_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    option_order_id VARCHAR(100) NOT NULL,
    leg_id VARCHAR(140) NOT NULL,
    chain_symbol VARCHAR(20),
    underlying_symbol VARCHAR(20),
    option_type VARCHAR(20),
    expiration_date DATE,
    strike_price DECIMAL(20, 8),
    side VARCHAR(30),
    direction VARCHAR(30),
    opening_strategy VARCHAR(80),
    closing_strategy VARCHAR(80),
    order_type VARCHAR(50),
    quantity DECIMAL(20, 8),
    processed_quantity DECIMAL(20, 8),
    price DECIMAL(20, 8),
    premium DECIMAL(20, 8),
    state VARCHAR(50),
    created_time TIMESTAMPTZ,
    executed_time TIMESTAMPTZ,
    raw_order JSONB DEFAULT '{}'::jsonb,
    raw_leg JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_robinhood_user_option_leg UNIQUE (user_id, option_order_id, leg_id)
);

CREATE INDEX IF NOT EXISTS idx_robinhood_option_orders_user_id
ON robinhood_option_orders(user_id);

CREATE INDEX IF NOT EXISTS idx_robinhood_option_orders_underlying
ON robinhood_option_orders(underlying_symbol);

CREATE INDEX IF NOT EXISTS idx_robinhood_option_orders_created_time
ON robinhood_option_orders(created_time DESC);

DROP TRIGGER IF EXISTS update_robinhood_option_orders_updated_at ON robinhood_option_orders;
CREATE TRIGGER update_robinhood_option_orders_updated_at
    BEFORE UPDATE ON robinhood_option_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE robinhood_option_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own robinhood option orders" ON robinhood_option_orders;
CREATE POLICY "Users can view own robinhood option orders"
ON robinhood_option_orders FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage robinhood option orders" ON robinhood_option_orders;
CREATE POLICY "Service role can manage robinhood option orders"
ON robinhood_option_orders FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE robinhood_option_orders IS 'Robinhood option order history synced by option order leg';
