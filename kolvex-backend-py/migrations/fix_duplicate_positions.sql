-- 修复重复持仓数据并添加唯一约束
-- 此脚本需要在 Supabase SQL Editor 中运行

-- ====================================
-- 步骤 1: 查看重复数据（可选，用于检查）
-- ====================================
-- SELECT 
--     account_id, 
--     symbol, 
--     position_type,
--     COUNT(*) as duplicate_count
-- FROM snaptrade_positions
-- GROUP BY account_id, symbol, position_type
-- HAVING COUNT(*) > 1
-- ORDER BY duplicate_count DESC;

-- ====================================
-- 步骤 2: 删除重复数据，只保留最新的一条
-- ====================================
-- 使用 CTE 找出重复的记录，保留 created_at 最新的那条
DELETE FROM snaptrade_positions
WHERE id IN (
    SELECT id FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY account_id, symbol, position_type 
                ORDER BY updated_at DESC, created_at DESC, id DESC
            ) as row_num
        FROM snaptrade_positions
    ) duplicates
    WHERE row_num > 1
);

-- ====================================
-- 步骤 3: 添加唯一约束（防止未来重复插入）
-- ====================================
-- 首先检查约束是否已存在，如果不存在则添加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_position_per_account'
    ) THEN
        ALTER TABLE snaptrade_positions
        ADD CONSTRAINT unique_position_per_account 
        UNIQUE (account_id, symbol, position_type);
    END IF;
END $$;

-- ====================================
-- 步骤 4: 添加索引优化查询性能
-- ====================================
CREATE INDEX IF NOT EXISTS idx_snaptrade_positions_composite 
ON snaptrade_positions(account_id, symbol, position_type);

-- ====================================
-- 验证：查看清理后的数据
-- ====================================
-- SELECT 
--     COUNT(*) as total_positions,
--     COUNT(DISTINCT (account_id, symbol, position_type)) as unique_positions
-- FROM snaptrade_positions;

COMMENT ON CONSTRAINT unique_position_per_account ON snaptrade_positions 
IS '确保每个账户的每个持仓（按 symbol 和 position_type）只有一条记录';
