-- Screener Presets table
-- Stores user-saved stock screening filter configurations

CREATE TABLE IF NOT EXISTS screener_presets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    filters JSONB NOT NULL DEFAULT '{}',
    sectors TEXT[],
    sort_by TEXT NOT NULL DEFAULT 'market_cap',
    sort_direction TEXT NOT NULL DEFAULT 'desc',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_screener_presets_user_id ON screener_presets(user_id);

ALTER TABLE screener_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own presets"
    ON screener_presets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own presets"
    ON screener_presets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presets"
    ON screener_presets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own presets"
    ON screener_presets FOR DELETE
    USING (auth.uid() = user_id);

-- auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_screener_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER screener_presets_updated_at
    BEFORE UPDATE ON screener_presets
    FOR EACH ROW
    EXECUTE FUNCTION update_screener_presets_updated_at();
