-- ============================================================================
-- Migration: 20261123160000_trade_os_scan_universe.sql
-- Scans now cover core + sector + ETF lists plus KOL YouTube and Reddit trending
-- names. Each stored run keeps the per-source counts and any source that failed.
-- No RLS policy changes.
-- ============================================================================

ALTER TABLE trade_os_scanner_runs
    ADD COLUMN IF NOT EXISTS universe JSONB NOT NULL DEFAULT '{}'::jsonb;
