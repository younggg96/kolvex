-- Options AI Analyses table
-- Stores AI-generated trading strategy analyses for public viewing

create table if not exists public.options_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text,
  risk_profile text not null check (risk_profile in ('conservative', 'aggressive', 'hedging')),
  model text not null,
  locale text not null default 'en',
  input_summary jsonb not null,
  ai_response jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_options_ai_created on public.options_ai_analyses (created_at desc);
create index if not exists idx_options_ai_user on public.options_ai_analyses (user_id, created_at desc);
create index if not exists idx_options_ai_symbol on public.options_ai_analyses (symbol, created_at desc);

alter table public.options_ai_analyses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Anyone can read options_ai_analyses') then
    create policy "Anyone can read options_ai_analyses"
      on public.options_ai_analyses for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Auth users insert own options_ai_analyses') then
    create policy "Auth users insert own options_ai_analyses"
      on public.options_ai_analyses for insert with check (auth.uid() = user_id);
  end if;
end $$;
