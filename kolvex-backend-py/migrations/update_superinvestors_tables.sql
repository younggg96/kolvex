-- =====================================================
-- 更新 Dataroma 超级投资者数据表结构
-- 添加图片中显示的所有字段
-- =====================================================

-- =====================================================
-- 0. 先删除依赖的视图
-- =====================================================

DROP VIEW IF EXISTS latest_holdings CASCADE;
DROP VIEW IF EXISTS popular_stocks CASCADE;

-- =====================================================
-- 1. 更新 superinvestors 表 - 添加投资组合统计字段
-- =====================================================

-- 添加投资组合统计字段
ALTER TABLE superinvestors 
ADD COLUMN IF NOT EXISTS portfolio_value DECIMAL(20, 2),          -- 投资组合总市值
ADD COLUMN IF NOT EXISTS stock_count INTEGER DEFAULT 0,           -- 持有股票数量
ADD COLUMN IF NOT EXISTS portfolio_date VARCHAR(50),              -- 投资组合日期（如 "30 Sep 2025"）
ADD COLUMN IF NOT EXISTS period VARCHAR(20);                       -- 期间标识（如 Q3 2025）

-- =====================================================
-- 2. 更新 institutional_holdings 表 - 添加详细持仓字段
-- =====================================================

-- 添加价格相关字段
ALTER TABLE institutional_holdings
ADD COLUMN IF NOT EXISTS reported_price DECIMAL(12, 2),           -- 报告价格
ADD COLUMN IF NOT EXISTS current_price DECIMAL(12, 2),            -- 当前价格
ADD COLUMN IF NOT EXISTS price_change_percent DECIMAL(8, 2),      -- 相对报告价格涨跌幅
ADD COLUMN IF NOT EXISTS week_52_low DECIMAL(12, 2),              -- 52周低点
ADD COLUMN IF NOT EXISTS week_52_high DECIMAL(12, 2);             -- 52周高点

-- 删除不需要的字段
ALTER TABLE institutional_holdings
DROP COLUMN IF EXISTS change_shares;

-- =====================================================
-- 3. 创建行业分析表
-- =====================================================

CREATE TABLE IF NOT EXISTS investor_sector_allocation (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联投资者
    investor_id UUID REFERENCES superinvestors(id) ON DELETE CASCADE,
    investor_code TEXT NOT NULL,
    
    -- 行业数据
    sector_name TEXT NOT NULL,                            -- 行业名称
    allocation_percent DECIMAL(6, 2) NOT NULL,            -- 占比百分比
    
    -- 时间信息
    report_date DATE NOT NULL,                            -- 报告日期
    quarter TEXT,                                          -- 季度标识
    
    -- 元数据
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 唯一约束：同一投资者、同一季度、同一行业只能有一条记录
    UNIQUE(investor_code, sector_name, report_date)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sector_investor_code ON investor_sector_allocation(investor_code);
CREATE INDEX IF NOT EXISTS idx_sector_report_date ON investor_sector_allocation(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_sector_name ON investor_sector_allocation(sector_name);

-- RLS
ALTER TABLE investor_sector_allocation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on investor_sector_allocation" ON investor_sector_allocation;
CREATE POLICY "Allow public read access on investor_sector_allocation"
    ON investor_sector_allocation
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow service role to manage investor_sector_allocation" ON investor_sector_allocation;
CREATE POLICY "Allow service role to manage investor_sector_allocation"
    ON investor_sector_allocation
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 4. 重建视图（更新字段）
-- =====================================================

-- 最新季度持仓视图
CREATE OR REPLACE VIEW latest_holdings AS
SELECT DISTINCT ON (investor_code, ticker)
    h.id,
    h.investor_id,
    h.investor_code,
    h.ticker,
    h.company_name,
    h.sector,
    h.shares,
    h.market_value,
    h.portfolio_percent,
    h.change_percent,
    h.change_type,
    h.reported_price,
    h.current_price,
    h.price_change_percent,
    h.week_52_low,
    h.week_52_high,
    h.report_date,
    h.quarter,
    h.scraped_at,
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
-- 5. 注释
-- =====================================================

COMMENT ON COLUMN institutional_holdings.reported_price IS '13F 报告时的股票价格';
COMMENT ON COLUMN institutional_holdings.current_price IS '当前股票价格（抓取时）';
COMMENT ON COLUMN institutional_holdings.price_change_percent IS '相对报告价格的涨跌幅百分比';
COMMENT ON COLUMN institutional_holdings.week_52_low IS '52周最低价';
COMMENT ON COLUMN institutional_holdings.week_52_high IS '52周最高价';

COMMENT ON COLUMN superinvestors.portfolio_value IS '投资组合总市值';
COMMENT ON COLUMN superinvestors.stock_count IS '持有股票数量';
COMMENT ON COLUMN superinvestors.portfolio_date IS '投资组合日期';
COMMENT ON COLUMN superinvestors.period IS '报告期间（如 Q3 2025）';
