-- ============================================================
-- 001_core_tables.sql
-- Core domain model: users, life domains, goals, tasks,
-- availability constraints. Foundation for the entire app.
-- ============================================================


-- ── TABLES ──────────────────────────────────────────────────

create table households (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

-- profiles mirrors auth.users (1-to-1)
create table profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  household_id uuid        references households(id) on delete set null,
  display_name text,
  role         text        not null default 'member' check (role in ('admin', 'member')),
  created_at   timestamptz not null default now()
);

-- sectors = life domains (no planning dates, no quarter column)
create table sectors (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references households(id) on delete cascade,
  name         text        not null,
  created_at   timestamptz not null default now()
);

-- priority lookup table (1=High, 2=Medium, 3=Low)
create table priority_levels (
  id    int  primary key,
  label text not null
);
insert into priority_levels values (1, 'High'), (2, 'Medium'), (3, 'Low');

create table goals (
  id           uuid        primary key default gen_random_uuid(),
  sector_id    uuid        not null references sectors(id) on delete cascade,
  name         text        not null,
  description  text,
  start_date   date        not null,
  end_date     date        not null,
  -- deadline kept for API backward-compat; equals end_date on new rows
  deadline     date,
  priority     int         not null default 2 references priority_levels(id),
  is_completed boolean     not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint goals_date_window_check check (start_date <= end_date)
);

create table tasks (
  id              uuid        primary key default gen_random_uuid(),
  goal_id         uuid        not null references goals(id) on delete cascade,
  name            text        not null,
  duration_min    int         not null check (duration_min > 0),
  priority        int         not null default 2 references priority_levels(id),
  is_completed    boolean     not null default false,
  is_recurring    boolean     not null default false,
  recurrence_rule text,
  created_at      timestamptz not null default now()
);

create table user_constraints (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  label       text        not null,
  day_of_week int         check (day_of_week between 0 and 6), -- null = every day
  start_time  time        not null,
  end_time    time        not null,
  created_at  timestamptz not null default now()
);


-- ── FUNCTIONS & TRIGGERS ────────────────────────────────────

-- Returns the current user's household_id without triggering RLS on profiles.
create or replace function get_my_household_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select household_id from profiles where id = auth.uid()
$$;

-- Returns true if the current user has the admin role.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role = 'admin' from profiles where id = auth.uid()),
    false
  )
$$;

-- Creates a skeleton profile row when a new auth user is registered.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ── ROW-LEVEL SECURITY ──────────────────────────────────────

alter table households      enable row level security;
alter table profiles        enable row level security;
alter table sectors         enable row level security;
alter table priority_levels enable row level security;
alter table goals           enable row level security;
alter table tasks           enable row level security;
alter table user_constraints enable row level security;

-- households
create policy "household members can view their household"
  on households for select
  using (id = get_my_household_id());

create policy "authenticated users can create households"
  on households for insert
  with check (auth.uid() is not null);

create policy "admins can update households"
  on households for update
  using (is_admin());

-- profiles
create policy "users can view profiles in their household"
  on profiles for select
  using (
    id = auth.uid()
    or household_id = get_my_household_id()
  );

create policy "users can insert own profile"
  on profiles for insert
  with check (id = auth.uid());

create policy "users can update own profile"
  on profiles for update
  using (id = auth.uid());

create policy "admins can update any profile"
  on profiles for update
  using (is_admin());

-- sectors
create policy "household members can view sectors"
  on sectors for select
  using (household_id = get_my_household_id());

create policy "household members can create sectors"
  on sectors for insert
  with check (household_id = get_my_household_id());

create policy "household members can update sectors"
  on sectors for update
  using (household_id = get_my_household_id());

create policy "admins can delete sectors"
  on sectors for delete
  using (is_admin());

-- priority_levels (public read-only)
create policy "priority levels are publicly readable"
  on priority_levels for select
  using (true);

-- goals (scoped to household via sectors)
create policy "household members can view goals"
  on goals for select
  using (
    exists (
      select 1 from sectors s
      where s.id = goals.sector_id
        and s.household_id = get_my_household_id()
    )
  );

create policy "household members can create goals"
  on goals for insert
  with check (
    exists (
      select 1 from sectors s
      where s.id = goals.sector_id
        and s.household_id = get_my_household_id()
    )
  );

create policy "household members can update goals"
  on goals for update
  using (
    exists (
      select 1 from sectors s
      where s.id = goals.sector_id
        and s.household_id = get_my_household_id()
    )
  );

create policy "household members can delete goals"
  on goals for delete
  using (
    exists (
      select 1 from sectors s
      where s.id = goals.sector_id
        and s.household_id = get_my_household_id()
    )
  );

-- tasks (scoped to household via goals → sectors)
create policy "household members can view tasks"
  on tasks for select
  using (
    exists (
      select 1 from goals g
      join sectors s on s.id = g.sector_id
      where g.id = tasks.goal_id
        and s.household_id = get_my_household_id()
    )
  );

create policy "household members can create tasks"
  on tasks for insert
  with check (
    exists (
      select 1 from goals g
      join sectors s on s.id = g.sector_id
      where g.id = tasks.goal_id
        and s.household_id = get_my_household_id()
    )
  );

create policy "household members can update tasks"
  on tasks for update
  using (
    exists (
      select 1 from goals g
      join sectors s on s.id = g.sector_id
      where g.id = tasks.goal_id
        and s.household_id = get_my_household_id()
    )
  );

create policy "household members can delete tasks"
  on tasks for delete
  using (
    exists (
      select 1 from goals g
      join sectors s on s.id = g.sector_id
      where g.id = tasks.goal_id
        and s.household_id = get_my_household_id()
    )
  );

-- user_constraints (own only; admin client reads household-wide)
create policy "users can view own constraints"
  on user_constraints for select
  using (user_id = auth.uid());

create policy "users can create own constraints"
  on user_constraints for insert
  with check (user_id = auth.uid());

create policy "users can update own constraints"
  on user_constraints for update
  using (user_id = auth.uid());

create policy "users can delete own constraints"
  on user_constraints for delete
  using (user_id = auth.uid());


-- ── INDEXES ─────────────────────────────────────────────────

create index idx_profiles_household     on profiles(household_id);
create index idx_sectors_household_name on sectors(household_id, name);
create index idx_goals_sector_window    on goals(sector_id, end_date, priority);
create index idx_tasks_goal_completed   on tasks(goal_id, is_completed);
create index idx_constraints_user       on user_constraints(user_id);
