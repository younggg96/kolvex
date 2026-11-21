-- Free AI allowance ledger (app/services/free_llm_quota.py, docs/free-llm-allowance.md).
-- One row per model call charged to a user's free weekly allowance on the server DeepSeek key.
-- Redis holds the running weekly total that every call checks; this table is the durable record
-- used to audit spend and to rebuild that total after Redis loses it.
-- Only the backend (service role) reads or writes this table.
begin;

create table public.free_llm_usage_events (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    -- Monday of the Beijing-time week the call was charged to.
    week_start date not null,
    model text not null check (char_length(model) between 1 and 100),
    cache_hit_tokens integer not null check (cache_hit_tokens >= 0),
    cache_miss_tokens integer not null check (cache_miss_tokens >= 0),
    output_tokens integer not null check (output_tokens >= 0),
    -- Millionths of a yuan, rounded up.
    cost_micro_yuan bigint not null check (cost_micro_yuan >= 0),
    -- true when the provider returned no usage and tokens were estimated from text length.
    estimated boolean not null default false,
    peak boolean not null,
    created_at timestamptz not null default now()
);

create index free_llm_usage_events_user_week
    on public.free_llm_usage_events (user_id, week_start);

alter table public.free_llm_usage_events enable row level security;
revoke all on public.free_llm_usage_events from anon, authenticated;
grant select, insert on public.free_llm_usage_events to service_role;

-- A user's charged total for one week.
create function public.free_llm_week_spend(p_user_id uuid, p_week_start date)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
    select coalesce(sum(cost_micro_yuan), 0)::bigint
    from public.free_llm_usage_events
    where user_id = p_user_id and week_start = p_week_start;
$$;

revoke all on function public.free_llm_week_spend(uuid, date) from public, anon, authenticated;
grant execute on function public.free_llm_week_spend(uuid, date) to service_role;

commit;
