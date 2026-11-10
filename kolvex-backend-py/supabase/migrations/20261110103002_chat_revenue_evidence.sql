alter table public.chat_messages
    add column revenue_evidence jsonb;

comment on column public.chat_messages.revenue_evidence is
    'Validated revenue tool snapshots attached to an assistant message.';

alter table public.chat_messages
    add constraint chat_messages_revenue_evidence_is_assistant_array
    check (
        revenue_evidence is null
        or (role = 'assistant' and jsonb_typeof(revenue_evidence) = 'array')
    );

create policy "Clients cannot attach revenue evidence"
    on public.chat_messages as restrictive for insert to anon, authenticated
    with check (revenue_evidence is null);
