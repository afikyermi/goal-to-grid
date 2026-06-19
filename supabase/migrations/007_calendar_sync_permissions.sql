-- ============================================================
-- 007_calendar_sync_permissions.sql
-- Grants required by user-scoped Google Calendar sync queries.
-- RLS policies still restrict rows to the authenticated user's data.
-- ============================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete
on table public.schedule_items
to authenticated;

grant select
on table public.tasks
to authenticated;

grant select
on table public.goals
to authenticated;

grant select
on table public.sectors
to authenticated;
