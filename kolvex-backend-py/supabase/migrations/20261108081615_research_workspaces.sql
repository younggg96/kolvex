-- Research workspaces: a chat can join one workspace; a run sends several research
-- sub-agents over the workspace brief, tickers and attached chats, then a lead agent
-- writes the synthesis. See app/services/research_workspace.py. Only the service role
-- reads or writes; the API filters every query by the signed-in user.
create table public.research_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  brief text not null default '' check (char_length(brief) <= 4000),
  tickers text[] not null default '{}' check (cardinality(tickers) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index research_workspaces_user_idx on public.research_workspaces(user_id, updated_at desc);

-- A conversation belongs to at most one workspace.
create table public.research_workspace_chats (
  conversation_id uuid primary key references public.chat_conversations(id) on delete cascade,
  workspace_id uuid not null references public.research_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
create index research_workspace_chats_workspace_idx on public.research_workspace_chats(workspace_id, added_at desc);

create table public.research_workspace_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.research_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('running', 'completed', 'partial', 'failed')),
  question text not null default '',
  agents text[] not null,
  model_id text,
  -- Lead agent's combined conclusion.
  synthesis text,
  stance text check (stance is null or stance in ('bullish', 'bearish', 'neutral', 'mixed')),
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index research_workspace_runs_workspace_idx on public.research_workspace_runs(workspace_id, started_at desc);
-- At most one active run per workspace.
create unique index research_workspace_runs_one_active on public.research_workspace_runs(workspace_id)
  where status = 'running';

create table public.research_agent_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.research_workspace_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent text not null check (agent in ('market', 'fundamentals', 'news', 'creators', 'portfolio')),
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  summary text not null default '',
  content text not null default '',
  stance text check (stance is null or stance in ('bullish', 'bearish', 'neutral', 'mixed')),
  confidence numeric(4, 3) check (confidence is null or confidence between 0 and 1),
  -- Tool names the agent called, in order.
  tools_used text[] not null default '{}',
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  unique (run_id, agent)
);

alter table public.research_workspaces enable row level security;
alter table public.research_workspace_chats enable row level security;
alter table public.research_workspace_runs enable row level security;
alter table public.research_agent_results enable row level security;
revoke all on public.research_workspaces, public.research_workspace_chats,
  public.research_workspace_runs, public.research_agent_results from anon, authenticated;
grant all on public.research_workspaces, public.research_workspace_chats,
  public.research_workspace_runs, public.research_agent_results to service_role;
