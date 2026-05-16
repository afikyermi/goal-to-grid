import { createAdminClient } from '@/lib/supabase/admin'

type BehaviorEventInput = {
  userId: string
  eventType: string
  taskId?: string | null
  goalId?: string | null
  scheduleItemId?: string | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
  metadata?: Record<string, unknown>
}

export async function recordBehaviorEvent(input: BehaviorEventInput) {
  try {
    const admin = createAdminClient()
    await admin.from('user_behavior_events').insert({
      user_id: input.userId,
      event_type: input.eventType,
      task_id: input.taskId ?? null,
      goal_id: input.goalId ?? null,
      schedule_item_id: input.scheduleItemId ?? null,
      scheduled_start: input.scheduledStart ?? null,
      scheduled_end: input.scheduledEnd ?? null,
      metadata: input.metadata ?? {},
    })
  } catch {
    // Behavior tracking must never block the core scheduling workflow.
  }
}
