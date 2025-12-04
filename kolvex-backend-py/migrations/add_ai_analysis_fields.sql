-- 迁移脚本: 为 kol_tweets 表添加 AI 分析字段
-- 运行方式: 在 Supabase SQL Editor 中执行

-- ============================================================
-- 1. 情感分析字段
-- ============================================================

-- 情感值: bullish, bearish, neutral
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_sentiment TEXT;

-- 情感置信度: 0.0 - 1.0
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_sentiment_confidence DECIMAL(3,2);

-- 情感分析理由
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_sentiment_reasoning TEXT;

-- ============================================================
-- 2. 股票代码提取
-- ============================================================

-- 提取的股票代码列表 (JSON 数组)
-- 格式: ["AAPL", "NVDA", "TSLA"]
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_tickers JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- 3. 自动标签
-- ============================================================

-- AI 生成的标签列表 (JSON 数组)
-- 格式: ["tech", "earnings", "bullish", "breaking-news"]
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_tags JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- 4. 投资信号
-- ============================================================

-- 投资信号 (JSON 对象)
-- 格式: {"action": "buy", "tickers": ["AAPL"], "confidence": 0.7}
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_trading_signal JSONB;

-- ============================================================
-- 5. 摘要
-- ============================================================

-- AI 生成的中文摘要
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- AI 生成的英文摘要 (可选)
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_summary_en TEXT;

-- ============================================================
-- 6. 分析元数据
-- ============================================================

-- AI 分析时间
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

-- 使用的 AI 模型
ALTER TABLE kol_tweets 
ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- ============================================================
-- 添加注释
-- ============================================================

COMMENT ON COLUMN kol_tweets.ai_sentiment IS '情感分析结果: bullish(看涨), bearish(看跌), neutral(中性)';
COMMENT ON COLUMN kol_tweets.ai_sentiment_confidence IS '情感分析置信度 (0.0-1.0)';
COMMENT ON COLUMN kol_tweets.ai_sentiment_reasoning IS '情感分析理由';
COMMENT ON COLUMN kol_tweets.ai_tickers IS '提取的股票代码列表 (JSON 数组)';
COMMENT ON COLUMN kol_tweets.ai_tags IS 'AI 生成的标签列表 (JSON 数组)';
COMMENT ON COLUMN kol_tweets.ai_trading_signal IS '投资信号 {"action": "buy/sell/hold", "tickers": [...], "confidence": 0.7}';
COMMENT ON COLUMN kol_tweets.ai_summary IS 'AI 生成的中文摘要';
COMMENT ON COLUMN kol_tweets.ai_summary_en IS 'AI 生成的英文摘要';
COMMENT ON COLUMN kol_tweets.ai_analyzed_at IS 'AI 分析完成时间';
COMMENT ON COLUMN kol_tweets.ai_model IS '使用的 AI 模型名称';

-- ============================================================
-- 创建索引
-- ============================================================

-- 情感索引 (方便按情感筛选)
CREATE INDEX IF NOT EXISTS idx_kol_tweets_ai_sentiment ON kol_tweets(ai_sentiment);

-- 股票代码索引 (GIN 索引支持 JSONB 数组查询)
CREATE INDEX IF NOT EXISTS idx_kol_tweets_ai_tickers ON kol_tweets USING GIN(ai_tickers);

-- 标签索引
CREATE INDEX IF NOT EXISTS idx_kol_tweets_ai_tags ON kol_tweets USING GIN(ai_tags);

-- 分析时间索引 (方便找未分析的推文)
CREATE INDEX IF NOT EXISTS idx_kol_tweets_ai_analyzed_at ON kol_tweets(ai_analyzed_at);

-- ============================================================
-- 创建查询未分析推文的视图
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
-- 创建按情感统计的视图
-- ============================================================

CREATE OR REPLACE VIEW v_sentiment_stats AS
SELECT 
    ai_sentiment,
    COUNT(*) as count,
    AVG(ai_sentiment_confidence) as avg_confidence
FROM kol_tweets
WHERE ai_sentiment IS NOT NULL
GROUP BY ai_sentiment;

