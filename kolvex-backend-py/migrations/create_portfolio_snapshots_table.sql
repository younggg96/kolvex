-- ============================================================
-- 创建 portfolio_snapshots 表
-- 存储用户投资组合的每日快照数据
-- ============================================================

-- 创建投资组合快照表
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 用户关联
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 快照时间
    snapshot_date DATE NOT NULL,
    snapshot_time TIMESTAMPTZ DEFAULT NOW(),
    
    -- 投资组合价值
    total_value DECIMAL(18, 2) NOT NULL DEFAULT 0,
    total_cost_basis DECIMAL(18, 2) DEFAULT 0,
    
    -- 盈亏数据
    unrealized_pnl DECIMAL(18, 2) DEFAULT 0,
    unrealized_pnl_percent DECIMAL(8, 4) DEFAULT 0,
    
    -- 统计信息
    positions_count INTEGER DEFAULT 0,
    accounts_count INTEGER DEFAULT 0,
    
    -- 持仓明细 (可选，用于详细回溯)
    positions_snapshot JSONB DEFAULT '[]'::jsonb,
    calculation_version SMALLINT NOT NULL DEFAULT 1,
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 确保每个用户每天只有一条记录
    UNIQUE(user_id, snapshot_date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_id 
ON portfolio_snapshots(user_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date 
ON portfolio_snapshots(user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date 
ON portfolio_snapshots(snapshot_date DESC);

-- 添加注释
COMMENT ON TABLE portfolio_snapshots IS '投资组合历史快照表，存储每日投资组合价值';
COMMENT ON COLUMN portfolio_snapshots.snapshot_date IS '快照日期';
COMMENT ON COLUMN portfolio_snapshots.total_value IS '投资组合总市值';
COMMENT ON COLUMN portfolio_snapshots.total_cost_basis IS '总成本基础';
COMMENT ON COLUMN portfolio_snapshots.unrealized_pnl IS '未实现盈亏';
COMMENT ON COLUMN portfolio_snapshots.positions_snapshot IS '持仓明细JSON快照（可选）';

-- 启用 RLS
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看自己的快照
CREATE POLICY "Users can view own portfolio snapshots"
ON portfolio_snapshots FOR SELECT
USING (auth.uid() = user_id);

-- RLS 策略：服务角色可以插入/更新
CREATE POLICY "Service role can manage portfolio snapshots"
ON portfolio_snapshots FOR ALL
USING (auth.role() = 'service_role');
