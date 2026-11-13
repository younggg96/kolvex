begin;

create table public.email_settings (
    kind text primary key check (kind in ('daily_brief', 'holdings_change')),
    enabled boolean not null default false,
    send_time text not null default '07:00' check (send_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    timezone text not null default 'America/Los_Angeles',
    weekdays smallint[] not null default '{0,1,2,3,4}',
    from_name text not null default 'Kolvex' check (length(from_name) <= 100),
    from_email text not null default '' check (length(from_email) <= 200),
    reply_to text not null default '' check (length(reply_to) <= 200),
    subject_template text not null default '' check (length(subject_template) <= 200),
    last_sent_on date,
    last_run_at timestamptz,
    last_status text,
    last_error text,
    last_recipient_count integer,
    updated_at timestamptz not null default now()
);

insert into public.email_settings (kind, subject_template) values
    ('daily_brief', '[Kolvex] {title}'),
    ('holdings_change', '[Kolvex] 机构持仓更新 {date}');

-- Admin-only: no grants to anon/authenticated; the backend uses the service role.
alter table public.email_settings enable row level security;

commit;
