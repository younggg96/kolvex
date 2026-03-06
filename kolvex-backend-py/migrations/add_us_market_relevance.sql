-- Add us_market_relevance column to news_articles table
-- Values: 'high', 'medium', 'low', 'none' (NULL = not yet analyzed)

ALTER TABLE news_articles
ADD COLUMN IF NOT EXISTS us_market_relevance TEXT DEFAULT NULL;

COMMENT ON COLUMN news_articles.us_market_relevance IS 'AI-assessed relevance to US stock market: high/medium/low/none';

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_news_articles_us_market_relevance
ON news_articles (us_market_relevance)
WHERE us_market_relevance IS NOT NULL;
