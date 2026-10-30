begin;

create table public.x_creators (
    username text primary key check (username ~ '^[a-z0-9_]{1,15}$'),
    display_name text not null check (length(display_name) between 1 and 100),
    bio text not null default '' check (length(bio) <= 1000),
    created_at timestamptz not null default now()
);
create table public.x_posts (
    id text primary key check (id ~ '^[1-9][0-9]{0,24}$'),
    author_username text not null references public.x_creators(username),
    url text not null,
    published_at timestamptz not null,
    text text not null check (length(text) between 1 and 50000),
    cashtags text[] not null default '{}',
    metrics jsonb not null default '{}',
    quoted_texts jsonb not null default '[]',
    media_links jsonb not null default '[]',
    truncated boolean not null default false,
    pinned boolean not null default false,
    imported_at timestamptz not null default now()
);
create index x_posts_timeline on public.x_posts(published_at desc, id desc);
create index x_posts_author_timeline on public.x_posts(author_username, published_at desc, id desc);
create index x_posts_cashtags on public.x_posts using gin(cashtags);

alter table public.x_creators enable row level security;
alter table public.x_posts enable row level security;
-- Public evidence is readable. Writes go through admin-verified backend endpoints.
grant select on public.x_creators, public.x_posts to anon, authenticated;
grant all on public.x_creators, public.x_posts to service_role;
revoke insert, update, delete, truncate, references, trigger on public.x_creators, public.x_posts from anon, authenticated;
create policy x_creators_public_read on public.x_creators for select to anon, authenticated using (true);
create policy x_posts_public_read on public.x_posts for select to anon, authenticated using (true);

create function public.import_x_posts(posts jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare inserted_count integer;
begin
    if jsonb_typeof(posts) <> 'array' or jsonb_array_length(posts) not between 1 and 500 then
        raise exception 'Expected 1–500 posts';
    end if;
    insert into public.x_creators(username, display_name)
    select distinct item->>'author_username', item->>'author_username'
    from jsonb_array_elements(posts) item
    on conflict (username) do nothing;

    insert into public.x_posts(id, author_username, url, published_at, text, cashtags,
                              metrics, quoted_texts, media_links, truncated, pinned)
    select item->>'id', item->>'author_username', item->>'url',
           (item->>'published_at')::timestamptz, item->>'text',
           array(select jsonb_array_elements_text(item->'cashtags')),
           item->'metrics', item->'quoted_texts', item->'media_links',
           (item->>'truncated')::boolean, (item->>'pinned')::boolean
    from jsonb_array_elements(posts) item
    on conflict (id) do nothing;
    get diagnostics inserted_count = row_count;
    return jsonb_build_object('inserted', inserted_count);
end;
$$;
revoke all on function public.import_x_posts(jsonb) from public, anon, authenticated;
grant execute on function public.import_x_posts(jsonb) to service_role;
commit;
