-- =====================================================
-- 股票预警系统数据库迁移
-- Stock Alert System Database Migration
-- =====================================================

-- 1. 通知渠道类型枚举
DO $$ BEGIN
    CREATE TYPE notification_channel_type AS ENUM (
        'email',
        'discord',
        'telegram',
        'wechat',
        'whatsapp'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. 预警类型枚举
DO $$ BEGIN
    CREATE TYPE stock_alert_type AS ENUM (
        'PRICE_SPIKE_UP',      -- 急涨
        'PRICE_SPIKE_DOWN',    -- 急跌
        'DAILY_CHANGE',        -- 日内涨跌幅
        'PREMARKET_CHANGE',    -- 盘前异动
        'AFTERHOURS_CHANGE',   -- 盘后异动
        'PRICE_ABOVE',         -- 价格突破上限
        'PRICE_BELOW',         -- 价格跌破下限
        'VOLUME_SURGE'         -- 成交量异常
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. 预警规则配置表
CREATE TABLE IF NOT EXISTS stock_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    company_name VARCHAR(255),
    
    -- 预警阈值配置
    daily_change_threshold FLOAT DEFAULT 5.0,       -- 日内涨跌幅阈值 (%)
    spike_change_threshold FLOAT DEFAULT 3.0,       -- 短时急涨急跌阈值 (%)
    price_above FLOAT,                               -- 价格突破上限
    price_below FLOAT,                               -- 价格跌破下限
    volume_surge_multiplier FLOAT DEFAULT 3.0,      -- 成交量异常倍数
    
    -- 监控时段配置
    premarket_enabled BOOLEAN DEFAULT true,         -- 是否监控盘前
    regular_hours_enabled BOOLEAN DEFAULT true,     -- 是否监控盘中
    afterhours_enabled BOOLEAN DEFAULT true,        -- 是否监控盘后
    
    -- 通知渠道配置 (JSON 数组)
    channels JSONB DEFAULT '["email"]',             -- ['email', 'discord', 'telegram', 'wechat', 'whatsapp']
    
    -- AI 分析配置
    ai_analysis_enabled BOOLEAN DEFAULT true,       -- 是否启用 AI 分析
    
    -- 冷却时间 (避免重复通知)
    cooldown_minutes INTEGER DEFAULT 30,            -- 同一股票通知冷却时间(分钟)
    last_triggered_at TIMESTAMP WITH TIME ZONE,     -- 上次触发时间
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 每个用户对每个股票只能有一个预警规则
    UNIQUE(user_id, symbol)
);

-- 4. 用户通知渠道绑定表
CREATE TABLE IF NOT EXISTS user_notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    channel_type VARCHAR(20) NOT NULL,              -- 'discord', 'telegram', 'wechat', 'whatsapp'
    
    -- Discord 配置
    discord_webhook_url TEXT,
    
    -- Telegram 配置
    telegram_bot_token TEXT,
    telegram_chat_id VARCHAR(100),
    
    -- 微信企业号配置
    wechat_webhook_url TEXT,
    
    -- WhatsApp (Twilio) 配置
    whatsapp_phone_number VARCHAR(20),
    
    -- 验证状态
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 每个用户每种渠道只能绑定一个
    UNIQUE(user_id, channel_type)
);

-- 5. 预警历史记录表
CREATE TABLE IF NOT EXISTS stock_alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES stock_alert_rules(id) ON DELETE SET NULL,
    
    -- 触发信息
    symbol VARCHAR(20) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    triggered_price FLOAT NOT NULL,
    previous_price FLOAT,
    change_percent FLOAT NOT NULL,
    volume BIGINT,
    
    -- 市场时段
    market_session VARCHAR(20),                     -- 'pre_market', 'regular', 'after_hours'
    
    -- AI 分析结果
    ai_analysis JSONB,
    ai_summary TEXT,
    risk_level VARCHAR(10),                         -- '低', '中', '高'
    ai_suggestion TEXT,
    
    -- 通知发送状态
    channels_sent JSONB DEFAULT '[]',               -- 发送成功的渠道
    channels_failed JSONB DEFAULT '[]',             -- 发送失败的渠道及错误信息
    
    -- 时间戳
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 系统配置表 (用于存储 API Keys 等全局配置)
CREATE TABLE IF NOT EXISTS stock_alert_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 索引
-- =====================================================

