# Work Plan — Goal-to-Grid

This document tracks the development stages and individual tasks for the Goal-to-Grid project. Tasks are ordered in the sequence they were realistically built. Completed tasks are marked with `[x]`.

---

## Stage 1 — Project Setup

- [x] Initialize Next.js 16 project with TypeScript and Tailwind CSS v4
- [x] Configure ESLint 9 with Next.js rules
- [x] Configure `tsconfig.json` with path alias `@/*` pointing to project root
- [x] Set up Supabase project (cloud instance) and record environment variables
- [x] Install and configure Supabase SSR client: browser, server, and admin variants
- [x] Configure Next.js security headers in `next.config.ts` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy)

---

## Stage 2 — Supabase Schema and RLS

- [x] Write migration 001: create `households`, `profiles`, `sectors`, `priority_levels`, `goals`, `tasks`, and `user_constraints` tables with appropriate column types and constraints
- [x] Add Row-Level Security (RLS) policies to all tables: household-scoped access for sectors/goals/tasks; user-scoped access for constraints
- [x] Add helper functions: `get_my_household_id()` (security definer), `is_admin()`, and `handle_new_user()` trigger to create a skeleton profile on signup
- [x] Write migration 002: create `schedule_items` table with `status` enum (`Pending`, `Done`, `Missed`) and `google_event_id` column; create privacy-preserving views `household_busy_blocks` and `household_availability_windows`
- [x] Write migration 003: create `calendar_connections` table (encrypted OAuth tokens) and `external_calendar_events` table
- [x] Write migration 004: create `user_behavior_events` table with append-only RLS (INSERT + SELECT, no UPDATE or DELETE)
- [x] Write migration 005: add `metadata` jsonb column to `external_calendar_events`
- [x] Write migration 006: add `recurrence_days` int[] column to `user_constraints`; migrate legacy `day_of_week` values to the new array format
- [x] Write migration 007: GRANT required permissions to the `authenticated` role on the public schema
- [x] Add performance indexes: `household_id` on profiles and sectors; `(sector_id, end_date, priority)` on goals; `(goal_id, is_completed)` on tasks; `(status, scheduled_start)` and `task_id` on schedule_items; `(user_id, starts_at, ends_at)` on external_calendar_events; `(user_id, created_at DESC)` on behavior events

---

## Stage 3 — Authentication and Onboarding

- [x] Build `/login` page: email and password form using Supabase Auth `signInWithPassword`
- [x] Build `/register` page: account creation form; creates auth user and triggers household setup
- [x] Build `/forgot-password` page: send password reset email via Supabase Auth
- [x] Build `/reset-password` page: confirm new password using the reset token from the email link
- [x] Build `/setup-household` page: post-signup page to name and initialize the household workspace
- [x] Implement Next.js middleware for route protection: unauthenticated users are redirected to `/login`
- [x] Create `POST /api/setup-household` endpoint: creates or joins a household and links the profile

---

## Stage 4 — Sector, Goal, and Task Management

- [x] Create `lib/types.ts`: define all domain types (`Household`, `Profile`, `Sector`, `Goal`, `Task`, `UserConstraint`, `ScheduleItem`, etc.) and enriched join types (`TaskWithGoal`, `GoalWithSector`, `ScheduleItemWithTask`)
- [x] Create `lib/server/workspace.ts`: ownership-check helpers (`sectorBelongsToWorkspace`, `goalBelongsToWorkspace`, `taskBelongsToWorkspace`, `scheduleItemBelongsToUser`)
- [x] Build `/sectors` page: list, create, edit, and delete sectors; API routes `GET/POST /api/sectors` and `PATCH/DELETE /api/sectors/[id]`
- [x] Build `/goals` page: list goals grouped by sector; create, edit, and delete goals with sector assignment, dates, and priority; API routes `GET/POST /api/goals` and `PATCH/DELETE /api/goals/[id]`
- [x] Build `/tasks` page: list tasks grouped by goal; create, edit, and delete tasks with duration and priority fields; API routes `GET/POST /api/tasks` and `PATCH/DELETE /api/tasks/[id]`
- [x] Build `/plan` page: a single hierarchical view displaying all sectors → goals → tasks, with inline quick-actions

---

## Stage 5 — Schedule Page and Drag/Calendar Behavior

- [x] Build `/schedule` page: weekly calendar grid showing scheduled items by day and time
- [x] Add unscheduled task backlog panel to the Schedule page
- [x] Install `@dnd-kit/core` and implement drag-to-schedule: drag a task from the backlog panel onto a calendar time slot
- [x] Implement optimistic UI updates for scheduling actions with rollback on server error
- [x] Build scheduling engine `lib/engine/scheduler.ts`: sorts tasks by priority and goal deadline; finds available slots at 15-minute granularity within a search window
- [x] Build constraint evaluator `lib/engine/constraints.ts`: validates a proposed slot against user constraints (including multi-day recurrence) and existing schedule items and external events
- [x] Create `POST /api/schedule`: supports single task scheduling (`task_id`, `scheduled_start`, `scheduled_end`) and bulk engine-based scheduling (`task_ids[]`, `window_start`, `window_end`)
- [x] Create `GET /api/schedule`: fetch schedule items, optionally filtered by week start date
- [x] Create `PATCH /api/schedule/[id]` and `DELETE /api/schedule/[id]`: update or remove a schedule item
- [x] Create `POST /api/schedule/suggestions`: run the scheduling engine for a set of tasks and return up to three slot suggestions per task
- [x] Create `POST /api/schedule/reschedule`: mark all overdue `Pending` items as `Missed`; run the engine to reschedule them within the next 7 days; log a `missed_items_self_healed` behavior event

