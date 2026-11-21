-- Tokens a chat answer used, counted by the server across every model call of that turn
-- (routing, the answering agent and model calls inside its tools). Shown under the answer.
alter table public.chat_messages
    add column token_usage jsonb;

comment on column public.chat_messages.token_usage is
    'Server count of model tokens for this assistant turn: input_tokens, cached_input_tokens, output_tokens, model_calls, incomplete.';

alter table public.chat_messages
    add constraint chat_messages_token_usage_is_assistant_object
    check (
        token_usage is null
        or (role = 'assistant' and jsonb_typeof(token_usage) = 'object')
    );

create policy "Clients cannot attach token usage"
    on public.chat_messages as restrictive for insert to anon, authenticated
    with check (token_usage is null);
