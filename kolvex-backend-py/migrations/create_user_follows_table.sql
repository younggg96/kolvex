-- 用户关注表
-- 用于存储用户之间的关注关系

CREATE TABLE IF NOT EXISTS user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 确保不能关注自己，且同一关注关系唯一
    CONSTRAINT user_follows_no_self_follow CHECK (follower_id != following_id),
    CONSTRAINT user_follows_unique UNIQUE (follower_id, following_id)
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows(following_id);

-- RLS 策略
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- 任何人都可以查看关注关系
CREATE POLICY "Anyone can view follows" ON user_follows
    FOR SELECT USING (true);

-- 用户只能创建自己的关注
CREATE POLICY "Users can follow others" ON user_follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- 用户只能删除自己的关注
CREATE POLICY "Users can unfollow" ON user_follows
    FOR DELETE USING (auth.uid() = follower_id);

-- 添加 followers_count 和 following_count 到 user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- 创建函数: 增加关注数
CREATE OR REPLACE FUNCTION increment_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- 增加被关注者的 followers_count
    UPDATE user_profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    -- 增加关注者的 following_count
    UPDATE user_profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数: 减少关注数
CREATE OR REPLACE FUNCTION decrement_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- 减少被关注者的 followers_count
    UPDATE user_profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    -- 减少关注者的 following_count
    UPDATE user_profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_increment_follow_counts ON user_follows;
CREATE TRIGGER trigger_increment_follow_counts
    AFTER INSERT ON user_follows
    FOR EACH ROW
    EXECUTE FUNCTION increment_follow_counts();

DROP TRIGGER IF EXISTS trigger_decrement_follow_counts ON user_follows;
CREATE TRIGGER trigger_decrement_follow_counts
    AFTER DELETE ON user_follows
    FOR EACH ROW
    EXECUTE FUNCTION decrement_follow_counts();

-- 注释
COMMENT ON TABLE user_follows IS '用户关注关系表';
COMMENT ON COLUMN user_follows.follower_id IS '关注者用户ID';
COMMENT ON COLUMN user_follows.following_id IS '被关注者用户ID';

