-- 更新 platform_type 枚举为小写值，移除 REDNOTE
-- Update platform_type enum to lowercase values, remove REDNOTE

-- PostgreSQL 不直接支持重命名枚举值，需要创建新类型并迁移

BEGIN;

-- 1. 创建新的小写枚举类型
CREATE TYPE platform_type_new AS ENUM ('twitter', 'reddit', 'youtube', 'xiaohongshu');

-- 2. 更新 kol_subscriptions 表的 platform 列
-- 首先添加临时列
ALTER TABLE kol_subscriptions ADD COLUMN platform_new platform_type_new;

-- 转换现有数据到小写，REDNOTE 改为 xiaohongshu
UPDATE kol_subscriptions SET platform_new = 
    CASE 
        WHEN platform::text = 'TWITTER' THEN 'twitter'::platform_type_new
        WHEN platform::text = 'REDDIT' THEN 'reddit'::platform_type_new
        WHEN platform::text = 'YOUTUBE' THEN 'youtube'::platform_type_new
        WHEN platform::text = 'REDNOTE' THEN 'xiaohongshu'::platform_type_new
        WHEN platform::text = 'twitter' THEN 'twitter'::platform_type_new
        WHEN platform::text = 'reddit' THEN 'reddit'::platform_type_new
        WHEN platform::text = 'youtube' THEN 'youtube'::platform_type_new
        WHEN platform::text = 'xiaohongshu' THEN 'xiaohongshu'::platform_type_new
        WHEN platform::text = 'rednote' THEN 'xiaohongshu'::platform_type_new
        ELSE 'twitter'::platform_type_new
    END;

-- 删除旧列并重命名新列
ALTER TABLE kol_subscriptions DROP COLUMN platform;
ALTER TABLE kol_subscriptions RENAME COLUMN platform_new TO platform;

-- 设置默认值和非空约束
ALTER TABLE kol_subscriptions ALTER COLUMN platform SET DEFAULT 'twitter'::platform_type_new;
ALTER TABLE kol_subscriptions ALTER COLUMN platform SET NOT NULL;

-- 3. 删除旧的枚举类型
DROP TYPE IF EXISTS platform_type;

-- 4. 重命名新枚举类型为原名称
ALTER TYPE platform_type_new RENAME TO platform_type;

-- 5. 重建索引
CREATE INDEX IF NOT EXISTS idx_kol_subscriptions_platform ON kol_subscriptions(platform);

COMMIT;
