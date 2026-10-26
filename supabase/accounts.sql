-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query),
-- AFTER supabase/schema.sql. It is idempotent: safe to run more than once.
--
-- Adds the tables behind the signed-in features (Massachusetts pilot):
--   * profiles         one row per Supabase Auth user
--   * protest_reports  AI-summarized protest pins shown to signed-in users
--   * protest_flags    user flags that auto-hide bad reports
--   * assistant_usage  per-user daily counters for abuse limits
--
-- PRIVACY STANCE PER TABLE
--   profiles         Private. A user can read/update only their own row.
--                    Holds an optional display name (<= 40 chars) and nothing else.
--   protest_reports  Mixed. Signed-in users can read ONLY id, lat, lng, intensity,
--                    summary, created_at, expires_at of VISIBLE, UNEXPIRED rows.
--                    user_id and description_private are never readable by any
--                    client role (column-level privileges). Anonymous visitors
--                    get nothing at all. Clients cannot insert/update/delete:
--                    all writes go through server/assistant.py with the
--                    service_role key (which bypasses RLS and is never shipped
--                    to a browser).
--   protest_flags    Write-only for clients. A signed-in user can add a flag as
--                    themselves; nobody on the client side can read flags.
--   assistant_usage  Server only. RLS on, no client policies, no client grants.
--
-- PURGE (retention)
--   Pins disappear from the map when expires_at passes, but the rows (including
--   the private raw text) remain until purged. Run regularly, e.g. daily:
--
--     delete from public.protest_reports
--      where expires_at < now() - interval '7 days';
--
--   One option is the pg_cron extension (Dashboard -> Database -> Extensions):
--
--     select cron.schedule(
--       'purge-protest-reports', '17 4 * * *',
--       $$delete from public.protest_reports
--          where expires_at < now() - interval '7 days'$$);
--
--     -- Optional: trim old usage counters too.
--     -- delete from public.assistant_usage where day < current_date - 30;
--
--   Do NOT add protest_reports to the supabase_realtime publication.

-- profiles ---------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 40),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Own profile read" on public.profiles;
create policy "Own profile read"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Own profile update" on public.profiles;
create policy "Own profile update"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Clients may only change the display name (not id / created_at).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Create the profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- protest_reports --------------------------------------------------------
create table if not exists public.protest_reports (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  -- The service rounds to 3 decimals (~110 m) before storing.
  lat                 double precision not null check (lat between -90 and 90),
  lng                 double precision not null check (lng between -180 and 180),
  -- 1 peaceful, 2 tense, 3 disruptive, 4 unsafe
  intensity           smallint not null check (intensity between 1 and 4),
  -- AI-written, protest-only summary. Null when the AI was unavailable.
  summary             text check (summary is null or char_length(summary) <= 400),
  -- The reporter's raw words. PRIVATE: never selectable by any client role.
  description_private text check (description_private is null or char_length(description_private) <= 600),
  status              text not null default 'visible'
                        check (status in ('visible', 'hidden', 'removed')),
  created_at          timestamptz not null default now(),
  -- The service sets now() + REPORT_TTL_HOURS (default 6 hours).
  expires_at          timestamptz not null,
  flag_count          int not null default 0
);

create index if not exists protest_reports_status_expires_idx
  on public.protest_reports (status, expires_at);

create index if not exists protest_reports_lat_lng_idx
  on public.protest_reports (lat, lng);

alter table public.protest_reports enable row level security;

drop policy if exists "Signed-in read visible reports" on public.protest_reports;
create policy "Signed-in read visible reports"
  on public.protest_reports
  for select
  to authenticated
  using (status = 'visible' and expires_at > now());

-- No insert/update/delete policies exist on purpose: with RLS on, that means
-- clients cannot write. Only the service_role key (server/assistant.py) can.

-- Column-level privileges. Why anon gets nothing: pins show where people are
-- gathering and who may be near them, so we only show them to accountable,
-- signed-in accounts (that can be rate-limited, flagged and banned), never to
-- anonymous scrapers. Why authenticated gets only these columns: user_id would
-- let people link reports to accounts, and description_private holds raw,
-- unreviewed text.
-- NOTE: clients must list columns explicitly (select=id,lat,lng,...). A
-- "select *" is rejected by Postgres because it includes ungranted columns.
revoke all on public.protest_reports from anon, authenticated;
grant select (id, lat, lng, intensity, summary, created_at, expires_at)
  on public.protest_reports to authenticated;

-- protest_flags ----------------------------------------------------------
create table if not exists public.protest_flags (
  report_id  uuid not null references public.protest_reports(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  reason     text not null check (reason in
               ('inaccurate', 'not_a_protest', 'identifies_people', 'unsafe_or_harassing', 'other')),
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

alter table public.protest_flags enable row level security;

drop policy if exists "Signed-in add own flag" on public.protest_flags;
create policy "Signed-in add own flag"
  on public.protest_flags
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No select/update/delete policies: clients cannot read or change flags.
revoke all on public.protest_flags from anon, authenticated;
grant insert (report_id, user_id, reason) on public.protest_flags to authenticated;

-- Each new flag bumps the counter; three flags hide the report.
create or replace function public.apply_protest_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.protest_reports
     set flag_count = flag_count + 1,
         status = case
                    when status = 'visible' and flag_count + 1 >= 3 then 'hidden'
                    else status
                  end
   where id = new.report_id;
  return new;
end;
$$;

revoke execute on function public.apply_protest_flag() from public, anon, authenticated;

drop trigger if exists on_protest_flag_inserted on public.protest_flags;
create trigger on_protest_flag_inserted
  after insert on public.protest_flags
  for each row execute function public.apply_protest_flag();

-- assistant_usage --------------------------------------------------------
create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  kind    text not null check (kind in ('ask', 'report')),
  count   int  not null default 0,
  primary key (user_id, day, kind)
);

-- RLS on with no policies and no grants: only service_role can touch it.
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from anon, authenticated;

-- Atomically add one use for today (UTC) and return the new count.
-- Returns -1 (and changes nothing) when the user is already at p_limit.
create or replace function public.bump_usage(p_user uuid, p_kind text, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day   date := (now() at time zone 'utc')::date;
  v_count int;
begin
  if p_kind not in ('ask', 'report') or p_limit is null or p_limit <= 0 then
    return -1;
  end if;

  -- The WHERE on the conflict branch makes the limit check atomic: when the
  -- row is already at the limit, nothing is updated and v_count stays null.
  insert into public.assistant_usage as u (user_id, day, kind, count)
  values (p_user, v_day, p_kind, 1)
  on conflict (user_id, day, kind)
  do update set count = u.count + 1
     where u.count < p_limit
  returning u.count into v_count;

  if v_count is null then
    return -1;
  end if;
  return v_count;
end;
$$;

revoke execute on function public.bump_usage(uuid, text, int) from public, anon, authenticated;
grant execute on function public.bump_usage(uuid, text, int) to service_role;
