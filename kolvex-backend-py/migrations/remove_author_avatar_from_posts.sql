-- =====================================================
-- 从 xhs_posts 表移除 author_avatar 字段
-- 
-- 原因：同一作者在不同帖子中可能有不同的头像URL，导致数据不一致
-- 解决方案：作者头像统一从 xhs_kols 表通过 author_id 关联获取
-- =====================================================

-- 1. 移除 author_avatar 字段
ALTER TABLE xhs_posts DROP COLUMN IF EXISTS author_avatar;

-- 2. 为 author_id 添加索引（如果不存在），加速与 xhs_kols 表的关联查询
CREATE INDEX IF NOT EXISTS idx_xhs_posts_author_id ON xhs_posts(author_id);

-- =====================================================
-- 说明
-- =====================================================
-- 
-- 执行此迁移后：
-- - xhs_posts 表不再存储 author_avatar
-- - 前端获取帖子时，后端 API 会通过 author_id 从 xhs_kols 表查询头像
-- - 确保同一作者的头像在所有帖子中保持一致
--
-- 相关代码变更：
-- - kolvex-backend-py/app/services/xiaohongshu/extractors.py: 不再提取帖子的 author_avatar
-- - kolvex-backend-py/app/services/xiaohongshu/database.py: 不再保存帖子的 author_avatar
-- - kolvex-backend-py/app/api/routes/xiaohongshu/posts_routes.py: 从 xhs_kols 表获取头像
-- - kolvex-backend-py/app/api/routes/xiaohongshu/kols_routes.py: 更新帖子格式化逻辑

