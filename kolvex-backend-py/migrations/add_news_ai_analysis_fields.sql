-- ============================================================
-- 为 news_articles 表添加 AI 分析字段
-- 支持 Ollama + Llama-3-8B-Finance 分析结果存储
-- ============================================================

-- 添加 AI 分析相关字段
ALTER TABLE news_articles 
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sentiment_confidence FLOAT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sentiment_reasoning TEXT,
ADD COLUMN IF NOT EXISTS trading_action VARCHAR(10) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS trading_confidence FLOAT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_tickers TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS key_points TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS market_impact VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS impact_confidence FLOAT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS analysis_version INT DEFAULT 1;

-- 创建情感索引
CREATE INDEX IF NOT EXISTS idx_news_articles_sentiment 
    ON news_articles(sentiment);

-- 创建交易信号索引
CREATE INDEX IF NOT EXISTS idx_news_articles_trading_action 
    ON news_articles(trading_action);

-- 创建市场影响索引
CREATE INDEX IF NOT EXISTS idx_news_articles_market_impact 
    ON news_articles(market_impact);

-- 创建分析时间索引
CREATE INDEX IF NOT EXISTS idx_news_articles_analyzed_at 
    ON news_articles(analyzed_at);

-- 创建 AI 标签 GIN 索引
CREATE INDEX IF NOT EXISTS idx_news_articles_ai_tags 
    ON news_articles USING GIN(ai_tags);

-- 创建 AI 股票代码 GIN 索引
CREATE INDEX IF NOT EXISTS idx_news_articles_ai_tickers 
    ON news_articles USING GIN(ai_tickers);

-- 添加字段注释
COMMENT ON COLUMN news_articles.ai_summary IS 'AI 生成的新闻摘要';
COMMENT ON COLUMN news_articles.sentiment IS '情感分析结果: bullish/bearish/neutral';
COMMENT ON COLUMN news_articles.sentiment_confidence IS '情感分析置信度 (0-1)';
COMMENT ON COLUMN news_articles.sentiment_reasoning IS '情感分析原因说明';
COMMENT ON COLUMN news_articles.trading_action IS '交易信号: buy/sell/hold/null';
COMMENT ON COLUMN news_articles.trading_confidence IS '交易信号置信度 (0-1)';
COMMENT ON COLUMN news_articles.ai_tags IS 'AI 提取的标签';
COMMENT ON COLUMN news_articles.ai_tickers IS 'AI 识别的股票代码';
COMMENT ON COLUMN news_articles.key_points IS 'AI 提取的关键要点';
COMMENT ON COLUMN news_articles.market_impact IS '市场影响评估: high/medium/low/none';
COMMENT ON COLUMN news_articles.impact_confidence IS '市场影响置信度 (0-1)';
COMMENT ON COLUMN news_articles.analyzed_at IS 'AI 分析完成时间';
COMMENT ON COLUMN news_articles.ai_model IS '使用的 AI 模型名称';
COMMENT ON COLUMN news_articles.analysis_version IS '分析算法版本';

