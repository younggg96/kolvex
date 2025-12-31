-- 统一平台命名: 将 REDNOTE 改为 xiaohongshu，并统一使用小写
-- Unify platform naming: change REDNOTE to xiaohongshu and use lowercase

-- 步骤 1: 创建新的枚举类型
DO $$ BEGIN
    CREATE TYPE platform_type_new AS ENUM ('twitter', 'reddit', 'youtube', 'xiaohongshu');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 步骤 2: 更新 kol_subscriptions 表
-- 首先添加临时列
ALTER TABLE kol_subscriptions 
ADD COLUMN IF NOT EXISTS platform_new VARCHAR(50);

-- 转换现有数据
UPDATE kol_subscriptions 
SET platform_new = CASE 
    WHEN platform::text = 'TWITTER' THEN 'twitter'
    WHEN platform::text = 'REDDIT' THEN 'reddit'
    WHEN platform::text = 'YOUTUBE' THEN 'youtube'
    WHEN platform::text = 'REDNOTE' THEN 'xiaohongshu'
    ELSE LOWER(platform::text)
END;

-- 删除唯一约束（如果存在）
ALTER TABLE kol_subscriptions 
DROP CONSTRAINT IF EXISTS kol_subscriptions_user_id_platform_kol_id_key;

-- 删除旧列
ALTER TABLE kol_subscriptions DROP COLUMN IF EXISTS platform;

-- 重命名新列
ALTER TABLE kol_subscriptions RENAME COLUMN platform_new TO platform;

-- 更改为新的枚举类型
ALTER TABLE kol_subscriptions 
ALTER COLUMN platform TYPE platform_type_new USING platform::platform_type_new;

-- 设置默认值
ALTER TABLE kol_subscriptions 
ALTER COLUMN platform SET DEFAULT 'twitter';

-- 添加 NOT NULL 约束
ALTER TABLE kol_subscriptions 
ALTER COLUMN platform SET NOT NULL;

-- 重新创建唯一约束
ALTER TABLE kol_subscriptions 
ADD CONSTRAINT kol_subscriptions_user_id_platform_kol_id_key 
UNIQUE (user_id, platform, kol_id);

-- 步骤 3: 删除旧的枚举类型并重命名新的
DROP TYPE IF EXISTS platform_type CASCADE;
ALTER TYPE platform_type_new RENAME TO platform_type;

-- 重新创建索引
DROP INDEX IF EXISTS idx_kol_subscriptions_platform;
CREATE INDEX IF NOT EXISTS idx_kol_subscriptions_platform ON kol_subscriptions(platform);

-- 验证更新
DO $$
DECLARE
    old_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO old_count 
    FROM kol_subscriptions 
    WHERE platform::text NOT IN ('twitter', 'reddit', 'youtube', 'xiaohongshu');
    
    IF old_count > 0 THEN
        RAISE NOTICE '警告: 还有 % 条记录未正确转换', old_count;
    ELSE
        RAISE NOTICE '所有记录已成功转换为新的平台命名';
    END IF;
END $$;

