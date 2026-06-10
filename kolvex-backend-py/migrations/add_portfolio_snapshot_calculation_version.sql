-- Version portfolio snapshot calculations so legacy snapshots created with
-- inconsistent option multipliers do not pollute performance charts.

ALTER TABLE portfolio_snapshots
    ADD COLUMN IF NOT EXISTS calculation_version SMALLINT NOT NULL DEFAULT 1;

