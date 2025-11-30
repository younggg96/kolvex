-- =====================================================
-- Kolvex Backend - Supabase 数据库设置
-- =====================================================
-- 在 Supabase SQL Editor 中执行此文件来创建必要的表和触发器

-- =====================================================
-- 1. 创建枚举类型
-- =====================================================

-- 会员类型
CREATE TYPE membership_enum AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- 主题
CREATE TYPE theme_enum AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- 通知方式
CREATE TYPE notification_method_enum AS ENUM ('EMAIL', 'MESSAGE');

-- =====================================================
-- 2. 创建用户资料表
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    -- 主键（与 auth.users.id 关联）
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 基本信息
    email TEXT NOT NULL UNIQUE,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    phone_e164 TEXT,
    
    -- 会员和设置
    membership membership_enum NOT NULL DEFAULT 'FREE',
    theme theme_enum DEFAULT 'SYSTEM',
    
    -- 通知设置
    is_subscribe_newsletter BOOLEAN DEFAULT FALSE,
    notification_method notification_method_enum DEFAULT 'EMAIL',
    
    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_membership ON public.user_profiles(membership);

-- =====================================================
-- 3. 创建 RLS (Row Level Security) 策略
-- =====================================================

-- 启用 RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 策略：用户可以查看自己的资料
CREATE POLICY "Users can view own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

-- 策略：用户可以更新自己的资料
CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = id);

-- 策略：用户可以删除自己的资料
CREATE POLICY "Users can delete own profile"
ON public.user_profiles
FOR DELETE
USING (auth.uid() = id);

-- 策略：允许系统插入新用户资料（通过触发器）
CREATE POLICY "Enable insert for authenticated users only"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 策略：所有人可以查看其他用户的公开资料（可选，根据需求启用）
-- CREATE POLICY "Public profiles are viewable by everyone"
-- ON public.user_profiles
-- FOR SELECT
-- USING (true);

-- =====================================================
-- 4. 创建触发器 - 自动更新 updated_at
-- =====================================================

-- 创建更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. 创建触发器 - 自动创建用户资料
-- =====================================================

-- 当新用户注册时，自动在 user_profiles 表中创建记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建触发器：当 auth.users 中创建新用户时自动执行
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 6. 创建用户追踪股票表（可选）
-- =====================================================

CREATE TABLE IF NOT EXISTS public.stock_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 确保用户不会重复追踪同一只股票
    UNIQUE(user_id, symbol)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_stock_tracking_user_id ON public.stock_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_tracking_symbol ON public.stock_tracking(symbol);

-- 启用 RLS
ALTER TABLE public.stock_tracking ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can view own tracked stocks"
ON public.stock_tracking
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracked stocks"
ON public.stock_tracking
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracked stocks"
ON public.stock_tracking
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- 7. 创建 KOL 订阅表（可选）
-- =====================================================

-- 平台枚举
CREATE TYPE platform_enum AS ENUM ('TWITTER', 'REDDIT', 'YOUTUBE', 'XIAOHONGSHU', 'REDNOTE');

CREATE TABLE IF NOT EXISTS public.kol_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    platform platform_enum NOT NULL,
    kol_id TEXT NOT NULL,
    notify BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 确保用户不会重复订阅同一个 KOL
    UNIQUE(user_id, platform, kol_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_kol_subscriptions_user_id ON public.kol_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_kol_subscriptions_platform ON public.kol_subscriptions(platform);
CREATE INDEX IF NOT EXISTS idx_kol_subscriptions_kol_id ON public.kol_subscriptions(kol_id);

-- 启用 RLS
ALTER TABLE public.kol_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can view own kol subscriptions"
ON public.kol_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own kol subscriptions"
ON public.kol_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own kol subscriptions"
ON public.kol_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own kol subscriptions"
ON public.kol_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- 8. 授予权限
-- =====================================================

-- 授予 authenticated 角色对表的访问权限
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.stock_tracking TO authenticated;
GRANT ALL ON public.kol_subscriptions TO authenticated;

-- 授予 service_role 完全权限（用于后端 API）
GRANT ALL ON public.user_profiles TO service_role;
GRANT ALL ON public.stock_tracking TO service_role;
GRANT ALL ON public.kol_subscriptions TO service_role;

-- =====================================================
-- 9. 创建 Storage Bucket 用于头像上传
-- =====================================================
-- 注意：这部分需要在 Supabase Dashboard -> Storage 中手动创建，
-- 或者使用以下 SQL（需要在 SQL Editor 中以 service_role 执行）

-- 创建 user-uploads bucket（如果不存在）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-uploads',
    'user-uploads',
    true,  -- 设为 public 以便可以通过 URL 访问头像
    5242880,  -- 5MB 文件大小限制
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- 10. Storage RLS 策略
-- =====================================================

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;

-- 策略：已认证用户可以上传头像到 avatars 文件夹
-- 文件路径格式: avatars/{user_id}-{timestamp}.{ext}
-- 使用 position + LIKE 来匹配用户 ID（UUID 格式包含 -，所以需要完整匹配）
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-uploads' AND
    (storage.foldername(name))[1] = 'avatars' AND
    storage.filename(name) LIKE (auth.uid()::text || '-%')
);

-- 策略：已认证用户可以更新自己的头像
CREATE POLICY "Authenticated users can update avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'user-uploads' AND
    (storage.foldername(name))[1] = 'avatars' AND
    storage.filename(name) LIKE (auth.uid()::text || '-%')
);

-- 策略：已认证用户可以删除自己的头像
CREATE POLICY "Authenticated users can delete avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'user-uploads' AND
    (storage.foldername(name))[1] = 'avatars' AND
    storage.filename(name) LIKE (auth.uid()::text || '-%')
);

-- 策略：任何人可以查看头像（因为 bucket 是 public 的）
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (
    bucket_id = 'user-uploads' AND
    (storage.foldername(name))[1] = 'avatars'
);

-- =====================================================
-- 完成！
-- =====================================================
-- 现在你可以通过 Supabase Auth 注册用户，
-- 用户资料会自动创建在 user_profiles 表中。
-- 
-- 测试方法：
-- 1. 在前端注册一个新用户
-- 2. 检查 user_profiles 表是否自动创建了记录
-- 3. 使用 JWT token 调用后端 API 的 /api/v1/users/me
-- 4. 测试头像上传功能
-- =====================================================

