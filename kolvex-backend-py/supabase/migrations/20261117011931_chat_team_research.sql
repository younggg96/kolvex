-- One saved chat question can start at most one team run, including after a retry.
alter table public.research_workspace_runs
  add column source_message_id uuid unique references public.chat_messages(id) on delete set null;

alter table public.research_agent_results
  drop constraint research_agent_results_agent_check,
  add constraint research_agent_results_agent_check check (agent in (
    'market', 'fundamentals', 'news', 'creators', 'portfolio',
    'financial', 'earnings', 'macro', 'smart_money', 'valuation', 'buzz', 'paper_review'
  ));
