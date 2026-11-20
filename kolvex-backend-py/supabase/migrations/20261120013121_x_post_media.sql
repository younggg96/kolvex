begin;

alter table public.x_posts add column media_assets jsonb not null default '[]'::jsonb;

-- Only the server archives files. Readers access public objects by their URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('x-post-media', 'x-post-media', true, 41943040,
        array['image/jpeg','image/png','image/webp','image/gif','video/mp4']);

create function public.record_x_post_media(post_id text, asset jsonb)
returns void language sql security invoker set search_path = '' as $$
    update public.x_posts
    set media_assets = media_assets || jsonb_build_array(asset)
    where id = post_id
      and not media_assets @> jsonb_build_array(jsonb_build_object('key', asset->>'key'));
$$;
revoke all on function public.record_x_post_media(text, jsonb) from public, anon, authenticated;
grant execute on function public.record_x_post_media(text, jsonb) to service_role;

commit;
