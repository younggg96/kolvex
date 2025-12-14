-- 为持仓公开分享添加隐私设置
-- 用户可以选择隐藏特定的数据字段

-- 添加隐私设置 JSONB 字段到 snaptrade_connections 表
-- 默认所有字段都公开显示
ALTER TABLE snaptrade_connections 
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{
    "show_total_value": true,
    "show_total_pnl": true,
    "show_pnl_percent": true,
    "show_positions_count": true,
    "show_accounts_count": true,
    "show_shares": true,
    "show_position_value": true,
    "show_position_pnl": true,
    "show_position_weight": true,
    "show_position_price": true
}'::jsonb;

-- 添加注释
COMMENT ON COLUMN snaptrade_connections.privacy_settings IS '公开分享时的隐私设置，控制哪些数据字段对外可见';

-- 创建索引以优化 JSONB 查询
CREATE INDEX IF NOT EXISTS idx_snaptrade_connections_privacy_settings 
ON snaptrade_connections USING GIN (privacy_settings);

