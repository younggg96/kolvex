-- Durable jobs: clients submit once, workers claim once, results commit atomically.
create table public.stock_chart_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  operation text not null check (operation in ('analysis', 'drawings')),
  request jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null default now() + interval '20 minutes'
);
create index stock_chart_jobs_queue on public.stock_chart_jobs(created_at) where status = 'queued';
create index stock_chart_jobs_user_ticker on public.stock_chart_jobs(user_id, ticker, created_at desc);
create unique index stock_chart_jobs_active on public.stock_chart_jobs(user_id, ticker) where status in ('queued', 'running');
alter table public.stock_chart_jobs enable row level security;
-- Only the authenticated backend may submit/inspect jobs. Never expose requests or credentials.
revoke all on public.stock_chart_jobs from public, anon, authenticated;
grant all on public.stock_chart_jobs to service_role;

create function public.expire_stock_chart_jobs() returns void
language sql security invoker set search_path = '' as $$
  update public.stock_chart_jobs set status = 'failed', error_code = 'ai_job_expired', finished_at = now()
  where status in ('queued', 'running') and expires_at <= now();
$$;

create function public.enqueue_stock_chart_job(p_id uuid, p_user_id uuid, p_ticker text, p_request jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_job public.stock_chart_jobs;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  perform public.expire_stock_chart_jobs();
  select * into v_job from public.stock_chart_jobs where id = p_id and user_id = p_user_id;
  if found then return to_jsonb(v_job); end if;
  select * into v_job from public.stock_chart_jobs
    where user_id = p_user_id and ticker = p_ticker and status in ('queued', 'running');
  if found then return to_jsonb(v_job); end if;
  if (select count(*) from public.stock_chart_jobs where user_id = p_user_id and status in ('queued', 'running')) >= 3 then
    raise exception 'ai_job_limit';
  end if;
  insert into public.stock_chart_jobs(id, user_id, ticker, operation, request)
    values (p_id, p_user_id, p_ticker, p_request->>'operation', p_request) returning * into v_job;
  return to_jsonb(v_job);
end $$;

create function public.claim_stock_chart_job() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_job public.stock_chart_jobs;
begin
  perform public.expire_stock_chart_jobs();
  select * into v_job from public.stock_chart_jobs where status = 'queued'
    order by created_at, id for update skip locked limit 1;
  if not found then return null; end if;
  update public.stock_chart_jobs set status = 'running', started_at = now(), expires_at = now() + interval '10 minutes'
    where id = v_job.id returning * into v_job;
  return to_jsonb(v_job);
end $$;

create function public.complete_stock_chart_job(p_id uuid, p_payload jsonb, p_bars jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_job public.stock_chart_jobs; v_saved jsonb;
begin
  select * into v_job from public.stock_chart_jobs where id = p_id for update;
  if not found then raise exception 'ai_job_not_found'; end if;
  if v_job.status = 'completed' then return to_jsonb(v_job); end if;
  if v_job.status <> 'running' or v_job.expires_at <= now() then raise exception 'ai_job_expired'; end if;
  v_saved := public.save_stock_chart_result(v_job.user_id, v_job.ticker,
    case when v_job.operation = 'drawings' then 'drawings' else 'technical' end,
    p_payload, v_job.request - 'request_id', p_bars);
  update public.stock_chart_jobs set status = 'completed', finished_at = now(),
    result = p_payload || jsonb_build_object('version_id', v_saved->>'id', 'saved_at', v_saved->>'created_at')
    where id = p_id returning * into v_job;
  return to_jsonb(v_job);
end $$;

revoke all on function public.expire_stock_chart_jobs() from public, anon, authenticated;
revoke all on function public.enqueue_stock_chart_job(uuid,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.claim_stock_chart_job() from public, anon, authenticated;
revoke all on function public.complete_stock_chart_job(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.expire_stock_chart_jobs() to service_role;
grant execute on function public.enqueue_stock_chart_job(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.claim_stock_chart_job() to service_role;
grant execute on function public.complete_stock_chart_job(uuid,jsonb,jsonb) to service_role;
