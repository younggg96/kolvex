-- 添加成本价字段到 snaptrade_positions 表
-- 如果字段已存在则跳过

DO $$
BEGIN
    -- 添加 average_purchase_price 列（成本价/平均买入价）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'snaptrade_positions'
        AND column_name = 'average_purchase_price'
    ) THEN
        ALTER TABLE snaptrade_positions
        ADD COLUMN average_purchase_price DECIMAL(20, 8);
        
        COMMENT ON COLUMN snaptrade_positions.average_purchase_price IS '平均买入价/成本价';
    END IF;
END $$;

