import MermaidDiagram from '@/components/MermaidDiagram'
import { LiveArchitectureDashboard } from '@/components/LiveArchitectureDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

const CONCEPT_FLOW = `
flowchart LR
    household["Household"]
    domain["Domain / Sector"]
    goal["Goal (start date + end date)"]
    task["Task (duration)"]
    suggestion["Scheduling recommendations"]
    schedule["Schedule item"]
    google["Google Calendar"]

    household --> domain
    domain --> goal
    goal --> task
    task --> suggestion
    suggestion --> schedule
    schedule --> google
`

const ERD = `
erDiagram
    HOUSEHOLDS {
        uuid id PK
        text name
        timestamptz created_at
    }
    PROFILES {
        uuid id PK
        uuid household_id FK
        text display_name
        text role
        timestamptz created_at
    }
    SECTORS {
        uuid id PK
        uuid household_id FK
        text name
        timestamptz created_at
    }
    GOALS {
        uuid id PK
        uuid sector_id FK
        text name
        text description
        date start_date
        date end_date
        int priority
        boolean is_completed
        timestamptz created_at
    }
    TASKS {
        uuid id PK
        uuid goal_id FK
        text name
        int duration_min
        int priority
        boolean is_completed
        boolean is_recurring
        text recurrence_rule
        timestamptz created_at
    }
    SCHEDULE_ITEMS {
        uuid id PK
        uuid task_id FK
        uuid scheduled_by FK
        timestamptz scheduled_start
        timestamptz scheduled_end
        text status
        text google_event_id
        timestamptz created_at
    }
    USER_CONSTRAINTS {
        uuid id PK
        uuid user_id FK
        text label
        int day_of_week
        time start_time
        time end_time
    }
    CALENDAR_CONNECTIONS {
        uuid id PK
        uuid user_id FK
        text provider
        text calendar_id
        timestamptz expires_at
    }
    EXTERNAL_CALENDAR_EVENTS {
        uuid id PK
        uuid user_id FK
        text provider
        text google_event_id
        text title
        timestamptz starts_at
        timestamptz ends_at
        boolean is_busy
    }
    USER_BEHAVIOR_EVENTS {
        uuid id PK
        uuid user_id FK
        text event_type
        uuid task_id FK
        uuid goal_id FK
        uuid schedule_item_id FK
        jsonb metadata
        timestamptz created_at
    }
    PRIORITY_LEVELS {
        int id PK
        text label
    }

    HOUSEHOLDS ||--o{ PROFILES : "has users"
    HOUSEHOLDS ||--o{ SECTORS : "owns domains"
    SECTORS ||--o{ GOALS : "contains"
    GOALS ||--o{ TASKS : "breaks into"
    TASKS ||--o{ SCHEDULE_ITEMS : "scheduled as"
    PROFILES ||--o{ USER_CONSTRAINTS : "defines"
    PROFILES ||--o{ SCHEDULE_ITEMS : "schedules"
    PROFILES ||--o{ CALENDAR_CONNECTIONS : "connects"
    PROFILES ||--o{ EXTERNAL_CALENDAR_EVENTS : "imports"
    PROFILES ||--o{ USER_BEHAVIOR_EVENTS : "generates"
    GOALS ||--o{ USER_BEHAVIOR_EVENTS : "context"
    TASKS ||--o{ USER_BEHAVIOR_EVENTS : "context"
    SCHEDULE_ITEMS ||--o{ USER_BEHAVIOR_EVENTS : "context"
    PRIORITY_LEVELS ||--o{ GOALS : "classifies"
    PRIORITY_LEVELS ||--o{ TASKS : "classifies"
`

const entities = [
  ['HOUSEHOLDS', 'Root collaboration boundary. Every user and domain belongs to a household.'],
  ['SECTORS / DOMAINS', 'The main planning headings: Personal, Studies, Career, Family. No dates or planning metadata live here.'],
  ['GOALS', 'Concrete outcomes under a domain. Every goal must have start_date and end_date.'],
  ['TASKS', 'Practical actions under a goal. Tasks inherit the goal window and have a duration in minutes.'],
  ['SCHEDULE_ITEMS', 'Calendar placements for tasks, including status and Google event mapping.'],
  ['USER_CONSTRAINTS', 'Blocked or unavailable time windows that recommendations must respect.'],
  ['USER_BEHAVIOR_EVENTS', 'Lightweight learning log for user actions and feedback.'],
]

const normalForms = [
  ['sectors', '3NF', 'id -> household_id, name. Domains intentionally have no quarter/date attributes.'],
  ['goals', '3NF', 'id -> sector_id, name, start_date, end_date, priority, is_completed.'],
  ['tasks', '3NF', 'id -> goal_id, name, duration_min, priority, recurrence data.'],
  ['schedule_items', '3NF', 'id -> task_id, scheduled_by, scheduled_start, scheduled_end, status, google_event_id.'],
  ['user_behavior_events', '3NF + flexible metadata', 'id -> user_id, event_type, optional context ids, metadata.'],
]

async function getCounts() {
  const supabase = await createClient()
  const [
    households,
    profiles,
    sectors,
    constraints,
    goals,
    priority,
    tasks,
    schedule,
    calendar,
    external,
    behavior,
  ] = await Promise.all([
    supabase.from('households').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('sectors').select('id', { count: 'exact', head: true }),
    supabase.from('user_constraints').select('id', { count: 'exact', head: true }),
    supabase.from('goals').select('id', { count: 'exact', head: true }),
    supabase.from('priority_levels').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }),
    supabase.from('schedule_items').select('id', { count: 'exact', head: true }),
    supabase.from('calendar_connections').select('id', { count: 'exact', head: true }),
    supabase.from('external_calendar_events').select('id', { count: 'exact', head: true }),
    supabase.from('user_behavior_events').select('id', { count: 'exact', head: true }),
  ])

  return {
    households: households.count ?? 0,
    profiles: profiles.count ?? 0,
    sectors: sectors.count ?? 0,
    user_constraints: constraints.count ?? 0,
    goals: goals.count ?? 0,
    priority_levels: priority.count ?? 0,
    tasks: tasks.count ?? 0,
    schedule_items: schedule.count ?? 0,
    calendar_connections: calendar.count ?? 0,
    external_calendar_events: external.count ?? 0,
    user_behavior_events: behavior.count ?? 0,
  }
}

export default async function ArchitecturePage() {
  const counts = await getCounts()

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Architecture View</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Live documentation for the current ERD and product model: domains, date-bound goals, tasks, schedule items, constraints, calendar sync, and learning events.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Concept Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <MermaidDiagram chart={CONCEPT_FLOW} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current ERD</CardTitle>
        </CardHeader>
        <CardContent>
          <MermaidDiagram chart={ERD} />
        </CardContent>
      </Card>

      <LiveArchitectureDashboard initialCounts={counts} />

      <Card>
        <CardHeader>
          <CardTitle>Entity Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {entities.map(([name, text]) => (
            <div key={name} className="rounded-md border p-3">
              <p className="font-mono text-sm font-semibold">{name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Normalization Notes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Table</th>
                <th className="py-2 pr-4">Form</th>
                <th className="py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {normalForms.map(([table, form, note]) => (
                <tr key={table} className="border-b">
                  <td className="py-2 pr-4 font-mono">{table}</td>
                  <td className="py-2 pr-4">{form}</td>
                  <td className="py-2 text-muted-foreground">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
