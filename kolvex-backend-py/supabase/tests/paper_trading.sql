\set ON_ERROR_STOP on
begin;
set local role service_role;
insert into public.paper_accounts(user_id, state) values
  ('00000000-0000-0000-0000-000000000001', '{"cash":"100000"}'),
  ('00000000-0000-0000-0000-000000000002', '{"cash":"99999"}');
insert into public.paper_reviews(user_id, position_id, note, snapshot) values
  ('00000000-0000-0000-0000-000000000001', gen_random_uuid(), 'I learned to follow the original exit plan.', '{"realized_pnl":"-10"}');
do $$ declare changed integer; begin
  update public.paper_accounts set version=1, state='{"cash":"90000"}' where user_id='00000000-0000-0000-0000-000000000001' and version=0;
  get diagnostics changed = row_count;
  assert changed=1, 'first CAS must succeed';
  update public.paper_accounts set version=1, state='{"cash":"80000"}' where user_id='00000000-0000-0000-0000-000000000001' and version=0;
  get diagnostics changed = row_count;
  assert changed=0, 'stale CAS must not overwrite';
  assert (select state->>'cash' from public.paper_accounts where user_id='00000000-0000-0000-0000-000000000001')='90000';
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from public.paper_accounts)=1, 'user must see only own account';
  assert (select state->>'cash' from public.paper_accounts)='90000';
  assert not has_table_privilege(current_user, 'public.paper_accounts', 'UPDATE'), 'ledger tampering must be denied';
  assert not has_table_privilege(current_user, 'public.paper_accounts', 'INSERT');
  assert not has_table_privilege(current_user, 'public.paper_accounts', 'DELETE');
  assert not has_table_privilege(current_user, 'public.paper_reviews', 'INSERT'), 'snapshots must come from server';
  assert not has_table_privilege(current_user, 'public.paper_reviews', 'UPDATE');
  assert not has_table_privilege(current_user, 'public.paper_reviews', 'DELETE');
end $$;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$ begin
  assert (select count(*) from public.paper_accounts)=1;
  assert (select state->>'cash' from public.paper_accounts)='99999', 'second user must not read first user';
  assert (select count(*) from public.paper_reviews)=1, 'signed-in learners can read published reviews';
end $$;
reset role;
do $$ begin
  assert not has_table_privilege('anon', 'public.paper_accounts', 'SELECT');
  assert not has_table_privilege('anon', 'public.paper_reviews', 'SELECT');
  assert (select bool_and(relrowsecurity) from pg_class where oid in ('public.paper_accounts'::regclass,'public.paper_reviews'::regclass));
end $$;
rollback;
select 'paper trading RLS, grants and version CAS passed' as result;
