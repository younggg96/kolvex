-- Immutable private snapshots. Only the server creates or switches versions.
create table public.stock_analysis_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  kind text not null check (kind in ('technical', 'research')),
  created_at timestamptz not null default now(),
  payload jsonb not null,
  request jsonb not null default '{}'::jsonb,
  bars jsonb not null default '[]'::jsonb,
  unique (user_id, ticker, kind, id)
);
create index stock_analysis_history_idx on public.stock_analysis_versions(user_id, ticker, kind, created_at desc, id desc);
create table public.stock_analysis_heads (
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  kind text not null check (kind in ('technical', 'research')),
  version_id uuid,
  primary key (user_id, ticker, kind),
  foreign key (user_id, ticker, kind, version_id)
    references public.stock_analysis_versions(user_id, ticker, kind, id)
);
alter table public.stock_analysis_versions enable row level security;
alter table public.stock_analysis_heads enable row level security;
revoke all on public.stock_analysis_versions, public.stock_analysis_heads from anon, authenticated;
grant select on public.stock_analysis_versions, public.stock_analysis_heads to authenticated;
grant all on public.stock_analysis_versions, public.stock_analysis_heads to service_role;
create policy own_analysis_versions on public.stock_analysis_versions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy own_analysis_heads on public.stock_analysis_heads for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.save_stock_technical_analysis(p_user_id uuid, p_ticker text, p_payload jsonb, p_request jsonb, p_bars jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_time timestamptz;
begin
  insert into public.stock_analysis_heads(user_id,ticker,kind) values (p_user_id,p_ticker,'technical') on conflict do nothing;
  perform 1 from public.stock_analysis_heads where user_id=p_user_id and ticker=p_ticker and kind='technical' for update;
  insert into public.stock_analysis_versions(user_id,ticker,kind,payload,request,bars)
    values (p_user_id,p_ticker,'technical',p_payload,p_request,p_bars) returning id,created_at into v_id,v_time;
  update public.stock_analysis_heads set version_id=v_id where user_id=p_user_id and ticker=p_ticker and kind='technical';
  return jsonb_build_object('id',v_id,'created_at',v_time);
end $$;

create function public.activate_stock_analysis(p_user_id uuid, p_ticker text, p_version_id uuid, p_expected_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_kind text; v_current uuid; v_row jsonb;
begin
  select kind,to_jsonb(v) into v_kind,v_row from public.stock_analysis_versions v
    where id=p_version_id and user_id=p_user_id and ticker=p_ticker;
  if not found then raise exception 'analysis_not_found' using errcode='P0002'; end if;
  select version_id into v_current from public.stock_analysis_heads
    where user_id=p_user_id and ticker=p_ticker and kind=v_kind for update;
  if v_current is distinct from p_expected_id then raise exception 'analysis_conflict' using errcode='40001'; end if;
  update public.stock_analysis_heads set version_id=p_version_id where user_id=p_user_id and ticker=p_ticker and kind=v_kind;
  return v_row;
end $$;
revoke all on function public.save_stock_technical_analysis(uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.activate_stock_analysis(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_stock_technical_analysis(uuid,text,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.activate_stock_analysis(uuid,text,uuid,uuid) to service_role;

-- Existing full research records already persist. Capture their completion in the
-- same database transaction, including jobs started outside the stock workspace.
create function public.capture_stock_research() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status='completed' and (tg_op='INSERT' or old.status is distinct from 'completed') then
    insert into public.stock_analysis_heads(user_id,ticker,kind) values (new.user_id,upper(new.ticker),'research') on conflict do nothing;
    perform 1 from public.stock_analysis_heads where user_id=new.user_id and ticker=upper(new.ticker) and kind='research' for update;
    insert into public.stock_analysis_versions(id,user_id,ticker,kind,created_at,payload,request)
      values (new.id,new.user_id,upper(new.ticker),'research',coalesce(new.completed_at,now()),to_jsonb(new),
        jsonb_build_object('trade_date',new.trade_date,'provider',new.llm_provider,'deep_think_model',new.deep_think_model,'quick_think_model',new.quick_think_model,'selected_analysts',new.selected_analysts))
      on conflict (id) do nothing;
    update public.stock_analysis_heads set version_id=new.id where user_id=new.user_id and ticker=upper(new.ticker) and kind='research';
  end if;
  return new;
end $$;
revoke all on function public.capture_stock_research() from public,anon,authenticated;
create trigger capture_stock_research after insert or update of status on public.trading_analyses
  for each row execute function public.capture_stock_research();
insert into public.stock_analysis_versions(id,user_id,ticker,kind,created_at,payload,request)
select id,user_id,upper(ticker),'research',coalesce(completed_at,created_at),to_jsonb(t),jsonb_build_object('trade_date',trade_date)
from public.trading_analyses t where status='completed';
insert into public.stock_analysis_heads(user_id,ticker,kind,version_id)
select distinct on (user_id,ticker,kind) user_id,ticker,kind,id
from public.stock_analysis_versions order by user_id,ticker,kind,created_at desc,id desc;
