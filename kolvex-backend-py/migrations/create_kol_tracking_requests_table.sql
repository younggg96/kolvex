-- KOL Tracking Requests Table
-- 存储用户提交的 KOL 追踪请求，审核通过后自动加入爬虫列表

-- Create enum type for request status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_request_status') THEN
        CREATE TYPE tracking_request_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END$$;

-- Create the kol_tracking_requests table
CREATE TABLE IF NOT EXISTS kol_tracking_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- User who submitted the request
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- KOL information
    platform VARCHAR(50) NOT NULL DEFAULT 'twitter',
    platform_user_id VARCHAR(255) NOT NULL,  -- The KOL's username/ID on the platform
    
    -- Request status
    status tracking_request_status NOT NULL DEFAULT 'pending',
    
    -- Optional notes
    user_notes TEXT,  -- User can provide reason for the request
    admin_notes TEXT,  -- Admin can add notes during review
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reviewed_at TIMESTAMPTZ,
    
    -- Reviewer (admin user id)
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_kol_tracking_requests_user_id ON kol_tracking_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_kol_tracking_requests_status ON kol_tracking_requests(status);
CREATE INDEX IF NOT EXISTS idx_kol_tracking_requests_platform ON kol_tracking_requests(platform);
CREATE INDEX IF NOT EXISTS idx_kol_tracking_requests_created_at ON kol_tracking_requests(created_at DESC);

-- Unique constraint to prevent duplicate requests for the same KOL from same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_kol_tracking_requests_unique_pending 
ON kol_tracking_requests(user_id, platform, platform_user_id) 
WHERE status = 'pending';

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_kol_tracking_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kol_tracking_requests_updated_at ON kol_tracking_requests;
CREATE TRIGGER trigger_kol_tracking_requests_updated_at
    BEFORE UPDATE ON kol_tracking_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_kol_tracking_requests_updated_at();

-- RLS Policies
ALTER TABLE kol_tracking_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own tracking requests"
    ON kol_tracking_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can create tracking requests"
    ON kol_tracking_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role full access"
    ON kol_tracking_requests FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Comments
COMMENT ON TABLE kol_tracking_requests IS 'User requests to track new KOLs on various platforms';
COMMENT ON COLUMN kol_tracking_requests.platform_user_id IS 'The username or ID of the KOL on the specified platform';
COMMENT ON COLUMN kol_tracking_requests.status IS 'pending: awaiting review, approved: added to scraper list, rejected: declined';
