-- =====================================================
-- 统一平台数据结构迁移脚本
-- 将 xhs_kols 合并入 kol_profiles
-- 将 xhs_posts 合并入 kol_tweets
-- 添加 platform 字段区分不同平台
-- =====================================================

-- ============================================================
-- PART 1: 更新 kol_profiles 表结构
-- ============================================================

-- 1.1 添加 platform 字段
ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'twitter';

-- 1.2 添加平台特定用户 ID 字段（用于存储各平台原始 ID）
ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS platform_user_id VARCHAR(255);

-- 1.3 添加小红书特有字段
ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS red_id VARCHAR(64);

ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS collected_count INTEGER DEFAULT 0;

ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS verified_info TEXT;

ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS profile_url TEXT;

ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS tags JSONB;

ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS source_keyword VARCHAR(100);

ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS source_note_id VARCHAR(64);

ALTER TABLE kol_profiles 
ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;

-- 1.4 为现有 Twitter 数据设置 platform_user_id
UPDATE kol_profiles 
SET platform_user_id = username 
WHERE platform_user_id IS NULL AND platform = 'twitter';

-- 1.5 创建唯一索引（platform + platform_user_id）
-- 先删除旧的 username 唯一约束（如果存在）
ALTER TABLE kol_profiles DROP CONSTRAINT IF EXISTS kol_profiles_username_key;

-- 创建新的复合唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_kol_profiles_platform_user 
ON kol_profiles(platform, platform_user_id);

-- 1.6 创建平台索引
CREATE INDEX IF NOT EXISTS idx_kol_profiles_platform ON kol_profiles(platform);

-- ============================================================
-- PART 2: 更新 kol_tweets 表结构
-- ============================================================

-- 2.1 添加 platform 字段
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'twitter';

-- 2.2 添加平台特定帖子 ID 字段
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS platform_post_id VARCHAR(255);

-- 2.3 添加作者平台 ID（用于关联 kol_profiles）
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS author_platform_id VARCHAR(255);

-- 2.4 添加小红书特有字段
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS post_type VARCHAR(20) DEFAULT 'tweet';

ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS collect_count INTEGER DEFAULT 0;

ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;

ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS tags JSONB;

ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS search_keyword VARCHAR(100);

-- 2.5 为现有 Twitter 数据设置 author_platform_id
UPDATE kol_tweets 
SET author_platform_id = username 
WHERE author_platform_id IS NULL AND platform = 'twitter';

-- 2.6 创建平台索引
CREATE INDEX IF NOT EXISTS idx_kol_tweets_platform ON kol_tweets(platform);

-- 2.7 创建复合索引（platform + platform_post_id）
CREATE UNIQUE INDEX IF NOT EXISTS idx_kol_tweets_platform_post 
ON kol_tweets(platform, platform_post_id) 
WHERE platform_post_id IS NOT NULL;

-- ============================================================
-- PART 3: 迁移 xhs_kols 数据到 kol_profiles
-- ============================================================

INSERT INTO kol_profiles (
    platform,
    platform_user_id,
    username,
    display_name,
    red_id,
    avatar_url,
    bio,
    location,
    gender,
    is_verified,
    verification_type,
    verified_info,
    followers_count,
    following_count,
    posts_count,
    likes_count,
    collected_count,
    profile_url,
    tags,
    category,
    source_keyword,
    source_note_id,
    scraped_at,
    is_active,
    created_at,
    updated_at
)
SELECT 
    'xiaohongshu' as platform,
    user_id as platform_user_id,
    COALESCE(red_id, user_id) as username,
    nickname as display_name,
    red_id,
    avatar_url,
    description as bio,
    location,
    gender,
    is_verified,
    verified_type as verification_type,
    verified_info,
    COALESCE(followers_count, 0) as followers_count,
    COALESCE(following_count, 0) as following_count,
    COALESCE(notes_count, 0) as posts_count,
    COALESCE(likes_count, 0) as likes_count,
    COALESCE(collected_count, 0) as collected_count,
    profile_url,
    tags,
    category,
    source_keyword,
    source_note_id,
    scraped_at,
    TRUE as is_active,
    COALESCE(scraped_at, NOW()) as created_at,
    updated_at
