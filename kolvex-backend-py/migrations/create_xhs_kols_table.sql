-- =====================================================
-- 小红书 KOL 博主表
-- 用于存储从小红书爬取的 KOL 博主信息
-- =====================================================

-- 创建 xhs_kols 表
CREATE TABLE IF NOT EXISTS xhs_kols (
    -- 主键
    id BIGSERIAL PRIMARY KEY,
    
    -- KOL 基础信息
    user_id VARCHAR(64) UNIQUE NOT NULL,              -- 小红书用户 ID
    nickname VARCHAR(255),                             -- 昵称
    red_id VARCHAR(64),                                -- 小红书号
    avatar_url TEXT,                                   -- 头像 URL
    description TEXT,                                  -- 个人简介
    location VARCHAR(100),                             -- 所在地
    gender VARCHAR(10),                                -- 性别
    
    -- 认证信息
    is_verified BOOLEAN DEFAULT FALSE,                 -- 是否认证
    verified_type VARCHAR(50),                         -- 认证类型
    verified_info TEXT,                                -- 认证信息
    
    -- 互动数据
    followers_count INTEGER DEFAULT 0,                 -- 粉丝数
    following_count INTEGER DEFAULT 0,                 -- 关注数
    likes_count INTEGER DEFAULT 0,                     -- 获赞数
    notes_count INTEGER DEFAULT 0,                     -- 笔记数
    collected_count INTEGER DEFAULT 0,                 -- 收藏数
    
    -- 主页链接
    profile_url TEXT,                                  -- 个人主页 URL
    
    -- 标签和分类
    tags JSONB,                                        -- 标签列表
    category VARCHAR(100),                             -- 分类（如：财经、美股等）
    
    -- 爬取来源
    source_keyword VARCHAR(100),                       -- 来源搜索关键词
    source_note_id VARCHAR(64),                        -- 来源笔记 ID
    
    -- 时间戳
    scraped_at TIMESTAMPTZ DEFAULT NOW(),              -- 爬取时间
    updated_at TIMESTAMPTZ DEFAULT NOW()               -- 更新时间
);

-- =====================================================
-- 索引
-- =====================================================

-- 用户 ID 索引
CREATE INDEX IF NOT EXISTS idx_xhs_kols_user_id ON xhs_kols(user_id);

-- 昵称索引
CREATE INDEX IF NOT EXISTS idx_xhs_kols_nickname ON xhs_kols(nickname);

-- 小红书号索引
CREATE INDEX IF NOT EXISTS idx_xhs_kols_red_id ON xhs_kols(red_id);

-- 粉丝数索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_xhs_kols_followers ON xhs_kols(followers_count DESC);

-- 时间索引
CREATE INDEX IF NOT EXISTS idx_xhs_kols_scraped_at ON xhs_kols(scraped_at DESC);

-- 分类索引
CREATE INDEX IF NOT EXISTS idx_xhs_kols_category ON xhs_kols(category);

-- 标签索引
CREATE INDEX IF NOT EXISTS idx_xhs_kols_tags ON xhs_kols USING GIN (tags);

-- =====================================================
-- 触发器：自动更新 updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_xhs_kols_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_xhs_kols_updated_at ON xhs_kols;
CREATE TRIGGER trigger_xhs_kols_updated_at
    BEFORE UPDATE ON xhs_kols
    FOR EACH ROW
    EXECUTE FUNCTION update_xhs_kols_updated_at();

-- =====================================================
-- 启用 RLS（行级安全）
-- =====================================================

ALTER TABLE xhs_kols ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取
CREATE POLICY "Allow public read access on xhs_kols"
    ON xhs_kols
    FOR SELECT
    USING (true);

-- 只允许 service role 写入
CREATE POLICY "Allow service role to insert xhs_kols"
    ON xhs_kols
    FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Allow service role to update xhs_kols"
    ON xhs_kols
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- xhs_posts 表添加 author_id 外键关联（可选）
-- =====================================================

-- 为 xhs_posts 添加 author_id 索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_xhs_posts_author_id ON xhs_posts(author_id);

-- =====================================================
-- 示例查询
-- =====================================================

-- 1. 获取粉丝数最多的 KOL
-- SELECT * FROM xhs_kols 
-- ORDER BY followers_count DESC 
-- LIMIT 20;

-- 2. 获取某个 KOL 的所有帖子
-- SELECT p.* FROM xhs_posts p
-- JOIN xhs_kols k ON p.author_id = k.user_id
-- WHERE k.nickname = 'xxx'
-- ORDER BY p.created_at DESC;

-- 3. 获取财经类 KOL
-- SELECT * FROM xhs_kols 
-- WHERE category = '财经'
-- ORDER BY followers_count DESC;

