-- Add show_position_pnl_per_share to privacy settings
-- Both show_position_pnl and show_position_pnl_per_share default to false

-- Add show_position_pnl_per_share to existing privacy_settings
-- and update show_position_pnl default to false for new connections
DO $$
DECLARE
    conn RECORD;
    current_settings JSONB;
    new_settings JSONB;
BEGIN
    FOR conn IN SELECT id, privacy_settings FROM snaptrade_connections WHERE privacy_settings IS NOT NULL
    LOOP
        current_settings := conn.privacy_settings;
        new_settings := current_settings;
        
        -- Add show_position_pnl_per_share if not exists (default false)
        IF NOT (new_settings ? 'show_position_pnl_per_share') THEN
            new_settings := new_settings || '{"show_position_pnl_per_share": false}'::jsonb;
        END IF;
        
        -- Update record
        UPDATE snaptrade_connections 
        SET privacy_settings = new_settings
        WHERE id = conn.id;
    END LOOP;
END $$;
