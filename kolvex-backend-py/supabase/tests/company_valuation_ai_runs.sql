-- Run against a database with at least one existing auth user. All writes roll back.
begin;
do $$
declare u uuid; other uuid := gen_random_uuid(); r uuid; n int;
begin
  select id into u from auth.users limit 1;
  assert u is not null, 'Requires a test auth user';
  insert into public.company_valuation_ai_runs(user_id,ticker,model_id,prompt_version,snapshot_id,payload,results,financial_snapshot)
    values (u,'AIRUNTEST','m','v','s','{}','{}','{}') returning id into r;
  begin
    insert into public.company_valuation_ai_runs(user_id,ticker,model_id,prompt_version,snapshot_id,payload,results,financial_snapshot)
      values (u,'lower','m','v','s','{}','{}','{}');
    raise exception 'Ticker check missing';
  exception when check_violation then null; end;

  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.company_valuation_ai_runs where id=r;
  assert n=1, 'Owner cannot read own run';
  begin
    insert into public.company_valuation_ai_runs(user_id,ticker,model_id,prompt_version,snapshot_id,payload,results,financial_snapshot)
      values (u,'AIRUNTEST','m','v','s','{}','{}','{}');
    raise exception 'Client insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.company_valuation_ai_runs set model_id='x' where id=r;
    raise exception 'Client update allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.company_valuation_ai_runs where id=r;
    raise exception 'Client delete allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub',other,'role','authenticated')::text, true);
  select count(*) into n from public.company_valuation_ai_runs where id=r;
  assert n=0, 'Another user can read this run';
  reset role;

  set local role anon;
  begin
    select count(*) into n from public.company_valuation_ai_runs;
    raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null; end;
  reset role;

  set local role service_role;
  begin
    update public.company_valuation_ai_runs set model_id='x' where id=r;
    raise exception 'Runs must be immutable';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
rollback;
