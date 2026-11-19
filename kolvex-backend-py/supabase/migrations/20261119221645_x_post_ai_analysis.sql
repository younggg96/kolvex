begin;

-- Existing posts stay unqueued. New inserts are queued in the import transaction.
alter table public.x_posts add column ai_analysis jsonb;
alter table public.x_posts alter column ai_analysis set default '{"status":"pending"}'::jsonb;

create index x_posts_pending_ai_analysis
    on public.x_posts (id)
    where not truncated and (ai_analysis->>'status') = 'pending';

commit;
