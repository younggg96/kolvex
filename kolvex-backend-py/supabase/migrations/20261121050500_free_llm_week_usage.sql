-- Weekly cost and token totals for the free AI allowance (app/services/free_llm_quota.py).
-- Replaces free_llm_week_spend from 20261121050000: the backend now reads tokens as well,
-- to show users their weekly token use without showing money.
begin;

create function public.free_llm_week_usage(p_user_id uuid, p_week_start date)
returns table (
    cost_micro_yuan bigint,
    cache_hit_tokens bigint,
    cache_miss_tokens bigint,
    output_tokens bigint,
    calls bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
    select
        coalesce(sum(e.cost_micro_yuan), 0)::bigint,
        coalesce(sum(e.cache_hit_tokens), 0)::bigint,
        coalesce(sum(e.cache_miss_tokens), 0)::bigint,
        coalesce(sum(e.output_tokens), 0)::bigint,
        count(*)
    from public.free_llm_usage_events e
    where e.user_id = p_user_id and e.week_start = p_week_start;
$$;

revoke all on function public.free_llm_week_usage(uuid, date) from public, anon, authenticated;
grant execute on function public.free_llm_week_usage(uuid, date) to service_role;

-- No caller is left once the backend reads free_llm_week_usage.
drop function if exists public.free_llm_week_spend(uuid, date);

commit;
