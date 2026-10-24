-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- It creates the politicians table, full-text + fuzzy search support,
-- Row Level Security with public read access, and a few sample rows.

-- Extension for fuzzy / trigram matching (handles typos & partial names)
create extension if not exists pg_trgm;

-- Main table
create table if not exists public.politicians (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  party text,
  state text,
  current_office text,
  bio text,
  career_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Full-text search column, generated from name + office + state + party
alter table public.politicians
  add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' ||
      coalesce(current_office, '') || ' ' ||
      coalesce(state, '') || ' ' ||
      coalesce(party, '')
    )
  ) stored;

-- Indexes to keep search fast
create index if not exists politicians_search_idx
  on public.politicians using gin (search_tsv);

create index if not exists politicians_name_trgm_idx
  on public.politicians using gin (name gin_trgm_ops);

-- Row Level Security: allow the public to READ, but not write.
-- Writes go through the server using the service_role key, which bypasses RLS.
alter table public.politicians enable row level security;

drop policy if exists "Public read access" on public.politicians;
create policy "Public read access"
  on public.politicians
  for select
  to anon, authenticated
  using (true);

-- Sample data ------------------------------------------------------------
insert into public.politicians (slug, name, party, state, current_office, bio, career_history)
values
  (
    'jane-doe',
    'Jane Doe',
    'Independent',
    'MA',
    'U.S. Senator',
    'Jane Doe has served Massachusetts for over two decades across local, state, and federal office.',
    '[
      {"period": "2001-2005", "role": "City Councilor, Boston"},
      {"period": "2005-2013", "role": "State Representative"},
      {"period": "2013-present", "role": "U.S. Senator"}
    ]'::jsonb
  ),
  (
    'john-smith',
    'John Smith',
    'Democratic',
    'MA',
    'Governor',
    'John Smith rose from municipal government to the governor''s office.',
    '[
      {"period": "1998-2006", "role": "Mayor of Springfield"},
      {"period": "2006-2014", "role": "State Senator"},
      {"period": "2014-present", "role": "Governor"}
    ]'::jsonb
  ),
  (
    'maria-garcia',
    'Maria Garcia',
    'Republican',
    'MA',
    'U.S. Representative',
    'Maria Garcia is a former prosecutor now serving in the U.S. House.',
    '[
      {"period": "2008-2016", "role": "District Attorney"},
      {"period": "2016-present", "role": "U.S. Representative"}
    ]'::jsonb
  )
on conflict (slug) do nothing;

-- Articles -------------------------------------------------------------
-- Political news headlines ingested from RSS feeds (see lib/ingest.ts).
-- We store only headline + URL + short snippet + date — never full text.
create table if not exists public.articles (
  id           bigint generated always as identity primary key,
  url          text unique not null,   -- unique: lets us upsert and skip duplicates
  title        text not null,
  snippet      text,
  source       text,
  published_at text,
  created_at   timestamptz not null default now()
);

-- Keep the newest-first listing fast.
create index if not exists articles_created_at_idx
  on public.articles (created_at desc);

-- Row Level Security: public can READ, writes go through the
-- service_role key (which bypasses RLS) from lib/ingest.ts.
alter table public.articles enable row level security;

drop policy if exists "Public read access" on public.articles;
create policy "Public read access"
  on public.articles
  for select
  to anon, authenticated
  using (true);

-- Article ↔ politician links -------------------------------------------
-- Which articles mention which politicians (filled by lib/summarize.ts).
create table if not exists public.article_politicians (
  article_id    bigint not null references public.articles(id) on delete cascade,
  politician_id uuid   not null references public.politicians(id) on delete cascade,
  primary key (article_id, politician_id)
);

alter table public.article_politicians enable row level security;

drop policy if exists "Public read access" on public.article_politicians;
create policy "Public read access"
  on public.article_politicians
  for select
  to anon, authenticated
  using (true);

-- Per-politician news summaries ------------------------------------------
-- An AI-generated, cited summary of recent coverage. We store only the
-- summary and citation metadata, never the full article text.
create table if not exists public.politician_news_summaries (
  politician_id uuid primary key references public.politicians(id) on delete cascade,
  summary       text not null,                  -- contains [n] citation markers
  citations     jsonb not null default '[]'::jsonb, -- [{n, title, url, source, published_at}]
  article_count int not null default 0,
  model         text,
  generated_at  timestamptz not null default now()
);

alter table public.politician_news_summaries enable row level security;

drop policy if exists "Public read access" on public.politician_news_summaries;
create policy "Public read access"
  on public.politician_news_summaries
  for select
  to anon, authenticated
  using (true);

-- ════════════════════════════════════════════════════════════════════
-- USER-REPORTED LIVE EVENTS (protests, rallies, town halls, etc.)
-- ════════════════════════════════════════════════════════════════════
-- Signed-in users drop a pin on the Massachusetts map to report a live
-- civic event. Everyone can read; only authenticated users can create,
-- and users can only edit/delete their own reports (enforced by RLS).

create table if not exists public.map_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null default 'protest'
              check (type in ('protest','rally','town-hall','march','vigil','community-meeting','other')),
  title       text not null,
  description text,
  -- Latitude / longitude of the pin. Constrained to the Massachusetts
  -- bounding box so reports stay in-region.
  lat         double precision not null check (lat between 41.1 and 42.95),
  lng         double precision not null check (lng between -73.6 and -69.8),
  -- When the event is happening (user-provided). Null = happening now / ongoing.
  event_time  timestamptz,
  status      text not null default 'active'
              check (status in ('active','ended','cancelled')),
  created_at  timestamptz not null default now()
);

create index if not exists map_events_created_at_idx
  on public.map_events (created_at desc);

create index if not exists map_events_user_idx
  on public.map_events (user_id);

alter table public.map_events enable row level security;

-- Anyone (even logged out) can read events — this is a public civic map.
drop policy if exists "Public read events" on public.map_events;
create policy "Public read events"
  on public.map_events
  for select
  to anon, authenticated
  using (true);

-- Only signed-in users can create events, and only as themselves.
drop policy if exists "Authenticated users can report events" on public.map_events;
create policy "Authenticated users can report events"
  on public.map_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update only their own events.
drop policy if exists "Users update own events" on public.map_events;
create policy "Users update own events"
  on public.map_events
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete only their own events.
drop policy if exists "Users delete own events" on public.map_events;
create policy "Users delete own events"
  on public.map_events
  for delete
  to authenticated
  using (auth.uid() = user_id);
