-- User-authored quantitative strategy DSL, position bindings, and MVP backtests.

CREATE TABLE IF NOT EXISTS quant_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    dsl TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quant_strategy_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES quant_strategies(id) ON DELETE SET NULL,
    symbol TEXT NOT NULL,
    stop_loss_pct NUMERIC(8, 4),
    take_profit_pct NUMERIC(8, 4),
    trailing_stop_pct NUMERIC(8, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_quant_assignment_user_symbol UNIQUE (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS quant_backtests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES quant_strategies(id) ON DELETE SET NULL,
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    initial_capital NUMERIC(18, 4) NOT NULL,
    final_capital NUMERIC(18, 4) NOT NULL,
    total_return_pct NUMERIC(12, 6) NOT NULL,
    max_drawdown_pct NUMERIC(12, 6) NOT NULL,
    trades_count INTEGER NOT NULL DEFAULT 0,
    win_rate_pct NUMERIC(12, 6) NOT NULL DEFAULT 0,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quant_strategies_user_id
ON quant_strategies(user_id);

CREATE INDEX IF NOT EXISTS idx_quant_strategy_assignments_user_id
ON quant_strategy_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_quant_backtests_user_id
ON quant_backtests(user_id);

DROP TRIGGER IF EXISTS update_quant_strategies_updated_at ON quant_strategies;
CREATE TRIGGER update_quant_strategies_updated_at
    BEFORE UPDATE ON quant_strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quant_assignments_updated_at ON quant_strategy_assignments;
CREATE TRIGGER update_quant_assignments_updated_at
    BEFORE UPDATE ON quant_strategy_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE quant_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE quant_strategy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quant_backtests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own quant strategies" ON quant_strategies;
CREATE POLICY "Users can manage own quant strategies"
ON quant_strategies FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own quant strategy assignments" ON quant_strategy_assignments;
CREATE POLICY "Users can manage own quant strategy assignments"
ON quant_strategy_assignments FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own quant backtests" ON quant_backtests;
CREATE POLICY "Users can view own quant backtests"
ON quant_backtests FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage quant strategies" ON quant_strategies;
CREATE POLICY "Service role can manage quant strategies"
ON quant_strategies FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage quant assignments" ON quant_strategy_assignments;
CREATE POLICY "Service role can manage quant assignments"
ON quant_strategy_assignments FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage quant backtests" ON quant_backtests;
CREATE POLICY "Service role can manage quant backtests"
ON quant_backtests FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
