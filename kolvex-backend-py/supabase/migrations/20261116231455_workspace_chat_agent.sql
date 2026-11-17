-- A workspace chat can be bound to one chat sub-agent: the workspace page shows it as that
-- agent's panel and every turn in it is sent with that agent pinned. Null = an ordinary chat.
-- Names match app/agent/agents.py CHAT_AGENTS.
alter table public.research_workspace_chats
  add column agent text check (
    agent is null or agent in (
      'financial', 'research', 'portfolio', 'creators', 'earnings',
      'macro', 'smart_money', 'valuation', 'buzz', 'paper_review'
    )
  );
