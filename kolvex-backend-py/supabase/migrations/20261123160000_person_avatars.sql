-- Admin-set portraits, one per person, kept apart from person_updates so new imports
-- never replace them. person_key is the English name lowercased with spaces collapsed.
create table public.person_avatars (
    person_key text primary key
        check (char_length(person_key) <= 200 and person_key = lower(btrim(person_key)) and person_key <> ''),
    avatar_url text not null
        check (char_length(avatar_url) <= 2048 and avatar_url ~* '^https://[^[:space:]/?#]+'),
    updated_at timestamptz not null default now()
);

alter table public.person_avatars enable row level security;
revoke all on public.person_avatars from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.person_avatars to service_role;

insert into public.person_avatars (person_key, avatar_url) values
    ('donald trump', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29.jpg/250px-Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29.jpg')
on conflict (person_key) do nothing;
