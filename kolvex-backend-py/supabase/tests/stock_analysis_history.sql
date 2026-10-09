-- Run against a database with at least one existing auth user. All writes roll back.
begin;
do $$
declare u uuid; a jsonb; b jsonb; n int; r uuid := gen_random_uuid();
begin
  select id into u from auth.users limit 1;
  assert u is not null, 'Requires a test auth user';
  a := public.save_stock_technical_analysis(u,'HISTTEST','{"symbol":"HISTTEST","levels":[{"price":10}]}','{"interval":"1d"}','[{"close":10}]');
  b := public.save_stock_technical_analysis(u,'HISTTEST','{"symbol":"HISTTEST","levels":[{"price":12}]}','{"interval":"1d"}','[{"close":12}]');
  select count(*) into n from public.stock_analysis_versions where user_id=u and ticker='HISTTEST';
  assert n=2, 'Previous version lost';
  assert (select version_id from public.stock_analysis_heads where user_id=u and ticker='HISTTEST' and kind='technical')=(b->>'id')::uuid;
  perform public.activate_stock_analysis(u,'HISTTEST',(a->>'id')::uuid,(b->>'id')::uuid);
  assert (select version_id from public.stock_analysis_heads where user_id=u and ticker='HISTTEST' and kind='technical')=(a->>'id')::uuid;
  begin
    perform public.activate_stock_analysis(u,'HISTTEST',(b->>'id')::uuid,(b->>'id')::uuid);
    raise exception 'Conflict check missing';
  exception when serialization_failure then null; end;
  begin
    perform public.activate_stock_analysis(gen_random_uuid(),'HISTTEST',(a->>'id')::uuid,null);
    raise exception 'Ownership check missing';
  exception when no_data_found then null; end;
  assert (select bars->0->>'close' from public.stock_analysis_versions where id=(a->>'id')::uuid)='10';
  insert into public.trading_analyses(id,user_id,ticker,trade_date,status) values (r,u,'HISTTEST',current_date,'running');
  update public.trading_analyses set status='completed', investment_plan='Saved plan',fundamentals_report='Saved fundamentals' where id=r;
  assert (select payload->>'investment_plan' from public.stock_analysis_versions where id=r)='Saved plan';
  assert (select version_id from public.stock_analysis_heads where user_id=u and ticker='HISTTEST' and kind='research')=r;
  -- Snapshot survives removal of the mutable job record.
  delete from public.trading_analyses where id=r;
  assert exists(select 1 from public.stock_analysis_versions where id=r);
end $$;
-- Text generation and drawing generation have independent pointers.
do $$ declare u uuid; a jsonb; b jsonb; c jsonb; begin
  select id into u from auth.users limit 1;
  a := public.save_stock_technical_analysis(u,'SPLITTEST','{"operation":"analysis","summary":"first"}','{"operation":"analysis"}','[]');
  b := public.save_stock_chart_result(u,'SPLITTEST','drawings','{"operation":"drawings","levels":[{"price":20}]}','{"operation":"drawings"}','[]');
  assert (select version_id from public.stock_analysis_heads where user_id=u and ticker='SPLITTEST' and kind='technical')=(a->>'id')::uuid;
  c := public.save_stock_technical_analysis(u,'SPLITTEST','{"operation":"analysis","summary":"second"}','{"operation":"analysis"}','[]');
  assert (select version_id from public.stock_analysis_heads where user_id=u and ticker='SPLITTEST' and kind='drawings')=(b->>'id')::uuid;
  perform public.activate_stock_analysis(u,'SPLITTEST',(a->>'id')::uuid,(c->>'id')::uuid);
  assert (select version_id from public.stock_analysis_heads where user_id=u and ticker='SPLITTEST' and kind='drawings')=(b->>'id')::uuid;
  assert (select count(*) from public.stock_analysis_versions where user_id=u and ticker='SPLITTEST')=3;
  assert not has_function_privilege('authenticated','public.save_stock_chart_result(uuid,text,text,jsonb,jsonb,jsonb)','EXECUTE');
end $$;
select set_config('request.jwt.claim.sub',(select id::text from auth.users limit 1),true);
set local role authenticated;
do $$ begin
  assert not exists(select 1 from public.stock_analysis_versions where user_id<>auth.uid());
  assert not exists(select 1 from public.stock_analysis_heads where user_id<>auth.uid());
  assert not has_table_privilege('authenticated','public.stock_analysis_versions','INSERT');
  assert not has_table_privilege('authenticated','public.stock_analysis_versions','UPDATE');
  assert not has_function_privilege('authenticated','public.activate_stock_analysis(uuid,text,uuid,uuid)','EXECUTE');
end $$;
reset role;
set local role anon;
do $$ begin assert not has_table_privilege('anon','public.stock_analysis_versions','SELECT'); end $$;
rollback;
select 'All stock analysis history assertions passed; test writes rolled back' as result;
