-- =====================================================
-- YouTube stock opinions: advisor fixes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_youtube_stock_opinions_uploaded_by
    ON youtube_stock_opinions(uploaded_by);

DROP POLICY IF EXISTS "Admins can insert YouTube stock opinions" ON youtube_stock_opinions;
CREATE POLICY "Admins can insert YouTube stock opinions" ON youtube_stock_opinions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles
            WHERE user_profiles.id = (SELECT auth.uid())
              AND user_profiles.is_admin = true
        )
    );

DROP POLICY IF EXISTS "Admins can update YouTube stock opinions" ON youtube_stock_opinions;
CREATE POLICY "Admins can update YouTube stock opinions" ON youtube_stock_opinions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1
            FROM user_profiles
            WHERE user_profiles.id = (SELECT auth.uid())
              AND user_profiles.is_admin = true
        )
    );

CREATE OR REPLACE FUNCTION update_youtube_stock_opinions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
