-- Stored 13F-HR snapshots for the tracked Superinvestors list.
-- The backend syncs each manager from SEC EDGAR after a new quarterly filing
-- appears and serves reads from here. Only the backend service role may read/write.
create table public.institution_13f_filings (
  accession text primary key,
  manager_id text not null,
  manager_name text not null,
  cik bigint not null,
  period date not null,
  filed date not null,
  filing jsonb not null check (jsonb_typeof(filing) = 'object'),
  previous_filing jsonb,
  amendments jsonb not null default '[]'::jsonb check (jsonb_typeof(amendments) = 'array'),
  partial boolean not null default false,
  coverage text,
  -- Card view (summarize_institution), kept in step with the holdings rows.
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  holdings_count integer not null check (holdings_count >= 0),
  -- False until every holdings row is written; readers ignore incomplete snapshots.
  complete boolean not null default false,
  -- Set once every CUSIP has been sent to OpenFIGI; until then the sync keeps filling tickers.
  tickers_mapped_at timestamptz,
  sec_fetched_at timestamptz not null,
  synced_at timestamptz not null default now()
);
create index institution_13f_filings_latest
  on public.institution_13f_filings(manager_id, period desc, filed desc) where complete;

create table public.institution_13f_holdings (
  accession text not null references public.institution_13f_filings(accession) on delete cascade,
  position integer not null check (position >= 0),
  issuer text,
  class text,
  cusip text,
  ticker text,
  share_type text,
  put_call text,
  value numeric,
  shares numeric,
  previous_shares numeric,
  change numeric,
  change_percent double precision,
  weight double precision,
  activity text not null check (activity in ('new', 'increased', 'reduced', 'unchanged', 'exited', 'unknown')),
  primary key (accession, position)
);
create index institution_13f_holdings_ticker on public.institution_13f_holdings(ticker) where ticker is not null;

alter table public.institution_13f_filings enable row level security;
alter table public.institution_13f_holdings enable row level security;
revoke all on public.institution_13f_filings from anon, authenticated;
revoke all on public.institution_13f_holdings from anon, authenticated;
grant all on public.institution_13f_filings to service_role;
grant all on public.institution_13f_holdings to service_role;
