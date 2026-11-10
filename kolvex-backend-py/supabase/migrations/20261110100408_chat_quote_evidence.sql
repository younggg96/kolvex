alter table public.chat_messages
    add column quote_evidence jsonb;

comment on column public.chat_messages.quote_evidence is
    'Validated quote tool snapshots attached to an assistant message.';

alter table public.chat_messages
    add constraint chat_messages_quote_evidence_is_assistant_array
    check (
        quote_evidence is null
        or (role = 'assistant' and jsonb_typeof(quote_evidence) = 'array')
    );

create policy "Clients cannot attach quote evidence"
    on public.chat_messages as restrictive for insert to anon, authenticated
    with check (quote_evidence is null);
