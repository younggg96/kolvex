-- =====================================================
-- Dataroma 超级投资者数据表
-- 用于存储从 Dataroma 抓取的机构投资者信息和持仓数据
-- =====================================================

-- =====================================================
-- 1. superinvestors 表 - 投资者/基金经理基础信息
-- =====================================================

CREATE TABLE IF NOT EXISTS superinvestors (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 基础信息
    name TEXT NOT NULL,                                   -- 投资经理或机构名称
    code TEXT NOT NULL UNIQUE,                            -- Dataroma 唯一标识符 (URL 参数 m 的值)
    
    -- 扩展信息（可选，未来可手动补充）
    description TEXT,                                      -- 简介
    website TEXT,                                          -- 官网
    
    -- 元数据
    last_scraped_at TIMESTAMPTZ DEFAULT NOW(),            -- 上次抓取时间
    is_active BOOLEAN DEFAULT TRUE,                       -- 是否有效/活跃
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),                 -- 创建时间
    updated_at TIMESTAMPTZ DEFAULT NOW()                  -- 更新时间
);

-- 名称索引
CREATE INDEX IF NOT EXISTS idx_superinvestors_name ON superinvestors(name);

-- Code 索引
CREATE INDEX IF NOT EXISTS idx_superinvestors_code ON superinvestors(code);

-- 活跃状态索引
CREATE INDEX IF NOT EXISTS idx_superinvestors_is_active ON superinvestors(is_active);

-- =====================================================
-- 2. institutional_holdings 表 - 机构持仓数据
-- =====================================================

CREATE TABLE IF NOT EXISTS institutional_holdings (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联投资者
    investor_id UUID REFERENCES superinvestors(id) ON DELETE CASCADE,
    investor_code TEXT NOT NULL,                          -- 冗余存储 code，方便查询
    
    -- 持仓信息
    ticker TEXT NOT NULL,                                 -- 股票代码
    company_name TEXT,                                    -- 公司名称
    sector TEXT,                                          -- 行业板块
    
    -- 持仓数据
    shares BIGINT DEFAULT 0,                              -- 持股数量
    market_value DECIMAL(20, 2),                          -- 市值（美元）
    portfolio_percent DECIMAL(5, 2),                      -- 占投资组合百分比
    
    -- 变动数据
    change_shares BIGINT DEFAULT 0,                       -- 股数变动
    change_percent DECIMAL(10, 2),                        -- 变动百分比
    change_type TEXT,                                     -- 变动类型: 'new', 'add', 'reduce', 'sold', 'unchanged'
    
    -- 报告信息
    report_date DATE NOT NULL,                            -- 报告日期 (13F 季度截止日)
    filing_date DATE,                                     -- 申报日期
    quarter TEXT,                                         -- 季度标识，如 '2024-Q4'
    
    -- AI 分析
    ai_analysis TEXT,                                     -- AI 生成的分析解读
    ai_analysis_at TIMESTAMPTZ,                           -- AI 分析时间
    
    -- 元数据
    scraped_at TIMESTAMPTZ DEFAULT NOW(),                 -- 抓取时间
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 唯一约束：同一投资者、同一季度、同一股票只能有一条记录
    UNIQUE(investor_code, ticker, report_date)
);

-- 投资者索引
CREATE INDEX IF NOT EXISTS idx_holdings_investor_id ON institutional_holdings(investor_id);
CREATE INDEX IF NOT EXISTS idx_holdings_investor_code ON institutional_holdings(investor_code);

-- 股票代码索引
CREATE INDEX IF NOT EXISTS idx_holdings_ticker ON institutional_holdings(ticker);

-- 报告日期索引
CREATE INDEX IF NOT EXISTS idx_holdings_report_date ON institutional_holdings(report_date DESC);

-- 季度索引
CREATE INDEX IF NOT EXISTS idx_holdings_quarter ON institutional_holdings(quarter);

-- 变动类型索引
CREATE INDEX IF NOT EXISTS idx_holdings_change_type ON institutional_holdings(change_type);

-- 复合索引：按投资者和日期查询
CREATE INDEX IF NOT EXISTS idx_holdings_investor_date ON institutional_holdings(investor_code, report_date DESC);

-- 复合索引：按股票和日期查询
CREATE INDEX IF NOT EXISTS idx_holdings_ticker_date ON institutional_holdings(ticker, report_date DESC);

