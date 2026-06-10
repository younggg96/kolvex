-- Version portfolio snapshot calculations so legacy snapshots created with
-- inconsistent option multipliers do not pollute performance charts.

ALTER TABLE public.portfolio_snapshots
    ADD COLUMN IF NOT EXISTS calculation_version SMALLINT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.portfolio_snapshots.calculation_version IS
    'Snapshot formula version; version 2 uses corrected stock and option P&L calculations.';

-- Refresh PostgREST immediately so API requests do not keep returning PGRST204.
NOTIFY pgrst, 'reload schema';