-- 预警规则索引
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON stock_alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_symbol ON stock_alert_rules(symbol);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON stock_alert_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_active ON stock_alert_rules(user_id, is_active);

-- 通知渠道索引
CREATE INDEX IF NOT EXISTS idx_notification_channels_user ON user_notification_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON user_notification_channels(channel_type);

-- 预警历史索引
CREATE INDEX IF NOT EXISTS idx_alert_history_user ON stock_alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_symbol ON stock_alert_history(symbol);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON stock_alert_history(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_user_symbol ON stock_alert_history(user_id, symbol);

-- =====================================================
-- RLS 策略
-- =====================================================

-- 启用 RLS
ALTER TABLE stock_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alert_history ENABLE ROW LEVEL SECURITY;

-- 预警规则 RLS
CREATE POLICY "Users can view own alert rules" ON stock_alert_rules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alert rules" ON stock_alert_rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alert rules" ON stock_alert_rules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alert rules" ON stock_alert_rules
    FOR DELETE USING (auth.uid() = user_id);

-- Service role 可以操作所有预警规则（用于后台服务）
CREATE POLICY "Service can manage all alert rules" ON stock_alert_rules
    FOR ALL USING (true) WITH CHECK (true);

-- 通知渠道 RLS
CREATE POLICY "Users can view own notification channels" ON user_notification_channels
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification channels" ON user_notification_channels
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification channels" ON user_notification_channels
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification channels" ON user_notification_channels
    FOR DELETE USING (auth.uid() = user_id);

-- 预警历史 RLS
CREATE POLICY "Users can view own alert history" ON stock_alert_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert alert history" ON stock_alert_history
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- 触发器: 自动更新 updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_stock_alert_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_alert_rules_updated_at ON stock_alert_rules;
CREATE TRIGGER trigger_update_alert_rules_updated_at
    BEFORE UPDATE ON stock_alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_alert_updated_at();

DROP TRIGGER IF EXISTS trigger_update_notification_channels_updated_at ON user_notification_channels;
CREATE TRIGGER trigger_update_notification_channels_updated_at
    BEFORE UPDATE ON user_notification_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_alert_updated_at();

-- =====================================================
-- 插入默认系统配置
-- =====================================================

INSERT INTO stock_alert_config (config_key, config_value, description) VALUES
    ('finnhub_api_key', '', 'Finnhub API Key (免费注册: https://finnhub.io)'),
    ('openai_api_key', '', 'OpenAI API Key (用于 AI 分析)'),
    ('twilio_account_sid', '', 'Twilio Account SID (用于 WhatsApp)'),
    ('twilio_auth_token', '', 'Twilio Auth Token'),
    ('twilio_whatsapp_from', '', 'Twilio WhatsApp 发送号码'),
    ('alert_check_interval_seconds', '30', '预警检查间隔(秒)'),
    ('default_cooldown_minutes', '30', '默认通知冷却时间(分钟)')
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- 注释
-- =====================================================

COMMENT ON TABLE stock_alert_rules IS '股票预警规则配置表';
COMMENT ON TABLE user_notification_channels IS '用户通知渠道绑定表';
COMMENT ON TABLE stock_alert_history IS '预警触发历史记录表';
COMMENT ON TABLE stock_alert_config IS '股票预警系统全局配置表';

COMMENT ON COLUMN stock_alert_rules.daily_change_threshold IS '日内涨跌幅预警阈值(百分比)';
COMMENT ON COLUMN stock_alert_rules.spike_change_threshold IS '短时急涨急跌预警阈值(百分比)';
COMMENT ON COLUMN stock_alert_rules.cooldown_minutes IS '同一股票两次通知之间的最小间隔(分钟)';
COMMENT ON COLUMN stock_alert_rules.channels IS '通知渠道JSON数组: ["email", "discord", "telegram", "wechat", "whatsapp"]';

COMMENT ON COLUMN stock_alert_history.market_session IS '市场时段: pre_market(盘前), regular(盘中), after_hours(盘后)';
COMMENT ON COLUMN stock_alert_history.ai_analysis IS 'AI 分析完整结果 JSON';
COMMENT ON COLUMN stock_alert_history.risk_level IS '风险等级: 低, 中, 高';
