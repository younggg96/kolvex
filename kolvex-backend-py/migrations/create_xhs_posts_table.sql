-- =====================================================
-- 小红书美股帖子表
-- 用于存储从小红书爬取的美股相关帖子
-- =====================================================

-- 创建 xhs_posts 表
CREATE TABLE IF NOT EXISTS xhs_posts (
    -- 主键
    id BIGSERIAL PRIMARY KEY,
    
    -- 小红书笔记信息
    note_id VARCHAR(64) UNIQUE,                     -- 小红书笔记 ID
    post_hash VARCHAR(32) UNIQUE NOT NULL,          -- 内容哈希（用于去重）
    title TEXT,                                      -- 帖子标题
    content TEXT,                                    -- 帖子内容
    note_type VARCHAR(20) DEFAULT 'normal',          -- 笔记类型: normal/video
    permalink TEXT,                                  -- 帖子链接
    
    -- 作者信息
    author_name VARCHAR(255),                        -- 作者名称
    author_id VARCHAR(64),                           -- 作者 ID
    author_avatar TEXT,                              -- 作者头像 URL
    
    -- 媒体资源
    cover_url TEXT,                                  -- 封面图 URL
    image_urls JSONB,                                -- 图片 URL 列表
    video_url TEXT,                                  -- 视频 URL
    
    -- 互动数据
    like_count INTEGER DEFAULT 0,                    -- 点赞数
    collect_count INTEGER DEFAULT 0,                 -- 收藏数
    comment_count INTEGER DEFAULT 0,                 -- 评论数
    share_count INTEGER DEFAULT 0,                   -- 分享数
    
    -- 标签和分类
    tags JSONB,                                      -- 标签列表
    search_keyword VARCHAR(100),                     -- 搜索关键词
    
    -- AI 分析结果
    ai_sentiment VARCHAR(20),                        -- 情感: bullish/bearish/neutral
    ai_sentiment_confidence DECIMAL(5,4),            -- 情感置信度 (0-1)
    ai_sentiment_reasoning TEXT,                     -- 情感分析理由
    ai_tickers JSONB,                                -- 提取的股票代码列表
    ai_tags JSONB,                                   -- AI 生成的标签
    ai_summary TEXT,                                 -- AI 摘要
    ai_trading_signal VARCHAR(20),                   -- 交易信号: buy/sell/hold
    ai_is_stock_related BOOLEAN DEFAULT FALSE,       -- 是否股票相关
    ai_stock_related_confidence DECIMAL(5,4),        -- 股票相关性置信度
    ai_stock_related_reason TEXT,                    -- 股票相关性判断理由
    ai_analyzed_at TIMESTAMPTZ,                      -- AI 分析时间
    ai_model VARCHAR(50),                            -- 使用的 AI 模型
    
    -- 时间戳
    created_at TIMESTAMPTZ,                          -- 帖子创建时间
    scraped_at TIMESTAMPTZ DEFAULT NOW(),            -- 爬取时间
    updated_at TIMESTAMPTZ DEFAULT NOW()             -- 更新时间
);

-- =====================================================
-- 索引
-- =====================================================

-- 笔记 ID 索引（快速查找）
CREATE INDEX IF NOT EXISTS idx_xhs_posts_note_id ON xhs_posts(note_id);

-- 内容哈希索引（去重检查）
CREATE INDEX IF NOT EXISTS idx_xhs_posts_hash ON xhs_posts(post_hash);

-- 搜索关键词索引
CREATE INDEX IF NOT EXISTS idx_xhs_posts_keyword ON xhs_posts(search_keyword);

-- 作者索引
CREATE INDEX IF NOT EXISTS idx_xhs_posts_author ON xhs_posts(author_name);

-- 时间索引（按时间查询）
CREATE INDEX IF NOT EXISTS idx_xhs_posts_created_at ON xhs_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xhs_posts_scraped_at ON xhs_posts(scraped_at DESC);

-- AI 分析索引
CREATE INDEX IF NOT EXISTS idx_xhs_posts_sentiment ON xhs_posts(ai_sentiment);
CREATE INDEX IF NOT EXISTS idx_xhs_posts_stock_related ON xhs_posts(ai_is_stock_related);

-- 股票代码索引（GIN 索引用于 JSONB 数组搜索）
CREATE INDEX IF NOT EXISTS idx_xhs_posts_tickers ON xhs_posts USING GIN (ai_tickers);

-- 标签索引
CREATE INDEX IF NOT EXISTS idx_xhs_posts_tags ON xhs_posts USING GIN (tags);

-- =====================================================
-- 触发器：自动更新 updated_at
-- =====================================================

-- 创建触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_xhs_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_xhs_posts_updated_at ON xhs_posts;
CREATE TRIGGER trigger_xhs_posts_updated_at
    BEFORE UPDATE ON xhs_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_xhs_posts_updated_at();

-- =====================================================
-- 启用 RLS（行级安全）
-- =====================================================

ALTER TABLE xhs_posts ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取
CREATE POLICY "Allow public read access on xhs_posts"
    ON xhs_posts
    FOR SELECT
    USING (true);

-- 只允许 service role 写入
CREATE POLICY "Allow service role to insert xhs_posts"
    ON xhs_posts
    FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Allow service role to update xhs_posts"
    ON xhs_posts
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 示例查询
-- =====================================================

-- 1. 获取最新的美股相关帖子
-- SELECT * FROM xhs_posts 
-- WHERE ai_is_stock_related = true 
-- ORDER BY scraped_at DESC 
-- LIMIT 20;

-- 2. 按股票代码查询
-- SELECT * FROM xhs_posts 
-- WHERE ai_tickers ? 'NVDA'
-- ORDER BY like_count DESC;

-- 3. 获取看涨情绪的帖子
-- SELECT * FROM xhs_posts 
-- WHERE ai_sentiment = 'bullish' 
-- AND ai_sentiment_confidence > 0.7
-- ORDER BY scraped_at DESC;

-- 4. 按关键词统计
-- SELECT search_keyword, COUNT(*) as count
-- FROM xhs_posts
-- GROUP BY search_keyword
-- ORDER BY count DESC;

-- 5. 热门作者
-- SELECT author_name, COUNT(*) as posts, SUM(like_count) as total_likes
-- FROM xhs_posts
-- GROUP BY author_name
-- ORDER BY total_likes DESC
-- LIMIT 10;

