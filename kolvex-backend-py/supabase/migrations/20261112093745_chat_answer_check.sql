alter table public.chat_messages
    add column answer_check jsonb;

comment on column public.chat_messages.answer_check is
    'Server check of the numbers in an assistant answer against that turn''s tool evidence.';

alter table public.chat_messages
    add constraint chat_messages_answer_check_is_assistant_object
    check (
        answer_check is null
        or (role = 'assistant' and jsonb_typeof(answer_check) = 'object')
    );

create policy "Clients cannot attach answer checks"
    on public.chat_messages as restrictive for insert to anon, authenticated
    with check (answer_check is null);
