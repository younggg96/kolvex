create or replace function public.replace_congress_trades(snapshot jsonb, fetched_at timestamptz)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
    -- Concurrent workers may fetch at the same time. Only the newer snapshot wins.
    insert into public.congress_trade_sync as sync (fetched_at)
    values ($2)
    on conflict (singleton) do update set fetched_at = excluded.fetched_at
    where sync.fetched_at < excluded.fetched_at;
    if not found then
        return false;
    end if;

    -- The managed database requires an explicit predicate for deletes.
    delete from public.congress_trades where id > 0;
    insert into public.congress_trades (
        member_name, chamber, ticker, asset_name, trade_date,
        filed_date, direction, transaction_type, amount_range, source_url
    )
    select
        row.member_name, row.chamber, row.ticker, row.asset_name,
        row.trade_date, row.filed_date, row.direction, row.transaction_type,
        row.amount_range, row.source_url
    from jsonb_populate_recordset(null::public.congress_trades, snapshot) as row;
    return true;
end;
$$;
