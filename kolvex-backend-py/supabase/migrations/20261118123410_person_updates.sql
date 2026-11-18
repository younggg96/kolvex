create table public.person_updates (
    id text primary key check (char_length(id) <= 128 and id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    person text not null check (btrim(person) <> ''),
    person_cn text not null check (btrim(person_cn) <> ''),
    published_at timestamptz not null,
    title text not null check (btrim(title) <> ''),
    summary text not null check (btrim(summary) <> ''),
    source_url text not null check (source_url ~* '^https://[^[:space:]/?#]+'),
    impact text not null check (impact in ('high', 'medium', 'low')),
    tags text[] not null default '{}',
    tickers text[] not null default '{}',
    image_url text,
    image_alt text,
    constraint person_updates_image_pair check (
        (image_url is null and image_alt is null)
        or (image_url is not null and image_url ~* '^https://[^[:space:]/?#]+'
            and image_alt is not null and btrim(image_alt) <> '')
    )
);

create index person_updates_timeline_idx
    on public.person_updates (published_at desc, id desc);

alter table public.person_updates enable row level security;
revoke all on public.person_updates from public, anon, authenticated, service_role;
grant select, insert, update on public.person_updates to service_role;
