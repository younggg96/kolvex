-- 添加 position_type 字段用于区分股票和期权持仓
ALTER TABLE snaptrade_positions 
ADD COLUMN IF NOT EXISTS position_type VARCHAR(20) DEFAULT 'equity';

-- 添加期权特有字段
ALTER TABLE snaptrade_positions 
ADD COLUMN IF NOT EXISTS option_type VARCHAR(10); -- 'call' or 'put'

ALTER TABLE snaptrade_positions 
ADD COLUMN IF NOT EXISTS strike_price DECIMAL(20, 8);

ALTER TABLE snaptrade_positions 
ADD COLUMN IF NOT EXISTS expiration_date DATE;

ALTER TABLE snaptrade_positions 
ADD COLUMN IF NOT EXISTS underlying_symbol VARCHAR(50);

COMMENT ON COLUMN snaptrade_positions.position_type IS '持仓类型: equity (股票/ETF等) 或 option (期权)';
COMMENT ON COLUMN snaptrade_positions.option_type IS '期权类型: call 或 put';
COMMENT ON COLUMN snaptrade_positions.strike_price IS '期权行权价';
COMMENT ON COLUMN snaptrade_positions.expiration_date IS '期权到期日';
COMMENT ON COLUMN snaptrade_positions.underlying_symbol IS '期权标的代码';

