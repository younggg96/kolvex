-- Migration: Add is_admin field to user_profiles table
-- Description: Add admin role support for user access control

-- Add is_admin column to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for admin users lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = TRUE;

-- Comment for documentation
COMMENT ON COLUMN user_profiles.is_admin IS 'Whether the user has admin privileges';
