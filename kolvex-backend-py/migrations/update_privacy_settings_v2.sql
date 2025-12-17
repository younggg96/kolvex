-- 更新隐私设置结构
-- 1. 将 show_position_price 改为 show_position_cost
-- 2. 将 show_accounts_count 改为 hidden_accounts (账户ID数组)

-- 更新现有的 privacy_settings 字段
-- 注意：这个迁移会修改现有的 privacy_settings JSON 结构

DO $$
DECLARE
    conn RECORD;
    current_settings JSONB;
    new_settings JSONB;
BEGIN
    FOR conn IN SELECT id, privacy_settings FROM snaptrade_connections WHERE privacy_settings IS NOT NULL
    LOOP
        current_settings := conn.privacy_settings;
        
        -- 创建新的设置结构
        new_settings := current_settings;
        
        -- 将 show_position_price 的值迁移到 show_position_cost
        IF current_settings ? 'show_position_price' THEN
            new_settings := new_settings || jsonb_build_object('show_position_cost', current_settings->'show_position_price');
            new_settings := new_settings - 'show_position_price';
        END IF;
        
        -- 移除 show_accounts_count，添加 hidden_accounts 空数组（默认显示所有账户）
        IF current_settings ? 'show_accounts_count' THEN
            new_settings := new_settings - 'show_accounts_count';
        END IF;
        
        -- 添加 hidden_accounts 如果不存在
        IF NOT (new_settings ? 'hidden_accounts') THEN
            new_settings := new_settings || '{"hidden_accounts": []}'::jsonb;
        END IF;
        
        -- 更新记录
        UPDATE snaptrade_connections 
        SET privacy_settings = new_settings
        WHERE id = conn.id;
    END LOOP;
END $$;

-- 为没有隐私设置的连接添加默认值
UPDATE snaptrade_connections
SET privacy_settings = '{
    "show_total_value": true,
    "show_total_pnl": true,
    "show_pnl_percent": true,
    "show_positions_count": true,
    "show_shares": true,
    "show_position_value": true,
    "show_position_pnl": true,
    "show_position_weight": true,
    "show_position_cost": true,
    "hidden_accounts": []
}'::jsonb
WHERE privacy_settings IS NULL;

