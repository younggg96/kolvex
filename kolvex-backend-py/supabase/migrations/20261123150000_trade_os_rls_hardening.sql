-- Trade OS RLS hardening.
-- All Trade OS reads and writes go through the FastAPI backend with the service role
-- (app/services/trade_os/*, app/api/routes/trade_os/*); no client queries these tables
-- directly. The policies below let any signed-in user write shared market rows, read
-- other users' backtests, and read/modify/delete every user's journal reviews.
-- Replace them with owner-only reads; writes stay service-role only.

-- Market-wide state: keep public read, drop client inserts.
DROP POLICY IF EXISTS "Allow authenticated users to insert trade_os_market_regimes"
  ON public.trade_os_market_regimes;

-- Scanner runs: drop client inserts (read policy unchanged).
DROP POLICY IF EXISTS "Allow authenticated users to insert scanner runs"
  ON public.trade_os_scanner_runs;

-- Backtests: owner-only read, no client inserts.
DROP POLICY IF EXISTS "Allow authenticated users to read backtest runs"
  ON public.trade_os_backtest_runs;
DROP POLICY IF EXISTS "Allow authenticated users to insert backtest runs"
  ON public.trade_os_backtest_runs;
CREATE POLICY trade_os_backtest_runs_read_own ON public.trade_os_backtest_runs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Journal reviews: owner-only read, no client writes.
DROP POLICY IF EXISTS "Allow authenticated users to manage journal reviews"
  ON public.trade_os_journal_reviews;
CREATE POLICY trade_os_journal_reviews_read_own ON public.trade_os_journal_reviews
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_trade_os_journal_reviews_user
  ON public.trade_os_journal_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_trade_os_backtest_runs_user
  ON public.trade_os_backtest_runs (user_id);
