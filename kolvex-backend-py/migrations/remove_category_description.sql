-- 迁移脚本: 删除 kol_profiles 表中的 category 和 description 字段
-- 以及 kol_tweets 表中的 category 字段
-- 执行时间: 运行此脚本前请备份数据

-- ============================================================
-- 1. 先删除依赖的视图
-- ============================================================

DROP VIEW IF EXISTS v_tweets_pending_analysis;
DROP VIEW IF EXISTS v_stock_related_tweets;
DROP VIEW IF EXISTS v_category_stats;


-- ============================================================
-- 2. 删除 kol_tweets 表的 category 字段
-- ============================================================

ALTER TABLE kol_tweets DROP COLUMN IF EXISTS category;


-- ============================================================
-- 3. 删除 kol_profiles 表的 category 和 description 字段
-- ============================================================

ALTER TABLE kol_profiles DROP COLUMN IF EXISTS category;
ALTER TABLE kol_profiles DROP COLUMN IF EXISTS description;


-- ============================================================
-- 4. 重建必要的视图（不包含 category）
-- ============================================================

-- 重建 v_tweets_pending_analysis 视图（待 AI 分析的推文）
CREATE OR REPLACE VIEW v_tweets_pending_analysis AS
SELECT 
    id,
    username,
    tweet_text,
    created_at,
    permalink,
    like_count,
    retweet_count,
    reply_count,
    views_count,
    scraped_at
FROM kol_tweets
WHERE ai_analyzed_at IS NULL
ORDER BY created_at DESC;

-- 重建 v_stock_related_tweets 视图（股市相关推文）
CREATE OR REPLACE VIEW v_stock_related_tweets AS
SELECT 
    id,
    username,
    tweet_text,
    created_at,
    permalink,
    like_count,
    retweet_count,
    reply_count,
    views_count,
    ai_sentiment,
    ai_tickers,
    ai_tags,
    ai_summary,
    ai_analyzed_at
FROM kol_tweets
WHERE ai_is_stock_related = true
ORDER BY created_at DESC;


-- ============================================================
-- 完成
-- ============================================================

-- 验证修改
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'kol_profiles';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'kol_tweets';
