-- Share links: an immutable snapshot of one piece of content (an AI answer or a passage of it,
-- a creator opinion, an X post, a person update, an options-activity candidate, a published
-- research report). The backend builds every snapshot from the stored source row; clients never
-- supply the shared text. Only the backend (service role) reads or writes this table.
begin;

create table public.content_shares (
    id text primary key check (id ~ '^[A-Za-z0-9]{10}$'),
    user_id uuid not null references auth.users (id) on delete cascade,
    kind text not null check (
        kind in ('chat', 'opinion', 'x_post', 'person_update', 'options_candidate', 'research')
    ),
    source_id text not null check (char_length(source_id) between 1 and 200),
    content_hash text not null,
    -- signed_in: licensed market data (options activity) is readable by signed-in users only.
    visibility text not null default 'public' check (visibility in ('public', 'signed_in')),
    locale text not null check (locale in ('zh', 'en')),
    card jsonb not null,
    created_at timestamptz not null default now(),
    revoked_at timestamptz
);

-- Sharing the same thing twice returns the existing link.
create unique index content_shares_active_unique
    on public.content_shares (user_id, content_hash)
    where revoked_at is null;
create index content_shares_user_created on public.content_shares (user_id, created_at desc);

alter table public.content_shares enable row level security;
revoke all on public.content_shares from anon, authenticated;
grant select, insert, update on public.content_shares to service_role;

commit;
