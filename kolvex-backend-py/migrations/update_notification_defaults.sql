-- 简化通知设置 - 移除 newsletter 和 notification_method，使用单一的 email_notifications_enabled 字段
-- 
-- 此迁移脚本:
-- 1. 添加新的 email_notifications_enabled 列
-- 2. 从旧字段迁移数据
-- 3. 删除旧的 is_subscribe_newsletter 和 notification_method 列

-- 步骤 1: 添加新字段 email_notifications_enabled (如果不存在)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE;

-- 步骤 2: 迁移旧数据
-- 如果用户之前的 notification_method 是 EMAIL，则保持开启
-- 否则根据旧的设置决定
UPDATE user_profiles 
SET email_notifications_enabled = CASE 
    WHEN notification_method = 'EMAIL' THEN TRUE
    WHEN notification_method = 'MESSAGE' THEN FALSE
    ELSE TRUE  -- 默认开启
END
WHERE email_notifications_enabled IS NULL;

-- 步骤 3: 删除旧字段（可选，建议在确认数据迁移成功后执行）
-- 取消注释以下行来删除旧字段
-- ALTER TABLE user_profiles DROP COLUMN IF EXISTS is_subscribe_newsletter;
-- ALTER TABLE user_profiles DROP COLUMN IF EXISTS notification_method;

-- 注释
COMMENT ON COLUMN user_profiles.email_notifications_enabled IS '是否开启邮件通知，默认 true。开启后当关注的人有持仓变化时会收到邮件通知';
