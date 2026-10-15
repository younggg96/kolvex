-- Run after migrations against a test database with at least one auth user.
-- All fixture writes roll back; no model requests are made.
begin;
do $$
declare u uuid; a jsonb; b jsonb; c jsonb; j uuid := gen_random_uuid(); v uuid;
begin
  select id into u from auth.users limit 1;
  assert u is not null, 'Requires a test auth user';
  a := public.enqueue_stock_chart_job(j,u,'JOBTEST','{"operation":"analysis","interval":"1d"}');
  b := public.enqueue_stock_chart_job(j,u,'JOBTEST','{"operation":"analysis","interval":"1d"}');
  assert a->>'id'=b->>'id', 'Request retry created another job';
  c := public.enqueue_stock_chart_job(gen_random_uuid(),u,'JOBTEST','{"operation":"drawings","interval":"1d"}');
  assert a->>'id'=c->>'id', 'Concurrent operation duplicated work';
  -- Make this test's job the oldest so claim is deterministic within the transaction.
  update public.stock_chart_jobs set created_at='1970-01-01' where id=j;
  a := public.claim_stock_chart_job();
  assert a->>'id'=j::text and a->>'status'='running', 'Claim did not mark job running';
  a := public.complete_stock_chart_job(j,'{"summary":"complete"}','[{"close":10}]');
  v := (a->'result'->>'version_id')::uuid;
  assert (select payload->>'summary' from public.stock_analysis_versions where id=v)='complete';
  assert (select bars->0->>'close' from public.stock_analysis_versions where id=v)='10';
  b := public.complete_stock_chart_job(j,'{"summary":"duplicate"}','[]');
  assert b->'result'->>'version_id'=v::text, 'Completion retry saved a second version';
  assert (select count(*) from public.stock_analysis_versions where user_id=u and ticker='JOBTEST')=1;
  assert (select version_id from public.stock_analysis_heads where user_id=u and ticker='JOBTEST' and kind='technical')=v;
  -- A duplicate POST after completion must still return the same saved job.
  b := public.enqueue_stock_chart_job(j,u,'JOBTEST','{"operation":"analysis"}');
  assert b->>'status'='completed';
  j := gen_random_uuid();
  a := public.enqueue_stock_chart_job(j,u,'JOBEXPIRED','{"operation":"drawings","interval":"1d"}');
  update public.stock_chart_jobs set status='running',expires_at=now()-interval '1 second' where id=j;
  perform public.expire_stock_chart_jobs();
  assert (select error_code from public.stock_chart_jobs where id=j)='ai_job_expired';
  begin
    perform public.complete_stock_chart_job(j,'{}','[]');
    raise exception 'Expired job saved a result';
  exception when raise_exception then
    assert sqlerrm='ai_job_expired', 'Expired completion was not rejected';
  end;
  assert not exists(select 1 from public.stock_analysis_heads where ticker='JOBEXPIRED' and user_id=u);
  assert not has_table_privilege('authenticated','public.stock_chart_jobs','SELECT');
  assert not has_table_privilege('anon','public.stock_chart_jobs','INSERT');
  assert not has_function_privilege('authenticated','public.claim_stock_chart_job()','EXECUTE');
  assert not has_function_privilege('anon','public.enqueue_stock_chart_job(uuid,uuid,text,jsonb)','EXECUTE');
  assert (select relrowsecurity from pg_class where oid='public.stock_chart_jobs'::regclass);
end $$;
rollback;
