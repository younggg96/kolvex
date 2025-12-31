-- =====================================================
-- 清理旧表脚本
-- 在确认数据迁移成功后运行此脚本删除旧表
-- =====================================================

-- ⚠️ 警告：运行此脚本前请确保：
-- 1. unify_platforms.sql 迁移已成功完成
-- 2. 已验证 kol_profiles 中有小红书 KOL 数据 (platform='xiaohongshu')
-- 3. 已验证 kol_tweets 中有小红书帖子数据 (platform='xiaohongshu')
-- 4. 应用代码已更新为使用新的统一表

-- ============================================================
-- 验证数据迁移（运行前请先执行这些查询确认）
-- ============================================================

-- 检查小红书 KOL 是否已迁移
-- SELECT COUNT(*) as xhs_kols_in_new_table FROM kol_profiles WHERE platform = 'xiaohongshu';
-- SELECT COUNT(*) as xhs_kols_in_old_table FROM xhs_kols;

-- 检查小红书帖子是否已迁移
-- SELECT COUNT(*) as xhs_posts_in_new_table FROM kol_tweets WHERE platform = 'xiaohongshu';
-- SELECT COUNT(*) as xhs_posts_in_old_table FROM xhs_posts;

-- ============================================================
-- 删除旧表（确认迁移成功后取消注释执行）
-- ============================================================

-- 删除旧的小红书帖子表
DROP TABLE IF EXISTS xhs_posts CASCADE;

-- 删除旧的小红书 KOL 表
DROP TABLE IF EXISTS xhs_kols CASCADE;

-- ============================================================
-- 删除旧的触发器函数（如果存在）
-- ============================================================

DROP FUNCTION IF EXISTS update_xhs_posts_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_xhs_kols_updated_at() CASCADE;

-- ============================================================
-- 完成
-- ============================================================

-- 验证表已删除
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'xhs_%';

