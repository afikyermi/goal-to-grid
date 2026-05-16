-- ============================================================
-- 002_scheduling.sql
-- Scheduling engine: calendar placements and privacy-preserving
-- household views for cross-user availability checks.
-- Depends on: 001_core_tables.sql
-- ============================================================


-- ── TABLE ───────────────────────────────────────────────────

create table schedule_items (
  id              uuid        primary key default gen_random_uuid(),
  task_id         uuid        not null references tasks(id) on delete cascade,
  scheduled_by    uuid        references profiles(id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end   timestamptz not null,
  status          text        not null default 'Pending' check (status in ('Pending', 'Done', 'Missed')),
  google_event_id text,
  created_at      timestamptz not null default now()
);


-- ── VIEWS (privacy-preserving cross-user scheduling) ────────

-- Exposes only occupied time windows — no task/goal content visible to household members.
create or replace view household_busy_blocks as
select
  p.household_id,
  si.scheduled_by as user_id,
  si.scheduled_start,
  si.scheduled_end,
  si.status
from schedule_items si
join profiles p on p.id = si.scheduled_by
where si.status in ('Pending', 'Done');

-- Exposes only blocked time windows — constraint labels are not shared with household members.
create or replace view household_availability_windows as
select
  p.household_id,
  uc.user_id,
  uc.day_of_week,
  uc.start_time,
  uc.end_time
from user_constraints uc
join profiles p on p.id = uc.user_id;


-- ── ROW-LEVEL SECURITY ──────────────────────────────────────

alter table schedule_items enable row level security;

create policy "users can view own schedule items"
  on schedule_items for select
  using (scheduled_by = auth.uid());

create policy "users can create schedule items"
  on schedule_items for insert
  with check (scheduled_by = auth.uid());

create policy "users can update own schedule items"
  on schedule_items for update
  using (scheduled_by = auth.uid());

create policy "users can delete own schedule items"
  on schedule_items for delete
  using (scheduled_by = auth.uid());


-- ── INDEXES ─────────────────────────────────────────────────

create index idx_schedule_status_start  on schedule_items(status, scheduled_start);
create index idx_schedule_task          on schedule_items(task_id);
create index idx_schedule_scheduled_by  on schedule_items(scheduled_by);
