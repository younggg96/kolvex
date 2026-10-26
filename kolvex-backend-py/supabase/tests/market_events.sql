-- Run as an administrator. All synthetic rows are rolled back.
begin;
do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.market_events'::regclass), 'RLS required';
  assert not has_table_privilege('anon', 'public.market_events', 'SELECT'), 'anon read denied';
  assert not has_table_privilege('authenticated', 'public.market_events', 'SELECT'), 'direct authenticated read denied';
  assert not has_table_privilege('authenticated', 'public.market_events', 'INSERT'), 'direct write denied';
  assert not has_table_privilege('authenticated', 'public.market_events', 'UPDATE'), 'direct update denied';
  assert not has_table_privilege('authenticated', 'public.market_events', 'DELETE'), 'direct delete denied';
end $$;
set local role service_role;
insert into public.market_events(id, event_date, status, importance, is_hot, payload)
values ('__calendar_transaction_test__', '2026-10-28', 'draft', 'high', false, '{"title":"test"}'::jsonb);
insert into public.market_events(id, event_date, status, importance, is_hot, payload)
values ('__calendar_transaction_test__', '2026-10-28', 'published', 'high', true, '{"title":"updated"}'::jsonb)
on conflict(id) do update set status=excluded.status, payload=excluded.payload;
do $$
begin
  assert (select count(*) from public.market_events where id='__calendar_transaction_test__') = 1, 'upsert idempotence';
  assert (select payload->>'title' from public.market_events where id='__calendar_transaction_test__') = 'updated', 'payload updated';
end $$;
rollback;
