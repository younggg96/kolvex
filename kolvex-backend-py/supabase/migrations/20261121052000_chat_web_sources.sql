-- Pages the turn's web searches returned, listed under the answer as its sources.
alter table public.chat_messages
    add column web_sources jsonb;

comment on column public.chat_messages.web_sources is
    'Server-collected web_search results for this assistant turn: [{url, domain, title, snippet, query, published_date?}].';

alter table public.chat_messages
    add constraint chat_messages_web_sources_is_assistant_array
    check (
        web_sources is null
        or (role = 'assistant' and jsonb_typeof(web_sources) = 'array')
    );

create policy "Clients cannot attach web sources"
    on public.chat_messages as restrictive for insert to anon, authenticated
    with check (web_sources is null);
