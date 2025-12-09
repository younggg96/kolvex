-- ============================================================
-- 创建 news_articles 表
-- 用于存储 Benzinga 等来源的金融新闻数据
-- ============================================================

-- 创建新闻文章表
CREATE TABLE IF NOT EXISTS news_articles (
    id BIGSERIAL PRIMARY KEY,
    
    -- 基础信息
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT UNIQUE NOT NULL,  -- 使用 URL 作为唯一标识，防止重复
    published_at TIMESTAMPTZ,
    
    -- 分类和标签
    tickers TEXT[] DEFAULT '{}',  -- 相关股票代码数组
    tags TEXT[] DEFAULT '{}',      -- 标签数组
    source VARCHAR(50) DEFAULT 'benzinga',  -- 新闻来源
    
    -- 元数据
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at 
    ON news_articles(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_articles_source 
    ON news_articles(source);

CREATE INDEX IF NOT EXISTS idx_news_articles_tickers 
    ON news_articles USING GIN(tickers);

CREATE INDEX IF NOT EXISTS idx_news_articles_tags 
    ON news_articles USING GIN(tags);

-- 创建全文搜索索引
CREATE INDEX IF NOT EXISTS idx_news_articles_title_search 
    ON news_articles USING GIN(to_tsvector('english', title));

CREATE INDEX IF NOT EXISTS idx_news_articles_summary_search 
    ON news_articles USING GIN(to_tsvector('english', COALESCE(summary, '')));

-- 创建 updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_news_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_news_articles_updated_at ON news_articles;
CREATE TRIGGER trigger_news_articles_updated_at
    BEFORE UPDATE ON news_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_news_articles_updated_at();

-- 添加表注释
COMMENT ON TABLE news_articles IS '金融新闻文章表 - 存储 Benzinga 等来源的新闻';
COMMENT ON COLUMN news_articles.id IS '主键 ID';
COMMENT ON COLUMN news_articles.title IS '文章标题';
COMMENT ON COLUMN news_articles.summary IS '文章摘要 (已清理 HTML)';
COMMENT ON COLUMN news_articles.url IS '原文 URL (唯一)';
COMMENT ON COLUMN news_articles.published_at IS '发布时间';
COMMENT ON COLUMN news_articles.tickers IS '相关股票代码数组';
COMMENT ON COLUMN news_articles.tags IS '文章标签数组';
COMMENT ON COLUMN news_articles.source IS '新闻来源 (benzinga, reuters, etc.)';

-- ============================================================
-- RLS (Row Level Security) 策略
-- ============================================================

-- 启用 RLS
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取 (公开新闻)
CREATE POLICY "Allow public read access" ON news_articles
    FOR SELECT
    USING (true);

-- 只允许 service_role 写入
CREATE POLICY "Allow service role full access" ON news_articles
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

