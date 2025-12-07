-- 迁移脚本: 为 kol_tweets 表添加股市相关性字段
-- 运行方式: 在 Supabase SQL Editor 中执行
-- 日期: 2024-12

-- ============================================================
-- 股市相关性字段
-- ============================================================

-- 是否与股市相关: true/false
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_is_stock_related BOOLEAN DEFAULT NULL;

-- 股市相关性置信度: 0.0 - 1.0
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_stock_related_confidence DECIMAL(3,2);

-- 股市相关性分析理由
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_stock_related_reason TEXT;

-- ============================================================
-- 添加注释
-- ============================================================

COMMENT ON COLUMN kol_tweets.ai_is_stock_related IS '推文是否与股市/金融市场相关';
COMMENT ON COLUMN kol_tweets.ai_stock_related_confidence IS '股市相关性置信度 (0.0-1.0)';
COMMENT ON COLUMN kol_tweets.ai_stock_related_reason IS '股市相关性分析理由';

-- ============================================================
-- 创建索引
-- ============================================================

-- 股市相关性索引 (方便筛选股市相关推文)
CREATE INDEX IF NOT EXISTS idx_kol_tweets_ai_is_stock_related ON kol_tweets(ai_is_stock_related);

-- ============================================================
-- 更新待分析推文视图
-- ============================================================

CREATE OR REPLACE VIEW v_tweets_pending_analysis AS
SELECT 
    id,
    username,
    tweet_text,
    created_at,
    category
FROM kol_tweets
WHERE ai_analyzed_at IS NULL
ORDER BY created_at DESC;

-- ============================================================
-- 创建股市相关推文视图
-- ============================================================

CREATE OR REPLACE VIEW v_stock_related_tweets AS
SELECT 
    id,
    username,
    tweet_text,
    created_at,
    category,
    ai_sentiment,
    ai_tickers,
    ai_tags,
    ai_is_stock_related,
    ai_stock_related_confidence
FROM kol_tweets
WHERE ai_is_stock_related = true
ORDER BY created_at DESC;

-- ============================================================
-- 创建股市相关性统计视图
-- ============================================================

CREATE OR REPLACE VIEW v_stock_related_stats AS
SELECT 
    ai_is_stock_related,
    COUNT(*) as count,
    AVG(ai_stock_related_confidence) as avg_confidence
FROM kol_tweets
WHERE ai_is_stock_related IS NOT NULL
GROUP BY ai_is_stock_related;

