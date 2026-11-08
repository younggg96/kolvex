-- 1. Saved valuation runs are immutable, as 20261105190100 intended (it never took effect).
revoke update, delete, truncate on public.company_valuation_ai_runs from service_role;

-- 2. Signup trigger: not callable through the API, fixed search_path.
--    Execute permission is checked when a trigger is created, not when it fires.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
alter function public.handle_new_user() set search_path = '';

-- 3. Timestamp triggers: fixed search_path; the chat trigger qualifies its table first.
alter function public.update_updated_at_column() set search_path = '';
alter function public.update_user_api_keys_updated_at() set search_path = '';
create or replace function public.update_chat_conversation_updated_at()
  returns trigger language plpgsql set search_path = '' as $$
begin
  update public.chat_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;
