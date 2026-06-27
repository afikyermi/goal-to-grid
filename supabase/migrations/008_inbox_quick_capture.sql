-- ============================================================
-- 008_inbox_quick_capture.sql
-- Allows quick-capture inbox tasks that are not tied to a goal.
-- Planned tasks still require a goal; inbox tasks can be organized later.
-- ============================================================

alter table public.tasks
  add column if not exists household_id uuid references public.households(id) on delete cascade,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists task_type text not null default 'planned',
  add column if not exists inbox_status text not null default 'active',
  add column if not exists captured_at timestamptz not null default now();

update public.tasks t
set household_id = s.household_id
from public.goals g
join public.sectors s on s.id = g.sector_id
where t.goal_id = g.id
  and t.household_id is null;

update public.tasks
set task_type = 'planned'
where goal_id is not null
  and task_type is null;

update public.tasks
set inbox_status = 'assigned'
where goal_id is not null
  and task_type = 'planned';

alter table public.tasks
  alter column goal_id drop not null,
  alter column household_id set not null;

alter table public.tasks
  drop constraint if exists tasks_task_type_check,
  add constraint tasks_task_type_check check (task_type in ('planned', 'inbox'));

alter table public.tasks
  drop constraint if exists tasks_inbox_status_check,
  add constraint tasks_inbox_status_check check (inbox_status in ('active', 'assigned', 'done'));

alter table public.tasks
  drop constraint if exists tasks_planned_goal_check,
  add constraint tasks_planned_goal_check check (
    (task_type = 'planned' and goal_id is not null)
    or task_type = 'inbox'
  );

drop policy if exists "household members can view tasks" on public.tasks;
drop policy if exists "household members can create tasks" on public.tasks;
drop policy if exists "household members can update tasks" on public.tasks;
drop policy if exists "household members can delete tasks" on public.tasks;

create policy "household members can view tasks"
  on public.tasks for select
  using (household_id = get_my_household_id());

create policy "household members can create tasks"
  on public.tasks for insert
  with check (household_id = get_my_household_id());

create policy "household members can update tasks"
  on public.tasks for update
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

create policy "household members can delete tasks"
  on public.tasks for delete
  using (household_id = get_my_household_id());

create index if not exists idx_tasks_household_type
  on public.tasks(household_id, task_type, inbox_status, is_completed);

create index if not exists idx_tasks_created_by
  on public.tasks(created_by);

grant select, insert, update, delete
on table public.tasks
to authenticated;
