export type Priority = 1 | 2 | 3 // 1=High, 2=Medium, 3=Low
export type ScheduleStatus = 'Pending' | 'Done' | 'Missed'

export interface Household {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  household_id: string | null
  display_name: string | null
  role: 'admin' | 'member'
  created_at: string
}

export interface Sector {
  id: string
  household_id: string
  name: string
  created_at: string
}

export interface Goal {
  id: string
  sector_id: string
  name: string
  description: string | null
  start_date: string // ISO date string
  end_date: string // ISO date string
  /** @deprecated Use end_date. Kept for compatibility with earlier migrations/UI. */
  deadline: string | null // ISO date string
  priority: Priority
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

export interface Task {
  id: string
  goal_id: string
  name: string
  duration_min: number
  priority: Priority
  is_completed: boolean
  is_recurring: boolean
  recurrence_rule: string | null
  created_at: string
}

export interface UserConstraint {
  id: string
  user_id: string
  label: string
  day_of_week: number | null // 0=Sun..6=Sat, null=every day (legacy — prefer recurrence_days)
  recurrence_days: number[] | null // explicit array of days, e.g. [1,3] = Mon+Wed; null = use day_of_week fallback
  start_time: string // "HH:MM:SS"
  end_time: string
  created_at: string
}

export interface ScheduleItem {
  id: string
  task_id: string
  scheduled_by: string | null
  scheduled_start: string // ISO timestamp
  scheduled_end: string
  status: ScheduleStatus
  google_event_id: string | null
  created_at: string
}

export interface PriorityLevel {
  id: Priority
  label: 'High' | 'Medium' | 'Low'
}

export interface ExternalCalendarEvent {
  id: string
  user_id: string
  provider: 'google'
  calendar_id: string
  google_event_id: string
  title: string
  starts_at: string
  ends_at: string
  is_busy: boolean
  created_at: string
  last_synced_at: string | null
  metadata: {
    google_meta?: {
      is_all_day?: boolean
      is_transparent?: boolean
      display_color?: string | null
    }
  }
}

// Privacy-preserving cross-user scheduling types (from DB views)
export interface BusyBlock {
  household_id: string
  user_id: string
  scheduled_start: string
  scheduled_end: string
  status: ScheduleStatus
}

export interface AvailabilityWindow {
  household_id: string
  user_id: string
  day_of_week: number | null
  start_time: string
  end_time: string
}

// Enriched types used in UI
export interface TaskWithGoal extends Task {
  goals: Pick<Goal, 'id' | 'name' | 'sector_id' | 'start_date' | 'end_date'>
}

export interface ScheduleItemWithTask extends ScheduleItem {
  tasks: Pick<Task, 'id' | 'name' | 'duration_min' | 'priority' | 'goal_id'> & {
    goals?: Pick<Goal, 'id' | 'name' | 'start_date' | 'end_date'> | null
  }
}

export interface GoalWithSector extends Goal {
  sectors: Pick<Sector, 'id' | 'name'>
}
