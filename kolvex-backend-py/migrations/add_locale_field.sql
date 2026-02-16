-- Add locale field to user_profiles table
-- Stores the user's preferred language (e.g., 'en', 'zh')
-- Defaults to NULL, which means the frontend will use browser language detection

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT NULL;

COMMENT ON COLUMN user_profiles.locale IS 'User preferred locale (e.g., en, zh). NULL means use browser default.';
