# Product Requirements Document — Goal-to-Grid

## 1. Product Goal and Problem Statement

Most personal productivity tools — to-do apps, notes apps, plain calendars — treat tasks as flat, disconnected items. There is no enforced relationship between a task and the broader goal it serves, or between a goal and the life area it belongs to. As a result, users end up with long backlogs that feel disconnected from what they actually care about, and calendars filled with items that have no visible purpose.

Goal-to-Grid is a planning and execution system that imposes a deliberate hierarchy on personal planning:

**Household → Domain/Sector → Goal → Task → Schedule Item → (optional Google Calendar)**

Every task in the system is explicitly linked to a goal. Every goal belongs to a life-area sector. When a task is placed on the calendar, it carries that context with it. This makes it possible to see not just *what* is scheduled, but *why*.

---

## 2. Target Users

The primary user is an individual who:
- Has goals spanning multiple life areas (career, health, learning, relationships, finance, etc.)
- Wants to track progress against those goals, not just maintain a to-do list
- Struggles to connect daily calendar activity to longer-term intentions
- Prefers a structured, explicit approach to planning

The database schema and workspace model support household context — multiple users can share the same workspace — but the current UI is primarily focused on individual planning within that context.

---

## 3. Main Use Case

1. User registers and creates a household workspace.
2. User defines sectors (life domains), e.g. "Career", "Health", "Education".
3. Under each sector, user creates goals with a name, start date, end date, and priority.
4. Under each goal, user creates tasks with a name, estimated duration (in minutes), and priority. Tasks may store an optional recurrence rule (iCalendar RRULE format) for future recurring-scheduling support.
5. User opens the Schedule page and places tasks on specific time slots — either by dragging from the backlog onto the calendar, or by asking the scheduling engine for slot suggestions.
6. The scheduling engine checks the user's availability constraints (defined on the Constraints page) and existing scheduled items to avoid conflicts.
7. Optionally, the user connects their Google Calendar account. Goal-to-Grid can then create and manage schedule-item events in Google Calendar, and import external Google Calendar events so that they appear as busy blocks during scheduling.
8. The Dashboard page aggregates progress across all sectors, shows upcoming schedule items, and highlights tasks that have been missed.
9. The Architecture page provides a full entity-relationship diagram and live entity counts, documenting the data model for review and maintenance.

---

## 4. Scope

### 4.1 Included

- **Authentication** — Email and password registration and login via Supabase Auth. Password recovery flow.
- **Household workspace** — Each user belongs to a household. All data (sectors, goals, tasks, schedule items) is scoped to that household.
- **Sector management** — Create, edit, and delete life-area sectors. Sectors act as the top-level organizational unit below the household.
- **Goal management** — Create goals linked to a sector. Goals have a name, optional description, start date, end date, priority (High / Medium / Low), and a completion flag.
- **Task management** — Create tasks linked to a goal. Tasks have a name, duration in minutes, priority, and an optional recurrence rule field for future recurring-task support. Tasks can be marked complete.
- **Plan view** — A hierarchical page showing all sectors, their goals, and the tasks under each goal in one place.
- **Schedule page** — A weekly calendar grid. Unscheduled tasks are shown in a backlog panel. Users can drag a task onto the calendar to schedule it, or open a scheduling dialog.
- **Drag-and-drop scheduling** — Powered by @dnd-kit. Schedule items can be placed on any time slot. Optimistic updates with rollback on failure.
- **Scheduling engine** — A server-side algorithm that finds available time slots for tasks, sorted by priority and goal deadline, at 15-minute granularity. Returns up to three slot suggestions per task.
- **Auto-reschedule** — When triggered, overdue `Pending` items are marked `Missed` and the engine attempts to reschedule them within the next 7 days.
- **Schedule item statuses** — Each schedule item has a status: `Pending`, `Done`, or `Missed`.
- **User constraints** — Users define availability blocks (times when they are unavailable). Constraints support multi-day recurrence (e.g. Monday + Wednesday). The scheduling engine respects these when suggesting slots.
- **Privacy-preserving busy blocks** — Household members can see each other's busy time windows (for shared scheduling awareness), but task names and constraint labels are hidden.
- **Google Calendar integration** — Users can connect a Google account via OAuth 2.0. Once connected:
  - Goal-to-Grid can create, update, and delete its own events in the user's Google Calendar.
  - External Google Calendar events can be imported and stored locally to serve as busy blocks during scheduling.
  - The connection can be removed, which deletes the stored local Google Calendar connection.
