-- AI results are readable by all signed-in users; ownership still controls all writes.
drop policy if exists own_analysis_versions on public.stock_analysis_versions;
drop policy if exists public_analysis_versions on public.stock_analysis_versions;
create policy public_analysis_versions on public.stock_analysis_versions
  for select to authenticated using (true);
grant select on public.stock_analysis_versions to authenticated;
create index if not exists stock_analysis_public_history_idx on public.stock_analysis_versions(ticker,kind,created_at desc,id desc);

-- Keep current pointers, jobs and manual chart drawings private.
-- Completed research is shared with signed-in users regardless of its legacy publish flag.
drop policy if exists public_completed_research on public.trading_analyses;
create policy public_completed_research on public.trading_analyses
  for select to authenticated using (status = 'completed');
grant select on public.trading_analyses to authenticated;
create index if not exists trading_analyses_completed_history_idx on public.trading_analyses(created_at desc,id desc) where status='completed';