---

## Stage 6 — User Constraints

- [x] Build `/constraints` page: list, create, edit, and delete availability blocks
- [x] Support multi-day recurrence in constraint creation (select multiple days of the week via `recurrence_days` int[] field)
- [x] Create CRUD API: `GET/POST /api/constraints` and `PATCH/DELETE /api/constraints/[id]`
- [x] Integrate constraint evaluation into the scheduling engine slot validation

---

## Stage 7 — Google Calendar Connection and Sync

- [x] Register Google Cloud project; configure OAuth 2.0 credentials with the required scopes (`calendar.events`, `calendar.readonly`)
- [x] Implement `lib/google/calendar.ts`: OAuth authorization URL generation, authorization code exchange, token refresh, AES-256-GCM encryption and decryption for stored tokens
- [x] Create `GET /api/calendar/connect`: redirect the user to Google's OAuth authorization page
- [x] Create `GET /api/calendar/callback`: handle the OAuth callback; exchange code for tokens; encrypt and store in `calendar_connections`; CSRF nonce validation via HttpOnly cookie
- [x] Create `GET /api/calendar/status`: return connection status and whether encryption and OAuth config are correctly set
- [x] Create `POST /api/calendar/disconnect`: remove the stored local Google Calendar connection
- [x] Create `POST /api/calendar/import`: fetch events from the user's Google Calendar and store them in `external_calendar_events` for use as busy blocks
- [x] Create `POST /api/calendar/sync`: create, update, or delete Goal-to-Grid schedule items as events in the user's Google Calendar; track the mapping via `google_event_id` on `schedule_items`
- [x] Create `GET /api/calendar/external-events`: return synced external events for display on the schedule page
- [x] Add Google Calendar connection UI to the `/schedule` page (connect button, status indicator)

---

## Stage 8 — Dashboard

- [x] Create `GET /api/dashboard`: aggregate sectors with goal and task counts, upcoming scheduled items, missed item count, and weekly completion stats in a single query
- [x] Build `/dashboard` page with a `LiveDashboard` component: shows domain effort breakdown, next upcoming items, open backlog grouped by goal
- [x] Implement Supabase Realtime channel subscription in `LiveDashboard` for live updates without page refresh

---

## Stage 9 — Architecture / ERD Page

- [x] Build `/admin/architecture` page as an authenticated internal documentation route
- [x] Create `ChenERD.tsx`: hand-crafted SVG entity-relationship diagram using Chen notation, with manually positioned entities, attributes, and relationship connectors
- [x] Create `MermaidDiagram.tsx`: component that renders a Mermaid diagram string; used for an ER diagram of the full schema
- [x] Create `LiveArchitectureDashboard.tsx`: displays live entity counts fetched from the API; updates in real time
- [x] Create `GET /api/admin/architecture/counts`: query entity counts (households, profiles, sectors, goals, tasks, schedule items, external events, behavior events) and return them as JSON for the Architecture page

---

## Stage 10 — Admin Panel

- [x] Build `/admin/users` page: list all users with their display names, emails, roles, and household; allow an admin to promote or demote users
- [x] Create `PATCH /api/admin/users/[id]` endpoint: update a user's role; protected by `is_admin()` check
- [x] Add admin-only sidebar section visible only to users with `role === 'admin'`

---

## Stage 11 — UI/UX Improvements

- [x] Design and implement sidebar navigation with user display name, email, admin badge, admin section, and sign-out button
- [x] Install Radix UI primitives: dialog, select, label, slot
- [x] Build shared UI component library in `components/ui/`: `button`, `card`, `badge`, `input`, `select`, `table`, `dialog`, `textarea`, `label`
- [x] Apply consistent visual design: OKLCH color token system, depth and shadow layers, Geist font typography scale
- [x] Implement `lib/behavior/events.ts` and `POST /api/behavior-events`: log user scheduling actions (`task_scheduled`, `task_moved`, `task_deleted`, `missed_items_self_healed`)

---

## Stage 12 — Debugging and Initial Documentation

- [x] Debug and fix Google Calendar sync cleanup (handling stale `google_event_id` references and permission edge cases)
- [x] Fix TypeScript type assertion in calendar integration to prevent spread signature collapse
- [x] Resolve RLS edge cases that blocked cross-user household scheduling reads
- [x] Write initial `PRD.md`
- [x] Write initial `tasks.md`
- [x] Write initial `README.md`

---

## Stage 13 — Inbox / Quick Capture Product Extension

- [x] Write migration 008: extend `tasks` with `household_id`, `created_by`, `task_type`, `inbox_status`, and `captured_at`; make `goal_id` nullable for inbox tasks
- [x] Update task RLS and workspace ownership checks so tasks are scoped directly by household
- [x] Update task API routes to support planned tasks, inbox tasks, and task conversion from inbox to planned
- [x] Create Inbox API routes: `GET/POST /api/inbox` and `PATCH/DELETE /api/inbox/[id]`
- [x] Build `/inbox` page for quick add, place in calendar, assign to goal, mark done, and delete actions
- [x] Add Inbox navigation item to the sidebar
- [x] Update `/schedule` manual scheduling dialog to support existing tasks, new planned tasks, and new Inbox tasks from an empty calendar slot
- [x] Update scheduling suggestions so only planned tasks with goals are eligible for algorithmic recommendations
- [x] Update schedule display styling so Inbox tasks are visually distinct from planned tasks and Google Calendar events
- [x] Fix affected Plan/Tasks UI assumptions where task `goal_id` can now be nullable

---

## Stage 14 — Final Course Submission Documentation

- [x] Write `PRD.md`
- [x] Write `tasks.md`
- [x] Write `README.md`