- **Architecture page** — An authenticated internal documentation page at `/admin/architecture` that shows:
  - A hand-crafted SVG Chen entity-relationship diagram of the database schema.
  - A Mermaid-rendered ER diagram.
  - Live counts of entities (sectors, goals, tasks, schedule items, etc.) via a dedicated API endpoint.
- **Admin panel** — Admins can view all users and change their roles (`admin` / `member`).
- **Behavior event log** — User actions (scheduling, moving, deleting items) are recorded in an append-only log table. This is a foundation for future analytics and has no current UI.
- **Dashboard** — Aggregated view showing domain effort breakdown, upcoming schedule items, open backlog tasks, missed items, and weekly completion stats. Data updates in real time via Supabase Realtime.

### 4.2 Out of Scope

- Mobile app or native clients of any kind.
- Fully autonomous AI scheduling. The system may suggest time slots, but the user remains responsible for approving all scheduling decisions.
- Any AI-generated content (goal suggestions, task generation, etc.).
- Billing, subscriptions, or payment flows.
- Push notifications or email reminders.
- Third-party calendar providers other than Google Calendar.
- Full multi-member household collaboration UI (the schema supports it; the current UI does not expose it beyond shared busy blocks).
- Public API, webhooks, or integrations with external productivity tools.

---

## 5. Functional Requirements / User Stories

| # | User Story |
|---|---|
| 1 | As a new user, I can register with my email and password and be guided through creating a household workspace before reaching the app. |
| 2 | As a returning user, I can log in, recover my password via email, and access all my data immediately. |
| 3 | As a user, I can create, rename, and delete sectors (life domains) to organize my goals. |
| 4 | As a user, I can create a goal under a sector, set its start and end dates and priority, and mark it complete when done. |
| 5 | As a user, I can create tasks under a goal with an estimated duration in minutes and a priority level. I can optionally set a recurrence rule. |
| 6 | As a user, I can view all sectors, goals, and tasks in a single hierarchical Plan view. |
| 7 | As a user, I can drag an unscheduled task from the backlog panel onto the weekly calendar to schedule it at a specific time. |
| 8 | As a user, I can ask the scheduling engine for suggestions. It will propose up to three available time slots for a task, taking my constraints and existing schedule into account. |
| 9 | As a user, I can define availability constraints (e.g. "no work on Monday and Wednesday evenings from 7–10 PM") and the scheduling engine will avoid those windows. |
| 10 | As a user, I can trigger auto-reschedule to have overdue missed tasks automatically placed in the next available slot within the coming week. |
| 11 | As a user, I can connect my Google Calendar via OAuth. After connecting, I can push my Goal-to-Grid schedule items to Google Calendar, and import my external Google events to display as busy blocks. |
| 12 | As an authenticated user, I can view the Architecture page to understand the database entity-relationship diagram and live entity counts. As an admin, I can also manage user roles from the admin panel. |

---

## 6. Technical Choices

| Area | Choice | Reason |
|---|---|---|
| Framework | Next.js 16.2.6 (App Router) | Full-stack React framework; server components and API routes in one project |
| Language | TypeScript 5 (strict mode) | Type safety across shared domain types |
| UI | React 19.2.4 + Tailwind CSS v4 | Modern styling approach with utility classes |
| UI primitives | Radix UI (dialog, select, label, slot) | Accessible, unstyled primitives |
| Icons | Lucide React | Consistent icon set |
| Drag and drop | @dnd-kit/core 6.3 | Flexible, accessible drag-and-drop for the calendar grid |
| Diagram rendering | Mermaid 11 | Server-renderable ER and flow diagrams for the Architecture page |
| Date handling | date-fns 4 | Tree-shakeable date arithmetic |
| Database | Supabase (PostgreSQL) | Managed Postgres with Row-Level Security built in |
| Authentication | Supabase Auth | Integrated with the database; handles sessions via cookies (SSR-safe) |
| Supabase client | @supabase/ssr 0.10 | Cookie-based session management for Next.js App Router |
| Token security | Node.js `crypto` (AES-256-GCM) | Google OAuth tokens are encrypted at the application layer before storage |
| Fonts | Geist (via `next/font`) | Clean, neutral sans-serif; self-hosted |

