-- Independent current pointers and immutable histories for text analysis and AI overlays.
alter table public.stock_analysis_versions drop constraint stock_analysis_versions_kind_check;
alter table public.stock_analysis_versions add constraint stock_analysis_versions_kind_check check (kind in ('technical','drawings','research'));
alter table public.stock_analysis_heads drop constraint stock_analysis_heads_kind_check;
alter table public.stock_analysis_heads add constraint stock_analysis_heads_kind_check check (kind in ('technical','drawings','research'));

create function public.save_stock_chart_result(p_user_id uuid,p_ticker text,p_kind text,p_payload jsonb,p_request jsonb,p_bars jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_time timestamptz;
begin
  if p_kind not in ('technical','drawings') then raise exception 'invalid_chart_operation'; end if;
  insert into public.stock_analysis_heads(user_id,ticker,kind) values (p_user_id,p_ticker,p_kind) on conflict do nothing;
  perform 1 from public.stock_analysis_heads where user_id=p_user_id and ticker=p_ticker and kind=p_kind for update;
  insert into public.stock_analysis_versions(user_id,ticker,kind,payload,request,bars)
    values(p_user_id,p_ticker,p_kind,p_payload,p_request,p_bars) returning id,created_at into v_id,v_time;
  update public.stock_analysis_heads set version_id=v_id where user_id=p_user_id and ticker=p_ticker and kind=p_kind;
  return jsonb_build_object('id',v_id,'created_at',v_time);
end $$;
revoke all on function public.save_stock_chart_result(uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_stock_chart_result(uuid,text,text,jsonb,jsonb,jsonb) to service_role;

-- Preserve previously generated combined results as both analysis and drawing history.
insert into public.stock_analysis_versions(user_id,ticker,kind,created_at,payload,request,bars)
select user_id,ticker,'drawings',created_at,payload || '{"operation":"drawings"}'::jsonb,
 request || jsonb_build_object('operation','drawings','source_version_id',id),bars
from public.stock_analysis_versions where kind='technical' and not (request ? 'operation');
insert into public.stock_analysis_heads(user_id,ticker,kind,version_id)
select h.user_id,h.ticker,'drawings',v.id from public.stock_analysis_heads h
join public.stock_analysis_versions v on v.user_id=h.user_id and v.ticker=h.ticker and v.kind='drawings'
 and v.request->>'source_version_id'=h.version_id::text
where h.kind='technical' on conflict do nothing;
