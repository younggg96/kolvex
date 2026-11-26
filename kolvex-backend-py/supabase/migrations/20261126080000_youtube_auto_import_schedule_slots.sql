-- YouTube auto import runs several times a day (YOUTUBE_IMPORT_SCHEDULE_TIME is a list).
-- A scheduled run is now unique per local date and time slot instead of per date.
-- Earlier scheduled rows keep a null slot and never collide with new ones.

alter table public.youtube_auto_import_runs
    add column schedule_slot time;

comment on column public.youtube_auto_import_runs.schedule_slot is
    'Local time slot (backend timezone) of a scheduled run; null for manual runs and runs before slots existed.';

drop index public.youtube_auto_import_runs_one_schedule_per_day_idx;

create unique index youtube_auto_import_runs_one_per_slot_idx
    on public.youtube_auto_import_runs (scheduled_for, schedule_slot)
    where trigger = 'schedule';