---

## 7. Data Model

### Core Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `households` | Workspace container | `id`, `name` |
| `profiles` | User profile, linked 1-to-1 with auth.users | `id`, `household_id`, `display_name`, `role` |
| `sectors` | Life-area domains | `id`, `household_id`, `name` |
| `priority_levels` | Lookup: 1=High, 2=Medium, 3=Low | `id`, `label` |
| `goals` | Goals under a sector | `id`, `sector_id`, `name`, `start_date`, `end_date`, `priority`, `is_completed` |
| `tasks` | Tasks under a goal | `id`, `goal_id`, `name`, `duration_min`, `priority`, `is_recurring`, `recurrence_rule`, `is_completed` |
| `user_constraints` | Availability blocks | `id`, `user_id`, `label`, `recurrence_days` (int[]), `start_time`, `end_time` |
| `schedule_items` | Tasks placed on the calendar | `id`, `task_id`, `scheduled_by`, `scheduled_start`, `scheduled_end`, `status`, `google_event_id` |
| `calendar_connections` | Google OAuth tokens (encrypted) | `id`, `user_id`, `provider`, `access_token_encrypted`, `refresh_token_encrypted`, `expires_at` |
| `external_calendar_events` | Events imported from Google Calendar | `id`, `user_id`, `google_event_id`, `title`, `starts_at`, `ends_at`, `is_busy`, `metadata` |
| `user_behavior_events` | Append-only action log | `id`, `user_id`, `event_type`, `task_id`, `goal_id`, `schedule_item_id`, `metadata` |

### Views

| View | Purpose |
|---|---|
| `household_busy_blocks` | Cross-user time windows; hides task names for privacy |
| `household_availability_windows` | Cross-user constraint windows; hides constraint labels |

### Hierarchy

```
households
  └── profiles (users)
  └── sectors
        └── goals
              └── tasks
                    └── schedule_items
                          └── (google_event_id → Google Calendar)
```

### Row-Level Security

All tables have RLS enabled. Users access only data within their household. The `schedule_items` and `user_constraints` tables are restricted to the owning user. The admin Supabase client (using the service role key) bypasses RLS for scheduling operations that need cross-user data.

---

## 8. APIs and Data Sources

| Source | Role |
|---|---|
| **Supabase PostgreSQL** | Primary data store; all application data lives here |
| **Supabase Auth** | User registration, login, session management, password recovery |
| **Google Calendar API v3** | OAuth 2.0 integration; scopes: `calendar.events` (read/write) and `calendar.readonly` (list calendars) |

### Internal API Routes

The application exposes REST-style internal API routes under `/api/`:

- **CRUD:** `/api/sectors`, `/api/goals`, `/api/tasks`, `/api/schedule`, `/api/constraints` (each with `[id]` sub-routes for GET/PATCH/DELETE)
- **Scheduling:** `/api/schedule/suggestions`, `/api/schedule/reschedule`
- **Google Calendar:** `/api/calendar/connect`, `/api/calendar/callback`, `/api/calendar/status`, `/api/calendar/disconnect`, `/api/calendar/import`, `/api/calendar/sync`, `/api/calendar/external-events`
- **Dashboard:** `/api/dashboard`
- **Admin:** `/api/admin/architecture/counts`, `/api/admin/users/[id]`
- **Behavior:** `/api/behavior-events`
- **Onboarding:** `/api/setup-household`, `/api/household`

---

## 9. Definition of Done

The project is considered complete when:

- [x] All CRUD flows (sectors, goals, tasks, constraints, schedule items) work end-to-end.
- [x] The scheduling engine proposes constraint-aware slots and auto-reschedule runs correctly.
- [x] Google Calendar connection works for a real Google account, including event push for Goal-to-Grid-managed schedule items and import of external events as busy blocks.
- [x] The Architecture page renders the ERD diagrams and live entity counts.
- [x] All app pages require authentication and are scoped to the user's household.
- [x] All migrations have been applied and RLS policies are enforced.
- [x] The application builds without TypeScript or lint errors (`npm run build`).
- [x] The project is committed to Git with meaningful history.
- [ ] Course documentation files (PRD.md, tasks.md, README.md) are complete and accurate.