FROM xhs_kols
ON CONFLICT (platform, platform_user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    red_id = EXCLUDED.red_id,
    avatar_url = EXCLUDED.avatar_url,
    bio = EXCLUDED.bio,
    location = EXCLUDED.location,
    gender = EXCLUDED.gender,
    is_verified = EXCLUDED.is_verified,
    verification_type = EXCLUDED.verification_type,
    verified_info = EXCLUDED.verified_info,
    followers_count = EXCLUDED.followers_count,
    following_count = EXCLUDED.following_count,
    posts_count = EXCLUDED.posts_count,
    likes_count = EXCLUDED.likes_count,
    collected_count = EXCLUDED.collected_count,
    profile_url = EXCLUDED.profile_url,
    tags = EXCLUDED.tags,
    category = EXCLUDED.category,
    updated_at = NOW();

-- ============================================================
-- PART 4: 迁移 xhs_posts 数据到 kol_tweets
-- ============================================================

INSERT INTO kol_tweets (
    platform,
    platform_post_id,
    tweet_hash,
    username,
    author_platform_id,
    title,
    tweet_text,
    post_type,
    permalink,
    avatar_url,
    cover_url,
    media_urls,
    video_url,
    like_count,
    collect_count,
    reply_count,
    share_count,
    tags,
    search_keyword,
    ai_sentiment,
    ai_sentiment_confidence,
    ai_sentiment_reasoning,
    ai_tickers,
    ai_tags,
    ai_summary,
    ai_trading_signal,
    ai_is_stock_related,
    ai_stock_related_confidence,
    ai_stock_related_reason,
    ai_analyzed_at,
    ai_model,
    created_at,
    scraped_at
)
SELECT 
    'xiaohongshu' as platform,
    note_id as platform_post_id,
    post_hash as tweet_hash,
    author_name as username,
    author_id as author_platform_id,
    title,
    COALESCE(content, title) as tweet_text,
    COALESCE(note_type, 'note') as post_type,
    permalink,
    NULL as avatar_url,  -- 头像从 kol_profiles 关联获取
    cover_url,
    image_urls as media_urls,
    video_url,
    COALESCE(like_count, 0) as like_count,
    COALESCE(collect_count, 0) as collect_count,
    COALESCE(comment_count, 0) as reply_count,
    COALESCE(share_count, 0) as share_count,
    tags,
    search_keyword,
    ai_sentiment,
    ai_sentiment_confidence,
    ai_sentiment_reasoning,
    ai_tickers,
    ai_tags,
    ai_summary,
    -- 将 VARCHAR 转换为 JSONB 格式
    CASE 
        WHEN ai_trading_signal IS NOT NULL THEN 
            jsonb_build_object('action', ai_trading_signal)
        ELSE NULL 
    END as ai_trading_signal,
    ai_is_stock_related,
    ai_stock_related_confidence,
    ai_stock_related_reason,
    ai_analyzed_at,
    ai_model,
    created_at,
    scraped_at
FROM xhs_posts
ON CONFLICT (tweet_hash) DO UPDATE SET
    title = EXCLUDED.title,
    tweet_text = EXCLUDED.tweet_text,
    like_count = EXCLUDED.like_count,
    collect_count = EXCLUDED.collect_count,
    reply_count = EXCLUDED.reply_count,
    share_count = EXCLUDED.share_count,
    ai_sentiment = EXCLUDED.ai_sentiment,
    ai_sentiment_confidence = EXCLUDED.ai_sentiment_confidence,
    ai_analyzed_at = EXCLUDED.ai_analyzed_at;

-- ============================================================
-- PART 5: 创建/更新视图
-- ============================================================

-- 先删除可能存在的旧视图（避免列结构冲突）
DROP VIEW IF EXISTS v_twitter_tweets CASCADE;
DROP VIEW IF EXISTS v_xhs_posts CASCADE;
DROP VIEW IF EXISTS v_twitter_profiles CASCADE;
DROP VIEW IF EXISTS v_xhs_kols CASCADE;
DROP VIEW IF EXISTS v_tweets_pending_analysis CASCADE;
DROP VIEW IF EXISTS v_sentiment_stats CASCADE;

-- 5.1 Twitter 推文视图（向后兼容）
CREATE OR REPLACE VIEW v_twitter_tweets AS
SELECT 
    id,
    username,
    tweet_text,
    tweet_hash,
    created_at,
    permalink,
    avatar_url,
    media_urls,
    is_repost,
    original_author,
    like_count,
    retweet_count,
    reply_count,
    bookmark_count,
    views_count,
    ai_sentiment,
    ai_sentiment_confidence,
    ai_sentiment_reasoning,
    ai_tickers,
    ai_tags,
    ai_summary,
    ai_trading_signal,
    ai_is_stock_related,
    ai_stock_related_confidence,
    ai_stock_related_reason,
    ai_analyzed_at,
    ai_model,
    scraped_at
FROM kol_tweets 
WHERE platform = 'twitter';

-- 5.2 小红书帖子视图（向后兼容）
CREATE OR REPLACE VIEW v_xhs_posts AS
SELECT 
    id,
    platform_post_id as note_id,
    tweet_hash as post_hash,
    title,
    tweet_text as content,
    post_type as note_type,
    permalink,
    username as author_name,
    author_platform_id as author_id,
    cover_url,
    media_urls as image_urls,
    video_url,
    like_count,
    collect_count,
    reply_count as comment_count,
    share_count,
    tags,
    search_keyword,
    ai_sentiment,
    ai_sentiment_confidence,
    ai_sentiment_reasoning,
    ai_tickers,
    ai_tags,
    ai_summary,
    ai_trading_signal,
    ai_is_stock_related,
    ai_stock_related_confidence,
    ai_stock_related_reason,
    ai_analyzed_at,
    ai_model,
    created_at,
    scraped_at
FROM kol_tweets 
WHERE platform = 'xiaohongshu';

-- 5.3 Twitter KOL 视图（向后兼容）
CREATE OR REPLACE VIEW v_twitter_profiles AS
SELECT 
    id,
    username,
    display_name,
    rest_id,
    avatar_url,
    banner_url,
    bio,
    location,
    website,
    is_verified,
    verification_type,
    followers_count,
    following_count,
    posts_count,
    join_date,
    is_active,
    created_at,
    updated_at
FROM kol_profiles 
WHERE platform = 'twitter';

-- 5.4 小红书 KOL 视图（向后兼容）
CREATE OR REPLACE VIEW v_xhs_kols AS
SELECT 
    id,
    platform_user_id as user_id,
    display_name as nickname,
    red_id,
    avatar_url,
    bio as description,
    location,
    gender,
    is_verified,
    verification_type as verified_type,
    verified_info,
    followers_count,
    following_count,
    likes_count,
    posts_count as notes_count,
    collected_count,
    profile_url,
    tags,
    category,
    source_keyword,
    source_note_id,
    scraped_at,
    updated_at
FROM kol_profiles 
WHERE platform = 'xiaohongshu';

-- ============================================================
-- PART 6: 更新 pending analysis 视图
-- ============================================================

CREATE OR REPLACE VIEW v_tweets_pending_analysis AS
SELECT 
    id,
    platform,
    username,
    title,
    tweet_text,
    created_at,
    search_keyword
FROM kol_tweets
WHERE ai_analyzed_at IS NULL
ORDER BY created_at DESC;

-- ============================================================
-- PART 7: 更新情感统计视图
-- ============================================================

CREATE OR REPLACE VIEW v_sentiment_stats AS
SELECT 
    platform,
    ai_sentiment,
    COUNT(*) as count,
    AVG(ai_sentiment_confidence) as avg_confidence
FROM kol_tweets
WHERE ai_sentiment IS NOT NULL
GROUP BY platform, ai_sentiment;

-- ============================================================
-- PART 8: 添加注释
-- ============================================================

COMMENT ON COLUMN kol_profiles.platform IS '平台: twitter, xiaohongshu, reddit, youtube';
COMMENT ON COLUMN kol_profiles.platform_user_id IS '平台特定用户ID（Twitter为username，小红书为user_id）';
COMMENT ON COLUMN kol_profiles.red_id IS '小红书号';
COMMENT ON COLUMN kol_profiles.gender IS '性别（小红书特有）';
COMMENT ON COLUMN kol_profiles.likes_count IS '获赞数（小红书特有）';
COMMENT ON COLUMN kol_profiles.collected_count IS '收藏数（小红书特有）';
COMMENT ON COLUMN kol_profiles.category IS 'KOL分类（如财经、美股等）';

COMMENT ON COLUMN kol_tweets.platform IS '平台: twitter, xiaohongshu, reddit, youtube';
COMMENT ON COLUMN kol_tweets.platform_post_id IS '平台特定帖子ID（Twitter为tweet_id，小红书为note_id）';
COMMENT ON COLUMN kol_tweets.author_platform_id IS '作者平台ID，用于关联kol_profiles';
COMMENT ON COLUMN kol_tweets.title IS '帖子标题（小红书特有）';
COMMENT ON COLUMN kol_tweets.post_type IS '帖子类型: tweet, retweet, note, video';
COMMENT ON COLUMN kol_tweets.cover_url IS '封面图URL（小红书特有）';
COMMENT ON COLUMN kol_tweets.video_url IS '视频URL';
COMMENT ON COLUMN kol_tweets.collect_count IS '收藏数（小红书特有）';
COMMENT ON COLUMN kol_tweets.share_count IS '分享数';
COMMENT ON COLUMN kol_tweets.tags IS '标签列表';

-- ============================================================
-- 注意事项
-- ============================================================
-- 
-- 1. 运行此迁移后，旧的 xhs_kols 和 xhs_posts 表可以保留作为备份
--    或在确认迁移成功后删除
-- 
-- 2. 已创建向后兼容的视图：
--    - v_twitter_tweets: 只显示 Twitter 推文
--    - v_xhs_posts: 只显示小红书帖子
--    - v_twitter_profiles: 只显示 Twitter KOL
--    - v_xhs_kols: 只显示小红书 KOL
--
-- 3. 应用代码需要更新为使用 platform 字段进行过滤
--

