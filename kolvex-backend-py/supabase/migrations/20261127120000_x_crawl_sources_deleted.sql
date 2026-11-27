-- Creators deleted from the admin page leave the visible crawl list but stay turned off,
-- so a name in the collector's local sources.json is not scanned again.
-- Adding the account again clears deleted_at and turns it back on.
begin;

alter table public.x_crawl_sources add column deleted_at timestamptz;

comment on column public.x_crawl_sources.deleted_at is
    'Set when an administrator deleted the creator; hidden from the admin list, never crawled.';

commit;
