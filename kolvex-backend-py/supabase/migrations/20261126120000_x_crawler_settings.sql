-- X crawler settings edited from the admin page and read by the local Playwright collector.
-- x_crawl_sources: which X accounts the collector scans (disabled rows are skipped).
-- x_crawl_settings: singleton per-account scan limits.
-- Only the backend (service role) reads or writes these tables.
begin;

create table public.x_crawl_sources (
    username text primary key check (username ~ '^[a-z0-9_]{1,15}$'),
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.x_crawl_sources is
    'X accounts the local collector scans. Admin-managed; disabled rows are skipped.';

create table public.x_crawl_settings (
    id smallint primary key default 1 check (id = 1),
    max_posts_per_creator integer not null default 500 check (max_posts_per_creator between 1 and 2000),
    max_scrolls_per_creator integer not null default 60 check (max_scrolls_per_creator between 1 and 300),
    updated_at timestamptz not null default now()
);

insert into public.x_crawl_settings (id) values (1) on conflict (id) do nothing;

-- Keep today's crawl list: every known creator plus the collector's local sources.json.
insert into public.x_crawl_sources (username)
select username from public.x_creators
on conflict (username) do nothing;

insert into public.x_crawl_sources (username)
values ('mentoviax'), ('aleabitoreddit'), ('trumptruthonx'), ('tj_research'), ('stocktalkjay'),
       ('unusual_whales'), ('pelositracker'), ('burrytracker'), ('leopoldtracker_')
on conflict (username) do nothing;

alter table public.x_crawl_sources enable row level security;
alter table public.x_crawl_settings enable row level security;
-- No policies: clients never access these tables directly.
revoke all on public.x_crawl_sources, public.x_crawl_settings from anon, authenticated;
grant all on public.x_crawl_sources, public.x_crawl_settings to service_role;

commit;
