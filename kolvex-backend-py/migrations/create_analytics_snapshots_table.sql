-- ============================================================
-- 创建 analytics_snapshots 表
-- 存储定期计算的分析快照数据
-- ============================================================

-- 创建分析快照表
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id SERIAL PRIMARY KEY,
    
    -- 快照元数据
    snapshot_type VARCHAR(50) NOT NULL DEFAULT 'dashboard',  -- 快照类型：dashboard, sentiment, ticker, kol
    period_days INTEGER NOT NULL DEFAULT 7,                   -- 分析周期（天）
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- 概览统计
    total_tweets INTEGER DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    total_engagement BIGINT DEFAULT 0,
    unique_authors INTEGER DEFAULT 0,
    stock_related_tweets INTEGER DEFAULT 0,
    avg_views_per_tweet DECIMAL(12, 2) DEFAULT 0,
    avg_engagement_per_tweet DECIMAL(12, 2) DEFAULT 0,
    
    -- 情感分析
    sentiment_bullish INTEGER DEFAULT 0,
    sentiment_bearish INTEGER DEFAULT 0,
    sentiment_neutral INTEGER DEFAULT 0,
    sentiment_score DECIMAL(6, 4) DEFAULT 0,
    
    -- JSON 数据（用于存储复杂结构）
    top_tickers JSONB DEFAULT '[]'::jsonb,      -- [{ticker, count, sentiment}]
    top_kols JSONB DEFAULT '[]'::jsonb,         -- [{username, total_views, tweet_count}]
    daily_trend JSONB DEFAULT '[]'::jsonb,      -- [{date, count, views, sentiment}]
    hourly_distribution JSONB DEFAULT '[]'::jsonb,  -- [{hour, count}]
    
    -- 数据质量指标
    analyzed_tweets INTEGER DEFAULT 0,           -- 已分析的推文数
    unanalyzed_tweets INTEGER DEFAULT 0,         -- 未分析的推文数
    analysis_coverage DECIMAL(5, 2) DEFAULT 0,   -- 分析覆盖率 (%)
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_type_days 
ON analytics_snapshots(snapshot_type, period_days);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_created_at 
ON analytics_snapshots(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_type_created 
ON analytics_snapshots(snapshot_type, created_at DESC);

-- 创建唯一约束：同一类型和周期只保留最新的快照
-- 注意：如果需要保留历史，可以去掉这个约束
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_snapshots_unique 
-- ON analytics_snapshots(snapshot_type, period_days);

-- 添加注释
COMMENT ON TABLE analytics_snapshots IS '分析数据快照表，存储定期计算的统计数据';
COMMENT ON COLUMN analytics_snapshots.snapshot_type IS '快照类型：dashboard=仪表盘概览';
COMMENT ON COLUMN analytics_snapshots.period_days IS '分析周期（天数）';
COMMENT ON COLUMN analytics_snapshots.top_tickers IS 'Top 股票代码 JSON 数组';
COMMENT ON COLUMN analytics_snapshots.top_kols IS 'Top KOL JSON 数组';
COMMENT ON COLUMN analytics_snapshots.daily_trend IS '每日趋势 JSON 数组';

-- 启用 RLS（如果需要）
-- ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- 创建更新触发器
CREATE OR REPLACE FUNCTION update_analytics_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_analytics_snapshots_updated_at ON analytics_snapshots;
CREATE TRIGGER trigger_update_analytics_snapshots_updated_at
    BEFORE UPDATE ON analytics_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_snapshots_updated_at();


