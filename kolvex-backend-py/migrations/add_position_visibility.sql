-- 为持仓添加可见性控制
-- 用户可以选择隐藏某些持仓不公开显示

-- 添加 is_hidden 字段，默认为 false（即默认公开）
ALTER TABLE snaptrade_positions 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- 添加注释
COMMENT ON COLUMN snaptrade_positions.is_hidden IS '是否在公开分享时隐藏此持仓';

-- 创建索引以优化过滤查询
CREATE INDEX IF NOT EXISTS idx_snaptrade_positions_is_hidden 
ON snaptrade_positions(is_hidden);

-- 更新公开持仓的 RLS 策略，排除隐藏的持仓
DROP POLICY IF EXISTS "Anyone can view public snaptrade positions" ON snaptrade_positions;

CREATE POLICY "Anyone can view public snaptrade positions"
    ON snaptrade_positions FOR SELECT
    USING (
        is_hidden = FALSE
        AND EXISTS (
            SELECT 1 FROM snaptrade_accounts
            JOIN snaptrade_connections ON snaptrade_connections.id = snaptrade_accounts.connection_id
            WHERE snaptrade_accounts.id = snaptrade_positions.account_id
            AND snaptrade_connections.is_public = TRUE
        )
    );

