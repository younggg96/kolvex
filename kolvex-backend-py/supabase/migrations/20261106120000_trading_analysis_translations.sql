-- Research runs in English; reader-facing report text is translated afterwards and
-- stored per language, e.g. {"zh": {"market_report": "...", "investment_debate": {...}}}.
-- The capture_stock_research trigger copies to_jsonb(new), so stock-page versions
-- created on completion carry the translations with them.
alter table public.trading_analyses
  add column if not exists translations jsonb not null default '{}'::jsonb;
