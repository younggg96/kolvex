-- Automatic YouTube opinion import: a local Mac worker fetches transcripts of
-- untracked videos, the backend analyzes them with DeepSeek and imports the result.
-- Only the backend (service role) reads or writes these tables.

create table public.youtube_auto_import_runs (
    id uuid primary key default gen_random_uuid(),
    trigger text not null check (trigger in ('manual', 'schedule')),
    status text not null default 'queued'
        check (status in ('queued', 'running', 'succeeded', 'partial', 'failed')),
    requested_by uuid references auth.users(id) on delete set null,
    -- Local schedule date (backend timezone) of a scheduled run; one per day.
    scheduled_for date,
    model text,
    progress jsonb not null default '{}'::jsonb check (jsonb_typeof(progress) = 'object'),
    videos jsonb not null default '[]'::jsonb check (jsonb_typeof(videos) = 'array'),
    error text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    heartbeat_at timestamptz,
    finished_at timestamptz,
    constraint youtube_auto_import_runs_schedule_date
        check ((trigger = 'schedule') = (scheduled_for is not null))
);

comment on table public.youtube_auto_import_runs is
    'Runs of the local transcript worker + DeepSeek analysis that import YouTube stock opinions.';

create index youtube_auto_import_runs_created_at_idx
    on public.youtube_auto_import_runs (created_at desc);

-- At most one queued or running run at a time.
create unique index youtube_auto_import_runs_one_active_idx
    on public.youtube_auto_import_runs ((true))
    where status in ('queued', 'running');

-- At most one scheduled run per day.
create unique index youtube_auto_import_runs_one_schedule_per_day_idx
    on public.youtube_auto_import_runs (scheduled_for)
    where trigger = 'schedule';

-- Singleton row: when the local worker last checked in.
create table public.youtube_auto_import_worker (
    id smallint primary key default 1 check (id = 1),
    last_seen_at timestamptz not null default now(),
    hostname text,
    version text
);

alter table public.youtube_auto_import_runs enable row level security;
alter table public.youtube_auto_import_worker enable row level security;
-- No policies: clients never access these tables directly.
