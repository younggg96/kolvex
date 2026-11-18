alter table public.person_updates
    add column avatar_url text
    constraint person_updates_avatar_url_check
        check (avatar_url ~* '^https://[^[:space:]/?#]+');
