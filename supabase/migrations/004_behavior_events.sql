-- ============================================================
-- 004_behavior_events.sql
-- Lightweight learning log: records every scheduling decision
-- the user makes (schedule, move, delete, suggestion accepted).
-- Append-only — no UPDATE or DELETE policies by design.
-- Intended for future personalization / ML recommendations.
-- Depends on: 001_core_tables.sql, 002_scheduling.sql
-- ============================================================


-- ── TABLE ───────────────────────────────────────────────────

create table user_behavior_events (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references profiles(id) on delete cascade,
  event_type       text        not null,  -- e.g. 'task_scheduled', 'task_moved', 'task_deleted'
  task_id          uuid        references tasks(id) on delete set null,
  goal_id          uuid        references goals(id) on delete set null,
  schedule_item_id uuid        references schedule_items(id) on delete set null,
  scheduled_start  timestamptz,
  scheduled_end    timestamptz,
  metadata         jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);


-- ── ROW-LEVEL SECURITY ──────────────────────────────────────

alter table user_behavior_events enable row level security;

create policy "users can view own behavior events"
  on user_behavior_events for select
  using (user_id = auth.uid());

create policy "users can insert own behavior events"
  on user_behavior_events for insert
  with check (user_id = auth.uid());


-- ── INDEXES ─────────────────────────────────────────────────

create index idx_behavior_user_created      on user_behavior_events(user_id, created_at desc);
create index idx_behavior_user_type_created on user_behavior_events(user_id, event_type, created_at desc);
