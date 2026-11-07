-- Parser revision that produced each 13F row; the backend resyncs rows older than its SYNC_VERSION.
alter table public.institution_13f_filings add column sync_version integer not null default 1;
