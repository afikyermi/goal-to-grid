-- ============================================================
-- 003_calendar_integration.sql
-- Google Calendar OAuth connections and external event sync.
-- Tokens are stored AES-256-GCM encrypted (see lib/google/calendar.ts).
-- Depends on: 001_core_tables.sql
-- ============================================================


-- ── TABLES ──────────────────────────────────────────────────

-- Stores the OAuth connection per user per calendar provider.
-- Tokens are encrypted at the application layer before being stored here.
create table calendar_connections (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references profiles(id) on delete cascade,
  provider                text        not null default 'google',
  calendar_id             text        not null default 'primary',
  access_token_encrypted  text,
  refresh_token_encrypted text,
  expires_at              timestamptz,
  updated_at              timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  unique (user_id, provider, calendar_id)
);

-- External events fetched from the user's Google Calendar.
-- Used by the scheduling engine to avoid double-booking.
create table external_calendar_events (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  provider        text        not null default 'google',
  calendar_id     text        not null default 'primary',
  google_event_id text        not null,
  title           text        not null default '',
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  is_busy         boolean     not null default true,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_id, google_event_id)
);


-- ── ROW-LEVEL SECURITY ──────────────────────────────────────

alter table calendar_connections     enable row level security;
alter table external_calendar_events enable row level security;

-- calendar_connections
create policy "users can view own calendar connections"
  on calendar_connections for select
  using (user_id = auth.uid());

create policy "users can create calendar connections"
  on calendar_connections for insert
  with check (user_id = auth.uid());

create policy "users can update own calendar connections"
  on calendar_connections for update
  using (user_id = auth.uid());

create policy "users can delete own calendar connections"
  on calendar_connections for delete
  using (user_id = auth.uid());

-- external_calendar_events
create policy "users can view own external events"
  on external_calendar_events for select
  using (user_id = auth.uid());

create policy "users can create external events"
  on external_calendar_events for insert
  with check (user_id = auth.uid());

create policy "users can update own external events"
  on external_calendar_events for update
  using (user_id = auth.uid());

create policy "users can delete own external events"
  on external_calendar_events for delete
  using (user_id = auth.uid());


-- ── INDEXES ─────────────────────────────────────────────────

create index idx_ext_cal_user_time on external_calendar_events(user_id, starts_at, ends_at);
