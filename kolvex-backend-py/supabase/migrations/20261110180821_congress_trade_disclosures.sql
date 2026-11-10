create table public.congress_trades (
    id bigint generated always as identity primary key,
    member_name text not null,
    chamber text check (chamber in ('house', 'senate')),
    ticker text,
    asset_name text,
    trade_date date not null,
    filed_date date not null,
    direction text not null check (direction in ('buy', 'sell', 'exchange', 'other')),
    transaction_type text not null,
    amount_range text,
    source_url text
);

create index congress_trades_filed_idx on public.congress_trades (filed_date desc, id desc);
create index congress_trades_ticker_idx on public.congress_trades (ticker, filed_date desc, id desc);

create table public.congress_trade_sync (
    singleton boolean primary key default true check (singleton),
    fetched_at timestamptz not null
);

alter table public.congress_trades enable row level security;
alter table public.congress_trade_sync enable row level security;
revoke all on public.congress_trades, public.congress_trade_sync from public, anon, authenticated;
grant select, insert, delete on public.congress_trades to service_role;
grant select, insert, update on public.congress_trade_sync to service_role;

create function public.replace_congress_trades(snapshot jsonb, fetched_at timestamptz)
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

    delete from public.congress_trades;
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

revoke all on function public.replace_congress_trades(jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.replace_congress_trades(jsonb, timestamptz) to service_role;
