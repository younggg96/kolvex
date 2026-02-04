-- ============================================================
-- 添加公开投资组合快照的 RLS 策略
-- 允许查看已公开分享用户的投资组合历史
-- ============================================================

-- RLS 策略：允许查看已公开分享用户的快照
-- 条件：用户的 snaptrade_connections 中 is_public = true
CREATE POLICY "Users can view public portfolio snapshots"
ON portfolio_snapshots FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM snaptrade_connections sc
        WHERE sc.user_id = portfolio_snapshots.user_id
        AND sc.is_public = true
    )
);
