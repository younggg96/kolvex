-- 创建股票追踪表
-- Create stock tracking table

CREATE TABLE IF NOT EXISTS stock_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    company_name VARCHAR(255),
    logo_url TEXT,
    notify BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 确保每个用户只能追踪同一股票一次
    UNIQUE(user_id, symbol)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_stock_tracking_user_id ON stock_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_tracking_symbol ON stock_tracking(symbol);

-- 添加注释
COMMENT ON TABLE stock_tracking IS '用户追踪股票表';
COMMENT ON COLUMN stock_tracking.id IS '记录 ID';
COMMENT ON COLUMN stock_tracking.user_id IS '用户 ID';
COMMENT ON COLUMN stock_tracking.symbol IS '股票代码';
COMMENT ON COLUMN stock_tracking.company_name IS '公司名称';
COMMENT ON COLUMN stock_tracking.logo_url IS '公司 Logo URL';
COMMENT ON COLUMN stock_tracking.notify IS '是否接收通知';
COMMENT ON COLUMN stock_tracking.created_at IS '创建时间';
COMMENT ON COLUMN stock_tracking.updated_at IS '更新时间';

-- 启用 RLS
ALTER TABLE stock_tracking ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看和管理自己的追踪记录
CREATE POLICY "Users can view own tracked stocks" ON stock_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracked stocks" ON stock_tracking
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracked stocks" ON stock_tracking
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracked stocks" ON stock_tracking
    FOR DELETE USING (auth.uid() = user_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_stock_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_tracking_updated_at
    BEFORE UPDATE ON stock_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_tracking_updated_at();

