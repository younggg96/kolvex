-- Suggested next questions an assistant answer ended with, shown under the latest answer.
alter table public.chat_messages
    add column follow_ups jsonb;

comment on column public.chat_messages.follow_ups is
    'Server-parsed follow-up questions from the answer''s <follow_ups> block (app/agent/follow_ups.py): ["question", ...].';

alter table public.chat_messages
    add constraint chat_messages_follow_ups_is_assistant_array
    check (
        follow_ups is null
        or (role = 'assistant' and jsonb_typeof(follow_ups) = 'array')
    );

create policy "Clients cannot attach follow-ups"
    on public.chat_messages as restrictive for insert to anon, authenticated
    with check (follow_ups is null);
