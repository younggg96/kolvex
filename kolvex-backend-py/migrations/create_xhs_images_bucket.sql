-- ============================================================
-- 创建小红书图片存储 Bucket
-- ============================================================
-- 说明：小红书的图片 URL 有时效性（通常 1-2 小时），
-- 因此需要在爬取时立即下载并存储到 Supabase Storage。

-- 1. 创建 Bucket（如果不存在）
-- 注意：这需要在 Supabase Dashboard 或通过 API 创建
-- 以下是通过 SQL 的方式（需要 service_role 权限）

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'xhs-images',
    'xhs-images',
    true,  -- 设置为公开访问
    10485760,  -- 10MB 文件大小限制
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[];

-- 2. 设置 Storage 策略：允许公开读取
CREATE POLICY "Public Access for xhs-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'xhs-images');

-- 3. 设置 Storage 策略：允许服务端上传（使用 service_role key）
-- 注意：这里使用 service_role，所以不需要 RLS 策略来控制上传
-- 如果需要限制上传，可以添加以下策略：
CREATE POLICY "Service Role Upload for xhs-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'xhs-images');

-- 4. 允许服务端更新和删除
CREATE POLICY "Service Role Update for xhs-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'xhs-images');

CREATE POLICY "Service Role Delete for xhs-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'xhs-images');

-- ============================================================
-- 手动创建说明（如果 SQL 不起作用）
-- ============================================================
-- 
-- 1. 登录 Supabase Dashboard
-- 2. 进入 Storage 页面
-- 3. 点击 "New bucket"
-- 4. 填写：
--    - Name: xhs-images
--    - Public bucket: ✓ (勾选)
--    - Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
--    - File size limit: 10 MB
-- 5. 点击 "Create bucket"
-- 
-- ============================================================

