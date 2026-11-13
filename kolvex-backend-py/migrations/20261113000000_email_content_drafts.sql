begin;

-- Editable email content: hero image, intro, and per-section toggles, titles and notes.
alter table public.email_settings
    add column content jsonb not null default '{}'::jsonb;

-- Scheduled sends wait here until an admin approves them.
create table public.email_drafts (
    id uuid primary key default gen_random_uuid(),
    kind text not null references public.email_settings(kind) on delete cascade,
    send_date date not null,
    subject text not null,
    html text not null,
    status text not null default 'pending' check (status in ('pending', 'sent', 'rejected', 'failed')),
    created_at timestamptz not null default now(),
    decided_at timestamptz,
    decided_by uuid,
    recipient_count integer,
    error text,
    unique (kind, send_date)
);

-- Admin-only: no grants to anon/authenticated; the backend uses the service role.
alter table public.email_drafts enable row level security;

commit;