-- =====================================================
-- 3. 触发器：自动更新 updated_at
-- =====================================================

-- superinvestors 表触发器
CREATE OR REPLACE FUNCTION update_superinvestors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_superinvestors_updated_at ON superinvestors;
CREATE TRIGGER trigger_superinvestors_updated_at
    BEFORE UPDATE ON superinvestors
    FOR EACH ROW
    EXECUTE FUNCTION update_superinvestors_updated_at();

-- institutional_holdings 表触发器
CREATE OR REPLACE FUNCTION update_holdings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_holdings_updated_at ON institutional_holdings;
CREATE TRIGGER trigger_holdings_updated_at
    BEFORE UPDATE ON institutional_holdings
    FOR EACH ROW
    EXECUTE FUNCTION update_holdings_updated_at();

-- =====================================================
-- 4. 启用 RLS（行级安全）
-- =====================================================

-- superinvestors 表 RLS
ALTER TABLE superinvestors ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取
CREATE POLICY "Allow public read access on superinvestors"
    ON superinvestors
    FOR SELECT
    USING (true);

-- 只允许 service role 写入
CREATE POLICY "Allow service role to insert superinvestors"
    ON superinvestors
    FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Allow service role to update superinvestors"
    ON superinvestors
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service role to delete superinvestors"
    ON superinvestors
    FOR DELETE
    TO service_role
    USING (true);

-- institutional_holdings 表 RLS
ALTER TABLE institutional_holdings ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取
CREATE POLICY "Allow public read access on institutional_holdings"
    ON institutional_holdings
    FOR SELECT
    USING (true);

-- 只允许 service role 写入
CREATE POLICY "Allow service role to insert institutional_holdings"
    ON institutional_holdings
    FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Allow service role to update institutional_holdings"
    ON institutional_holdings
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service role to delete institutional_holdings"
    ON institutional_holdings
    FOR DELETE
    TO service_role
    USING (true);

-- =====================================================
-- 5. 视图：便捷查询
-- =====================================================

-- 最新季度持仓视图
CREATE OR REPLACE VIEW latest_holdings AS
SELECT DISTINCT ON (investor_code, ticker)
    h.*,
    s.name as investor_name
FROM institutional_holdings h
JOIN superinvestors s ON h.investor_code = s.code
WHERE s.is_active = true
ORDER BY investor_code, ticker, report_date DESC;

-- 热门股票视图（被多个超级投资者持有）
CREATE OR REPLACE VIEW popular_stocks AS
SELECT 
    ticker,
    company_name,
    COUNT(DISTINCT investor_code) as holder_count,
    SUM(market_value) as total_market_value,
    array_agg(DISTINCT investor_code) as holders
FROM (
    SELECT DISTINCT ON (investor_code, ticker)
        ticker,
        company_name,
        investor_code,
        market_value,
        report_date
    FROM institutional_holdings
    ORDER BY investor_code, ticker, report_date DESC
) latest
GROUP BY ticker, company_name
HAVING COUNT(DISTINCT investor_code) >= 3
ORDER BY holder_count DESC, total_market_value DESC;

-- =====================================================
-- 示例查询
-- =====================================================

-- 1. 获取所有活跃的超级投资者
-- SELECT * FROM superinvestors WHERE is_active = true ORDER BY name;

-- 2. 获取某个投资者最新的持仓
-- SELECT * FROM institutional_holdings 
-- WHERE investor_code = 'WA' 
-- ORDER BY report_date DESC, portfolio_percent DESC 
-- LIMIT 20;

-- 3. 获取某只股票被哪些超级投资者持有
-- SELECT s.name, h.shares, h.market_value, h.portfolio_percent, h.report_date
-- FROM institutional_holdings h
-- JOIN superinvestors s ON h.investor_code = s.code
-- WHERE h.ticker = 'AAPL'
-- ORDER BY h.report_date DESC, h.market_value DESC;

-- 4. 获取最近有变动的持仓
-- SELECT s.name, h.ticker, h.company_name, h.change_type, h.change_percent
-- FROM institutional_holdings h
-- JOIN superinvestors s ON h.investor_code = s.code
-- WHERE h.change_type != 'unchanged'
-- ORDER BY h.report_date DESC, ABS(h.change_percent) DESC
-- LIMIT 50;

-- 5. 获取被最多超级投资者持有的股票
-- SELECT * FROM popular_stocks LIMIT 20;

