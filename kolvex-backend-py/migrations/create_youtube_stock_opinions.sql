-- =====================================================
-- YouTube KOL stock opinions
-- Stores manually uploaded Gemini analysis JSON at one row per video/ticker.
-- =====================================================

CREATE TABLE IF NOT EXISTS youtube_stock_opinions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    video_id TEXT NOT NULL,
    video_title TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    video_published_at TIMESTAMPTZ,

    channel_id TEXT NOT NULL,
    channel_title TEXT,
    channel_handle TEXT,
    channel_url TEXT,
    channel_avatar_url TEXT,

    ticker TEXT NOT NULL,
    company_name TEXT,
    sentiment TEXT NOT NULL DEFAULT 'neutral',
    direction_score NUMERIC(6,2) DEFAULT 0,
    confidence NUMERIC(4,3),
    time_horizon TEXT,
    thesis TEXT,
    summary TEXT,
    key_points JSONB DEFAULT '[]'::jsonb,
    risks JSONB DEFAULT '[]'::jsonb,
    price_targets JSONB DEFAULT '[]'::jsonb,

    opinion_date DATE NOT NULL DEFAULT CURRENT_DATE,
    analyzed_at TIMESTAMPTZ,
    source_model TEXT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT youtube_stock_opinions_sentiment_check
        CHECK (sentiment IN ('bullish', 'bearish', 'neutral', 'mixed')),
    CONSTRAINT youtube_stock_opinions_score_check
        CHECK (direction_score >= -100 AND direction_score <= 100),
    CONSTRAINT youtube_stock_opinions_confidence_check
        CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    CONSTRAINT youtube_stock_opinions_video_ticker_unique
        UNIQUE (video_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_youtube_stock_opinions_ticker
    ON youtube_stock_opinions(ticker);

CREATE INDEX IF NOT EXISTS idx_youtube_stock_opinions_channel
    ON youtube_stock_opinions(channel_id);

CREATE INDEX IF NOT EXISTS idx_youtube_stock_opinions_sentiment
    ON youtube_stock_opinions(sentiment);

CREATE INDEX IF NOT EXISTS idx_youtube_stock_opinions_opinion_date
    ON youtube_stock_opinions(opinion_date DESC);

CREATE INDEX IF NOT EXISTS idx_youtube_stock_opinions_video_published
    ON youtube_stock_opinions(video_published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_youtube_stock_opinions_key_points
    ON youtube_stock_opinions USING GIN(key_points);

COMMENT ON TABLE youtube_stock_opinions IS 'Per-stock opinions extracted from YouTube KOL videos.';
COMMENT ON COLUMN youtube_stock_opinions.direction_score IS 'Bullish/bearish score from -100 to 100.';
COMMENT ON COLUMN youtube_stock_opinions.opinion_date IS 'Date used for daily opinion change aggregation.';

ALTER TABLE youtube_stock_opinions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view YouTube stock opinions" ON youtube_stock_opinions;
CREATE POLICY "Anyone can view YouTube stock opinions" ON youtube_stock_opinions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert YouTube stock opinions" ON youtube_stock_opinions;
CREATE POLICY "Admins can insert YouTube stock opinions" ON youtube_stock_opinions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.is_admin = true
        )
    );

DROP POLICY IF EXISTS "Admins can update YouTube stock opinions" ON youtube_stock_opinions;
CREATE POLICY "Admins can update YouTube stock opinions" ON youtube_stock_opinions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1
            FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.is_admin = true
        )
    );

CREATE OR REPLACE FUNCTION update_youtube_stock_opinions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS youtube_stock_opinions_updated_at ON youtube_stock_opinions;
CREATE TRIGGER youtube_stock_opinions_updated_at
    BEFORE UPDATE ON youtube_stock_opinions
    FOR EACH ROW
    EXECUTE FUNCTION update_youtube_stock_opinions_updated_at();
