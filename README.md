# Goal-to-Grid

A planning and execution system that connects life goals to a daily calendar.

---

## What Problem It Solves

Most to-do apps and calendars treat tasks as flat, disconnected items. Goal-to-Grid enforces a deliberate hierarchy:

**Household → Sector (life domain) → Goal → Task → Schedule Item → (optional Google Calendar)**

Every scheduled item traces back to a goal and a life area. This makes it possible to see not just *what* is on the calendar, but *why*.

---

## Main Features

- **Authentication** — Email and password registration and login via Supabase Auth, with password recovery.
- **Household workspace** — All data is scoped to a household. The schema supports multiple members; the current UI is focused on individual planning within that context.
- **Sector and goal management** — Define life-area sectors (e.g. Career, Health) and create goals with start/end dates and priority levels.
- **Task management** — Break goals into tasks with an estimated duration in minutes, priority, and an optional recurrence rule.
- **Plan view** — A single hierarchical page showing all sectors → goals → tasks.
- **Schedule page** — A weekly calendar grid. Drag tasks from the backlog onto the calendar to schedule them.
- **Scheduling engine** — Suggests available time slots for tasks at 15-minute granularity, respecting user constraints and existing schedule items. Missed items can be auto-rescheduled.
- **User constraints** — Define availability blocks (e.g. evenings, specific days) that the scheduling engine avoids.
- **Google Calendar integration** — Connect a Google account to create and manage Goal-to-Grid events in Google Calendar, and import external events as busy blocks for scheduling context.
- **Dashboard** — Live overview of domain effort, upcoming schedule items, open backlog, and weekly completion stats.
- **Architecture / ERD page** — Hand-crafted SVG Chen diagram and Mermaid ER diagram of the full database schema, with live entity counts for authenticated users.
- **Admin panel** — View and manage user roles.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| Language | TypeScript 5 |
| UI | React 19.2.4, Tailwind CSS v4, Radix UI |
| Icons | Lucide React |
| Drag and drop | @dnd-kit/core |
| Diagram rendering | Mermaid 11 |
| Date utilities | date-fns 4 |
| Database | Supabase (PostgreSQL with RLS) |
| Authentication | Supabase Auth |
| External API | Google Calendar API v3 (OAuth 2.0) |
| Token security | AES-256-GCM (Node.js crypto) |
| Fonts | Geist (via next/font) |

---

## Local Setup

### Prerequisites

- Node.js 20 or later
- A Supabase project (cloud or local)
- A Google Cloud project with OAuth 2.0 credentials configured (required only for Google Calendar features)

### Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd goal-to-grid
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   The project requires a local `.env.local` file for private Supabase and Google Calendar configuration. This file is not committed to Git. The same required configuration must be set in the deployment provider.

   Create `.env.local` in the project root and fill in the values for your Supabase project and Google Cloud OAuth credentials.

   Required variable names:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   NEXT_PUBLIC_APP_URL=
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REDIRECT_URI=
   GOOGLE_TOKEN_ENCRYPTION_KEY=
   ```

   Do not commit `.env.local` or any real secret values to GitHub.

4. **Apply database migrations**

   In your Supabase project, run the migration files in order from `supabase/migrations/`:
   - `001_core_tables.sql`
   - `002_scheduling.sql`
   - `003_calendar_integration.sql`
   - `004_behavior_events.sql`
   - `005_external_events_metadata.sql`
   - `006_constraint_recurrence.sql`
   - `007_calendar_sync_permissions.sql`

5. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

6. **Build for production (optional)**

   ```bash
   npm run build
   ```

---

## Data Sources and APIs

| Source | Role |
|---|---|
| **Supabase PostgreSQL** | Primary data store for all application data |
| **Supabase Auth** | User registration, login, session management, password recovery |
| **Google Calendar API v3** | OAuth 2.0 integration for creating/managing events and importing external calendar events |

The application exposes internal REST API routes under `/api/` covering CRUD operations for all entities, the scheduling engine, Google Calendar integration, dashboard aggregation, and admin functions.

---

## Known Limitations

- **Google Calendar setup** — The Google Calendar integration requires a configured Google Cloud OAuth app. During development, using the app in "Testing" mode in Google Cloud Console is sufficient for personal use, but publishing requires domain verification.
- **Scheduling granularity** — The scheduling engine works at 15-minute slot increments.
- **Household collaboration** — The database schema and workspace model support multiple members per household, but the current UI is primarily focused on individual planning. Shared features are limited to privacy-preserving busy blocks visible on the schedule page.
- **No autonomous scheduling** — The engine suggests slots and can auto-reschedule missed items, but the user must approve all scheduling decisions. There is no AI-driven automatic planning.
- **Behavior events** — The append-only behavior event log (recording actions like scheduling, moving, and deleting tasks) is fully implemented at the data layer but has no UI or analytics dashboard yet.

---

## Documentation

- [PRD.md](PRD.md) — Product Requirements Document
- [tasks.md](tasks.md) — Work plan derived from the PRD
