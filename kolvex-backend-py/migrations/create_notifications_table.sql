-- 通知表
-- 用于存储用户通知（如关注的人的持仓变化）

-- 通知类型枚举
CREATE TYPE notification_type AS ENUM (
    'POSITION_BUY',      -- 买入股票
    'POSITION_SELL',     -- 卖出股票
    'POSITION_INCREASE', -- 加仓
    'POSITION_DECREASE', -- 减仓
    'NEW_FOLLOWER',      -- 新粉丝
    'SYSTEM'             -- 系统通知
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    -- 关联数据
    related_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    related_symbol VARCHAR(20),
    related_data JSONB DEFAULT '{}',
    -- 状态
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- RLS 策略
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的通知
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- 用户只能更新自己的通知（标记已读）
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的通知
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- 系统可以插入通知（使用 service role）
CREATE POLICY "Service can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- 添加未读通知计数到 user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS unread_notifications_count INTEGER DEFAULT 0;

-- 创建函数: 增加未读通知计数
CREATE OR REPLACE FUNCTION increment_unread_notifications()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_profiles 
    SET unread_notifications_count = unread_notifications_count + 1 
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数: 标记已读时减少计数
CREATE OR REPLACE FUNCTION decrement_unread_notifications()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_read = FALSE AND NEW.is_read = TRUE THEN
        UPDATE user_profiles 
        SET unread_notifications_count = GREATEST(0, unread_notifications_count - 1) 
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_increment_unread_notifications ON notifications;
CREATE TRIGGER trigger_increment_unread_notifications
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION increment_unread_notifications();

DROP TRIGGER IF EXISTS trigger_decrement_unread_notifications ON notifications;
CREATE TRIGGER trigger_decrement_unread_notifications
    AFTER UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION decrement_unread_notifications();

-- 注释
COMMENT ON TABLE notifications IS '用户通知表';
COMMENT ON COLUMN notifications.user_id IS '接收通知的用户ID';
COMMENT ON COLUMN notifications.type IS '通知类型';
COMMENT ON COLUMN notifications.related_user_id IS '关联用户ID（如谁买了/卖了股票）';
COMMENT ON COLUMN notifications.related_symbol IS '关联股票代码';
COMMENT ON COLUMN notifications.related_data IS '额外数据（JSON格式）';

