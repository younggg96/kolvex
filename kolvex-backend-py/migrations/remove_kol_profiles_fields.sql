-- 删除 kol_profiles 表中不再需要的字段
-- 字段：verified_info, tags, category, source_keyword, gender, source_note_id, scraped_at, posts_count

-- ============================================================
-- STEP 1: 先删除依赖的视图
-- ============================================================

DROP VIEW IF EXISTS v_xhs_kols CASCADE;
DROP VIEW IF EXISTS v_twitter_profiles CASCADE;

-- ============================================================
-- STEP 2: 删除字段
-- ============================================================

ALTER TABLE kol_profiles 
DROP COLUMN IF EXISTS verified_info,
DROP COLUMN IF EXISTS tags,
DROP COLUMN IF EXISTS category,
DROP COLUMN IF EXISTS source_keyword,
DROP COLUMN IF EXISTS gender,
DROP COLUMN IF EXISTS source_note_id,
DROP COLUMN IF EXISTS scraped_at,
DROP COLUMN IF EXISTS posts_count;

-- ============================================================
-- STEP 3: 重新创建视图（不包含被删除的字段）
-- ============================================================

-- Twitter KOL 视图
CREATE OR REPLACE VIEW v_twitter_profiles AS
SELECT 
    id,
    username,
    display_name,
    avatar_url,
    banner_url,
    bio,
    location,
    website,
    is_verified,
    verification_type,
    rest_id,
    followers_count,
    following_count,
    join_date,
    is_active,
    created_at,
    updated_at
FROM kol_profiles 
WHERE platform = 'twitter';

-- 小红书 KOL 视图
CREATE OR REPLACE VIEW v_xhs_kols AS
SELECT 
    id,
    platform_user_id as user_id,
    display_name as nickname,
    red_id,
    avatar_url,
    bio as description,
    location,
    is_verified,
    verification_type as verified_type,
    followers_count,
    following_count,
    likes_count,
    collected_count,
    profile_url,
    updated_at
FROM kol_profiles 
WHERE platform = 'xiaohongshu';

