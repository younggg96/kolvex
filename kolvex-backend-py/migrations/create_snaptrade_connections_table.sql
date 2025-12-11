-- SnapTrade 用户连接表
-- 用于存储用户与 SnapTrade 的连接信息

-- 创建 snaptrade_connections 表
CREATE TABLE IF NOT EXISTS snaptrade_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    snaptrade_user_id VARCHAR(255) NOT NULL,
    snaptrade_user_secret VARCHAR(500) NOT NULL,
    is_connected BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,  -- 是否公开分享持仓
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 确保每个用户只能有一个 SnapTrade 连接
    CONSTRAINT unique_user_snaptrade UNIQUE (user_id)
);

-- 创建 snaptrade_accounts 表 - 存储用户连接的券商账户
CREATE TABLE IF NOT EXISTS snaptrade_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES snaptrade_connections(id) ON DELETE CASCADE,
    account_id VARCHAR(255) NOT NULL,  -- SnapTrade 账户 ID
    brokerage_name VARCHAR(255),
    account_name VARCHAR(255),
    account_number VARCHAR(255),
    account_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_snaptrade_account UNIQUE (connection_id, account_id)
);

-- 创建 snaptrade_positions 表 - 缓存用户持仓信息
CREATE TABLE IF NOT EXISTS snaptrade_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES snaptrade_accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    symbol_id VARCHAR(255),  -- SnapTrade Universal Symbol ID
    security_name VARCHAR(255),
    units DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8),
    open_pnl DECIMAL(20, 8),
    fractional_units DECIMAL(20, 8),
    average_purchase_price DECIMAL(20, 8),
    currency VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_snaptrade_connections_user_id ON snaptrade_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_snaptrade_connections_is_public ON snaptrade_connections(is_public);
CREATE INDEX IF NOT EXISTS idx_snaptrade_accounts_connection_id ON snaptrade_accounts(connection_id);
CREATE INDEX IF NOT EXISTS idx_snaptrade_positions_account_id ON snaptrade_positions(account_id);
CREATE INDEX IF NOT EXISTS idx_snaptrade_positions_symbol ON snaptrade_positions(symbol);

-- 更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为表添加更新时间触发器
DROP TRIGGER IF EXISTS update_snaptrade_connections_updated_at ON snaptrade_connections;
CREATE TRIGGER update_snaptrade_connections_updated_at
    BEFORE UPDATE ON snaptrade_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_snaptrade_accounts_updated_at ON snaptrade_accounts;
CREATE TRIGGER update_snaptrade_accounts_updated_at
    BEFORE UPDATE ON snaptrade_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_snaptrade_positions_updated_at ON snaptrade_positions;
CREATE TRIGGER update_snaptrade_positions_updated_at
    BEFORE UPDATE ON snaptrade_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS 策略
ALTER TABLE snaptrade_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE snaptrade_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE snaptrade_positions ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的连接
CREATE POLICY "Users can view their own snaptrade connections"
    ON snaptrade_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own snaptrade connections"
    ON snaptrade_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own snaptrade connections"
    ON snaptrade_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own snaptrade connections"
    ON snaptrade_connections FOR DELETE
    USING (auth.uid() = user_id);

-- 公开分享的持仓任何人都可以查看
CREATE POLICY "Anyone can view public snaptrade connections"
    ON snaptrade_connections FOR SELECT
    USING (is_public = TRUE);

-- 账户策略（通过 connection_id 关联到用户）
CREATE POLICY "Users can view their own snaptrade accounts"
    ON snaptrade_accounts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM snaptrade_connections
            WHERE snaptrade_connections.id = snaptrade_accounts.connection_id
            AND snaptrade_connections.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can view public snaptrade accounts"
    ON snaptrade_accounts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM snaptrade_connections
            WHERE snaptrade_connections.id = snaptrade_accounts.connection_id
            AND snaptrade_connections.is_public = TRUE
        )
    );

-- 持仓策略
CREATE POLICY "Users can view their own snaptrade positions"
    ON snaptrade_positions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM snaptrade_accounts
            JOIN snaptrade_connections ON snaptrade_connections.id = snaptrade_accounts.connection_id
            WHERE snaptrade_accounts.id = snaptrade_positions.account_id
            AND snaptrade_connections.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can view public snaptrade positions"
    ON snaptrade_positions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM snaptrade_accounts
            JOIN snaptrade_connections ON snaptrade_connections.id = snaptrade_accounts.connection_id
            WHERE snaptrade_accounts.id = snaptrade_positions.account_id
            AND snaptrade_connections.is_public = TRUE
        )
    );

-- 允许 service_role 完全访问（用于后端操作）
CREATE POLICY "Service role has full access to snaptrade_connections"
    ON snaptrade_connections FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to snaptrade_accounts"
    ON snaptrade_accounts FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to snaptrade_positions"
    ON snaptrade_positions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE snaptrade_connections IS 'SnapTrade 用户连接信息';
COMMENT ON TABLE snaptrade_accounts IS 'SnapTrade 券商账户信息';
COMMENT ON TABLE snaptrade_positions IS 'SnapTrade 持仓缓存';

