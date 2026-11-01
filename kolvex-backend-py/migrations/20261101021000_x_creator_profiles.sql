-- Optional public profile facts. Existing read policies and admin-only writes remain in force.
alter table public.x_creators
  add column if not exists avatar_url text check (length(avatar_url) <= 2048 and avatar_url like 'https://%'),
  add column if not exists location text check (length(location) <= 200),
  add column if not exists website text check (length(website) <= 2048 and website like 'https://%'),
  add column if not exists followers_count bigint check (followers_count between 0 and 9007199254740991),
  add column if not exists following_count bigint check (following_count between 0 and 9007199254740991);
