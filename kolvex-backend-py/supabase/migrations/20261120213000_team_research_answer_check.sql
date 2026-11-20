-- Server check of the numbers in team research against the tool evidence behind them
-- (app/agent/answer_check.py, the same check chat answers get in chat_messages.answer_check).
-- Only the backend writes these tables (service role); clients have no direct access.

alter table public.research_agent_results
  add column answer_check jsonb
    check (answer_check is null or jsonb_typeof(answer_check) = 'object');

comment on column public.research_agent_results.answer_check is
  'Numbers in this researcher''s note checked against the tools this researcher called.';

alter table public.research_workspace_runs
  add column answer_check jsonb
    check (answer_check is null or jsonb_typeof(answer_check) = 'object');

comment on column public.research_workspace_runs.answer_check is
  'Numbers in the combined conclusion checked against every researcher''s tool evidence.';
