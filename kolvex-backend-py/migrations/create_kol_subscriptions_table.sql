-- 创建 KOL 订阅表
-- Create KOL subscriptions table for tracking KOLs

-- 创建 Platform 枚举类型（如果不存在）
DO $$ BEGIN
    CREATE TYPE platform_type AS ENUM ('TWITTER', 'REDDIT', 'YOUTUBE', 'REDNOTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS kol_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform platform_type NOT NULL DEFAULT 'TWITTER',
    kol_id VARCHAR(255) NOT NULL,  -- KOL 的用户名或唯一标识
    notify BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 确保每个用户只能追踪同一 KOL 一次（基于平台和 KOL ID）
    UNIQUE(user_id, platform, kol_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_kol_subscriptions_user_id ON kol_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_kol_subscriptions_kol_id ON kol_subscriptions(kol_id);
CREATE INDEX IF NOT EXISTS idx_kol_subscriptions_platform ON kol_subscriptions(platform);

-- 添加注释
COMMENT ON TABLE kol_subscriptions IS '用户追踪 KOL 订阅表';
COMMENT ON COLUMN kol_subscriptions.id IS '记录 ID';
COMMENT ON COLUMN kol_subscriptions.user_id IS '用户 ID';
COMMENT ON COLUMN kol_subscriptions.platform IS '平台类型';
COMMENT ON COLUMN kol_subscriptions.kol_id IS 'KOL 用户名或唯一标识';
COMMENT ON COLUMN kol_subscriptions.notify IS '是否接收通知';
COMMENT ON COLUMN kol_subscriptions.created_at IS '创建时间';
COMMENT ON COLUMN kol_subscriptions.updated_at IS '更新时间';

-- 启用 RLS
ALTER TABLE kol_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看和管理自己的订阅记录
CREATE POLICY "Users can view own kol subscriptions" ON kol_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own kol subscriptions" ON kol_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own kol subscriptions" ON kol_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own kol subscriptions" ON kol_subscriptions
    FOR DELETE USING (auth.uid() = user_id);

-- 创建更新时间触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_kol_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS kol_subscriptions_updated_at ON kol_subscriptions;
CREATE TRIGGER kol_subscriptions_updated_at
    BEFORE UPDATE ON kol_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_kol_subscriptions_updated_at();

